import { h } from 'preact';
import { useMemo, useState, useEffect } from 'preact/hooks';
import { useDraggable } from '../hooks/useDraggable.js';
import { useUIStore } from '../../stores/uiStore.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { BLOCK_NAMES, generateBlockIcon } from '../../blocks.js';
import { TOOL_ITEMS, HOTBAR_SIZE, TOTAL_SLOTS } from '../../config.js';
import { useChestStore } from '../../stores/chestStore.js';

function getIconUrl(type) {
  if (type == null) return null;
  const canvas = generateBlockIcon(type);
  return canvas ? canvas.toDataURL() : null;
}

export function InvSlot({ slotData, index, isActive, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const type = slotData?.type ?? null;
  const count = slotData?.count ?? 0;
  const iconUrl = useMemo(() => getIconUrl(type), [type]);
  const isTool = type != null && TOOL_ITEMS.has(type);
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
      {isTool && type != null && <span class="inv-slot-badge">道具</span>}
      {iconUrl && (
        <img src={iconUrl} width={32} height={32} alt=""
          class="inv-slot-icon"
          style={{ imageRendering: 'pixelated', display: 'block' }} />
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
  const { panelRef, dragStyle, onHeaderMouseDown } = useDraggable();

  const [dragFrom,    setDragFrom]    = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Tab / ESC で全パネル閉じる
  useEffect(() => {
    if (!inventoryOpen) return;
    const handleKey = (e) => {
      if (e.code === 'Escape' || e.code === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        useUIStore.getState().toggleInventory();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [inventoryOpen]);

  if (!inventoryOpen) return null;

  const handleDragStart = (i) => {
    setDragFrom(i);
    window.__invDragFrom = i;
  };
  const handleDragOver  = (i) => setDragOverIdx(i);
  const handleDrop = (toIdx) => {
    // チェストスロットからのドラッグ → ドロップ先スロットに配置
    if (window.__chestDragType != null) {
      const ok = useChestStore.getState().transferFromChestToSlot(window.__chestDragType, toIdx);
      if (ok) window.__aicraft?.sound?.playPlace();
      window.__chestDragType = null;
      setDragFrom(null); setDragOverIdx(null);
      return;
    }
    const from = dragFrom ?? window.__invDragFrom;
    if (from !== null && from !== toIdx) {
      useInventoryStore.getState().swapSlots(from, toIdx);
    }
    setDragFrom(null);
    setDragOverIdx(null);
    window.__invDragFrom = null;
  };
  const handleDragEnd = () => {
    setDragFrom(null);
    setDragOverIdx(null);
    window.__invDragFrom = null;
  };

  const backpackSlots = slots.slice(HOTBAR_SIZE, TOTAL_SLOTS);

  return (
    <div id="inventory-panel" ref={panelRef} style={dragStyle}>
      <div class="inv-header" onMouseDown={onHeaderMouseDown} style={{ cursor: 'grab' }}>
        <span>インベントリ</span>
        <button class="inv-close-btn" onClick={() => useUIStore.getState().toggleInventory()}>✕</button>
      </div>
      <div class="inv-section-label">バックパック</div>
      <div id="inventory-grid">
        {backpackSlots.map((slotData, i) => {
          const absIdx = HOTBAR_SIZE + i;
          return (
            <InvSlot
              key={absIdx}
              slotData={slotData}
              index={absIdx}
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
      <div class="inv-hint-bar">
        <span>Tab / ESC: 閉じる</span>
        <span>1〜9: スロット選択</span>
        <span>ドラッグ: スロット入替</span>
      </div>
    </div>
  );
}
