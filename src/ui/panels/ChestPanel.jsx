import { h } from 'preact';
import { useMemo, useState, useEffect } from 'preact/hooks';
import { useDraggable } from '../hooks/useDraggable.js';
import { useUIStore } from '../../stores/uiStore.js';
import { useChestStore } from '../../stores/chestStore.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { BLOCK_NAMES } from '../../blocks.js';
import { generateBlockIcon } from '../../BlockTextureGenerator.js';
import { TOOL_ITEMS, CHEST_STORAGE_LIMIT, parsePosKey } from '../../config.js';

function getIconUrl(type) {
  if (type == null) return null;
  const canvas = generateBlockIcon(type);
  return canvas ? canvas.toDataURL() : null;
}

function ChestItemSlot({ type, count, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const iconUrl = useMemo(() => getIconUrl(type), [type]);
  const isTool = TOOL_ITEMS.has(type);

  return (
    <div
      class={`inv-slot${isDragOver ? ' inv-drag-over' : ''}`}
      draggable
      onDragStart={() => onDragStart('chest-' + type)}
      onDragOver={(e) => { e.preventDefault(); onDragOver('chest-' + type); }}
      onDrop={(e) => { e.preventDefault(); onDrop('chest-' + type); }}
      onDragEnd={onDragEnd}
      title={BLOCK_NAMES[type] ?? '?'}
    >
      {isTool && <span class="inv-slot-badge">道具</span>}
      {iconUrl && (
        <img src={iconUrl} width={32} height={32} alt=""
          class="inv-slot-icon"
          style={{ imageRendering: 'pixelated', display: 'block' }} />
      )}
      {!iconUrl && <span class="inv-slot-icon" />}
      <span class="inv-slot-count">{isTool ? (count > 0 ? '✓' : '✗') : count}</span>
    </div>
  );
}

export function ChestPanel() {
  const chestOpen      = useUIStore((s) => s.chestOpen);
  const openedChestKey = useChestStore((s) => s.openedChestKey);
  const storage        = useChestStore((s) => s.storage);
  const slots          = useInventoryStore((s) => s.slots);
  const { panelRef, dragStyle, onHeaderMouseDown } = useDraggable();

  const [dragFrom,    setDragFrom]    = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);

  // E / ESC で閉じる
  useEffect(() => {
    if (!chestOpen) return;
    const handleKey = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyE') {
        e.stopPropagation();
        window.__aicraft?.eventBus?.emit('close-chest');
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [chestOpen]);

  if (!chestOpen || !openedChestKey) return null;
  const chestData = storage.get(openedChestKey);
  if (!chestData) return null;

  const chestPos   = parsePosKey(openedChestKey);
  const totalItems = Object.values(chestData).reduce((sum, v) => sum + (Number(v) || 0), 0);

  const chestItems = Object.entries(chestData)
    .map(([typeStr, count]) => ({ type: Number(typeStr), count: Number(count) || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => a.type - b.type);

  const handleDragStart = (key) => {
    setDragFrom(key);
    if (key.startsWith('chest-')) {
      // インベントリ・ホットバーのドロップハンドラが参照するグローバル
      window.__chestDragType = Number(key.replace('chest-', ''));
    } else {
      window.__invDragFrom = Number(key.replace('inv-', ''));
    }
  };
  const handleDragOver  = (key) => setDragOverKey(key);
  const handleDragEnd   = () => {
    // チェストアイテムがパネル外にドロップされた場合は床に捨てる
    const droppedChestType = window.__chestDragType;
    setDragFrom(null);
    setDragOverKey(null);
    window.__invDragFrom = null;
    window.__chestDragType = null;

    if (droppedChestType != null) {
      window.__aicraft?.eventBus?.emit('drop-chest-item-to-floor', { type: droppedChestType });
    }
  };

  const handleDrop = (toKey) => {
    const from = dragFrom;
    // 有効ドロップとしてマーク（handleDragEnd が床ドロップしないようクリア）
    window.__chestDragType = null;
    window.__invDragFrom = null;
    if (!from || from === toKey) { handleDragEnd(); return; }
    const chest = useChestStore.getState();

    if (from.startsWith('chest-') && toKey.startsWith('inv-')) {
      // チェスト → インベントリ
      const type = Number(from.replace('chest-', ''));
      const ok = chest.transferAllFromChest(type);
      if (ok) window.__aicraft?.sound?.playPlace();
      else window.__aicraft?.sound?.playError();
    } else if (from.startsWith('inv-') && toKey.startsWith('chest-')) {
      // インベントリ → チェスト
      const slotIdx = Number(from.replace('inv-', ''));
      const result = chest.depositSlot(slotIdx);
      if (result === true) window.__aicraft?.sound?.playPlace();
      else if (result === 'full') {
        window.__aicraft?.sound?.playError();
        useUIStore.getState().showFeedback('収納失敗: チェストが満杯です');
      }
    }
    handleDragEnd();
  };

  // チェストエリアへのドロップ（インベントリ or ホットバーから）
  const handleChestAreaDrop = (e) => {
    e.preventDefault();
    // 有効ドロップとしてマーク
    window.__invDragFrom = null;
    const localFrom  = dragFrom;
    const hotbarFrom = (window.__invDragFrom != null) ? 'inv-' + window.__invDragFrom : null;
    const from = localFrom || hotbarFrom;
    if (!from || !from.startsWith('inv-')) { handleDragEnd(); return; }
    const slotIdx = Number(from.replace('inv-', ''));
    const result = useChestStore.getState().depositSlot(slotIdx);
    if (result === true) window.__aicraft?.sound?.playPlace();
    else if (result === 'full') {
      window.__aicraft?.sound?.playError();
      useUIStore.getState().showFeedback('収納失敗: チェストが満杯です');
    }
    handleDragEnd();
  };

  return (
    <div id="chest-panel-modal" ref={panelRef} style={dragStyle}>
      <div class="inv-header" onMouseDown={onHeaderMouseDown} style={{ cursor: 'grab' }}>
        <span>チェスト（{chestPos.x}, {chestPos.y}, {chestPos.z}）&nbsp;
          <span style={{ opacity: 0.6, fontSize: '10px' }}>{totalItems} / {CHEST_STORAGE_LIMIT}</span>
        </span>
        <button class="inv-close-btn"
          onClick={() => window.__aicraft?.eventBus?.emit('close-chest')}>✕</button>
      </div>
      <div class="inv-section-label">チェスト内容</div>
      <div
        id="chest-grid"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleChestAreaDrop}
      >
        {chestItems.length === 0 && (
          <div class="chest-empty-hint">（空） — インベントリからドラッグして預ける</div>
        )}
        {chestItems.map(({ type, count }) => (
          <ChestItemSlot
            key={type}
            type={type}
            count={count}
            isDragOver={dragOverKey === 'chest-' + type}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
      <div class="inv-hint-bar">
        <span>E / ESC: 閉じる</span>
        <span>ドラッグ: チェスト ↔ インベントリ</span>
      </div>
    </div>
  );
}
