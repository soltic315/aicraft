import { h } from 'preact';
import { useMemo, useState, useEffect } from 'preact/hooks';
import { useUIStore } from '../../stores/uiStore.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { BLOCK_NAMES, generateBlockIcon } from '../../blocks.js';
import { FOOD_ITEMS, TOOL_ITEMS, HOTBAR_SIZE, TOTAL_SLOTS } from '../../config.js';

function getIconUrl(type) {
  if (type == null) return null;
  const canvas = generateBlockIcon(type);
  return canvas ? canvas.toDataURL() : null;
}

/** 個別スロット（ドラッグ＆ドロップ対応） */
function InvSlot({ slotData, index, isHotbar, isActive, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const type = slotData?.type ?? null;
  const count = slotData?.count ?? 0;
  const iconUrl = useMemo(() => getIconUrl(type), [type]);

  const slotKey = isHotbar ? String(index + 1) : '';
  const isTool = type != null && TOOL_ITEMS.has(type);
  const isFood = type != null && FOOD_ITEMS.has(type);
  const isEmpty = type == null;

  return (
    <div
      class={`inv-slot${isActive ? ' inv-active' : ''}${isDragOver ? ' inv-drag-over' : ''}${isEmpty ? ' inv-empty' : ''}`}
      draggable={!isEmpty}
      onDragStart={() => !isEmpty && onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDrop={(e) => { e.preventDefault(); onDrop(index); }}
      onDragEnd={onDragEnd}
      title={type != null ? (BLOCK_NAMES[type] ?? '?') : '（空）'}
    >
      {slotKey && <span class="inv-slot-num">{slotKey}</span>}
      {isTool && type != null && <span class="inv-slot-badge">道具</span>}
      {isFood && type != null && <span class="inv-slot-badge inv-badge-food">食料</span>}
      {iconUrl && (
        <img
          src={iconUrl}
          width={32}
          height={32}
          alt=""
          class="inv-slot-icon"
          style={{ imageRendering: 'pixelated', display: 'block' }}
        />
      )}
      {!iconUrl && <span class="inv-slot-icon" />}
      {type != null && <span class="inv-slot-name">{BLOCK_NAMES[type] ?? '?'}</span>}
      {type != null && (
        <span class="inv-slot-count">{isTool ? (count > 0 ? '✓' : '✗') : count}</span>
      )}
    </div>
  );
}

export function InventoryPanel() {
  const inventoryOpen = useUIStore((s) => s.inventoryOpen);
  const slots         = useInventoryStore((s) => s.slots);
  const selectedSlot  = useInventoryStore((s) => s.selectedSlot);

  const [dragFrom,    setDragFrom]    = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // I / ESC キーで閉じる
  useEffect(() => {
    if (!inventoryOpen) return;
    const handleKey = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyI') {
        e.stopPropagation();
        useUIStore.getState().toggleInventory();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [inventoryOpen]);

  if (!inventoryOpen) return null;

  // ---- ドラッグ操作 ----
  const handleDragStart = (i) => setDragFrom(i);
  const handleDragOver  = (i) => setDragOverIdx(i);
  const handleDrop = (toIdx) => {
    if (dragFrom !== null && dragFrom !== toIdx) {
      useInventoryStore.getState().swapSlots(dragFrom, toIdx);
    }
    setDragFrom(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDragFrom(null); setDragOverIdx(null); };

  // ---- 食料を食べる ----
  const handleEat = (type) => {
    window.__aicraft?.eventBus?.emit('eat-food', type);
  };

  // ---- 閉じる ----
  const handleClose = () => useUIStore.getState().toggleInventory();

  // バックパックスロット（インデックス HOTBAR_SIZE〜TOTAL_SLOTS-1）
  const backpackSlots = slots.slice(HOTBAR_SIZE, TOTAL_SLOTS);
  // ホットバースロット（インデックス 0〜HOTBAR_SIZE-1）
  const hotbarSlots = slots.slice(0, HOTBAR_SIZE);

  // 所持している食料スロット
  const foodSlots = slots.filter((s) => s.type != null && FOOD_ITEMS.has(s.type) && s.count > 0);

  return (
    <div id="inventory-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <div class="inv-header">
        <span>インベントリ</span>
        <button class="inv-close-btn" onClick={handleClose}>✕</button>
      </div>

      {/* 操作説明 */}
      <div class="inv-op-hint">
        ツール: 選択すると自動装備 &nbsp;|&nbsp; 食料: 右クリックで食べる &nbsp;|&nbsp; ドラッグ: 並び替え
      </div>

      {/* バックパック（18スロット） */}
      <div class="inv-section-label">バックパック</div>
      <div id="inventory-grid">
        {backpackSlots.map((slotData, i) => {
          const absIdx = HOTBAR_SIZE + i;
          return (
            <InvSlot
              key={absIdx}
              slotData={slotData}
              index={absIdx}
              isHotbar={false}
              isActive={false}
              isDragOver={dragOverIdx === absIdx}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          );
        })}
      </div>

      {/* ホットバー（9スロット） */}
      <div class="inv-section-label">ホットバー</div>
      <div id="inventory-hotbar-grid">
        {hotbarSlots.map((slotData, i) => (
          <InvSlot
            key={i}
            slotData={slotData}
            index={i}
            isHotbar={true}
            isActive={i === selectedSlot}
            isDragOver={dragOverIdx === i}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {/* 食料セクション（所持している場合のみ） */}
      {foodSlots.length > 0 && (
        <>
          <div class="inv-divider" />
          <div class="inv-section">
            <span class="inv-section-title">食料（クリックで食べる）</span>
            <div class="inv-food-row">
              {foodSlots.map((s, i) => (
                <button
                  key={i}
                  class="inv-food-btn"
                  onClick={() => handleEat(s.type)}
                >
                  {BLOCK_NAMES[s.type] ?? '食料'} ×{s.count} 食べる
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ヒントバー */}
      <div class="inv-hint-bar">
        <span>I / ESC: 閉じる</span>
        <span>1〜9: スロット選択</span>
        <span>ドラッグ: スロット入替</span>
      </div>
    </div>
  );
}
