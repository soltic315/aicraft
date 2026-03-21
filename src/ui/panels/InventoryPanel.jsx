import { h } from 'preact';
import { useMemo, useState, useEffect } from 'preact/hooks';
import { useDraggable } from '../hooks/useDraggable.js';
import { useUIStore } from '../../stores/uiStore.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { BLOCK_NAMES, generateBlockIcon } from '../../blocks.js';
import { TOOL_ITEMS, ARMOR_ITEMS, HOTBAR_SIZE, TOTAL_SLOTS } from '../../config.js';
import { useChestStore } from '../../stores/chestStore.js';
import { useArmorStore, ARMOR_TYPE_TO_SLOT, ARMOR_DEFENSE, ARMOR_KEY_TO_BLOCK } from '../../stores/armorStore.js';

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
      {type != null && (
        <span class="inv-slot-count">{isTool ? (count > 0 ? '✓' : '✗') : count}</span>
      )}
    </div>
  );
}

// 防具スロットコンポーネント（equippedType は 'leather_helmet' 形式のキー文字列）
function ArmorSlot({ slotKey, label, equippedType, isDragOver, onDragOver, onDrop }) {
  const blockType = equippedType ? ARMOR_KEY_TO_BLOCK[equippedType] : null;
  const iconUrl = useMemo(() => blockType != null ? (generateBlockIcon(blockType)?.toDataURL() ?? null) : null, [blockType]);

  const handleClick = () => {
    if (!equippedType || blockType == null) return;
    // 外す → インベントリに戻す（BlockType数値で渡す）
    window.__aicraft?.eventBus?.emit('unequip-armor', { slot: slotKey, type: blockType });
  };

  return (
    <div
      class={`armor-slot${isDragOver ? ' inv-drag-over' : ''}${equippedType ? '' : ' inv-empty'}`}
      onDragOver={(e) => { e.preventDefault(); onDragOver(slotKey); }}
      onDrop={(e) => { e.preventDefault(); onDrop(slotKey); }}
      onClick={handleClick}
      title={equippedType ? `${BLOCK_NAMES[blockType] ?? equippedType}（クリックで外す）` : `${label}スロット（空）`}
    >
      <div class="armor-slot-label">{label}</div>
      {iconUrl
        ? <img src={iconUrl} width={28} height={28} alt="" class="inv-slot-icon" style={{ imageRendering: 'pixelated', display: 'block' }} />
        : <span class="armor-slot-empty-icon">{label[0]}</span>
      }
    </div>
  );
}

export function InventoryPanel() {
  const inventoryOpen = useUIStore((s) => s.inventoryOpen);
  const slots         = useInventoryStore((s) => s.slots);
  const armorEquipped = useArmorStore((s) => s.equipped);
  const { panelRef, dragStyle, onHeaderMouseDown } = useDraggable();

  const [dragFrom,      setDragFrom]      = useState(null);
  const [dragOverIdx,   setDragOverIdx]   = useState(null);
  const [armorDragOver, setArmorDragOver] = useState(null);

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
      window.__invDragFrom = null;
      return;
    }
    const from = dragFrom ?? window.__invDragFrom;
    if (from !== null && from !== toIdx) {
      useInventoryStore.getState().swapSlots(from, toIdx);
    }
    setDragFrom(null);
    setDragOverIdx(null);
    // ドロップ成功を示すためクリア（handleDragEnd が床ドロップしないように）
    window.__invDragFrom = null;
  };

  const handleDragEnd = () => {
    // window.__invDragFrom がまだセットされている = どの有効スロットにもドロップされなかった
    const from = window.__invDragFrom;
    setDragFrom(null);
    setDragOverIdx(null);
    setArmorDragOver(null);
    window.__invDragFrom = null;

    if (from != null) {
      // パネル外にドロップ → 床に捨てる
      const slot = useInventoryStore.getState().slots[from];
      if (slot && slot.type !== null && slot.count > 0) {
        window.__aicraft?.eventBus?.emit('drop-item-from-slot', { slotIndex: from, count: slot.count });
      }
    }
  };

  // 防具スロットへのドロップ
  const handleArmorDrop = (slotKey) => {
    setArmorDragOver(null);
    const from = dragFrom ?? window.__invDragFrom;
    if (from == null) return;
    const slot = useInventoryStore.getState().slots[from];
    if (!slot || slot.type == null) return;
    // 防具かどうか確認
    if (!ARMOR_ITEMS.has(slot.type)) return;
    window.__aicraft?.eventBus?.emit('equip-armor-from-slot', { slotIndex: from, armorType: slot.type });
    setDragFrom(null);
    window.__invDragFrom = null;
  };

  const backpackSlots = slots.slice(HOTBAR_SIZE, TOTAL_SLOTS);

  const ARMOR_SLOT_LABELS = { helmet: '頭', chestplate: '胴', leggings: '脚', boots: '足' };

  return (
    <div id="inventory-panel" ref={panelRef} style={dragStyle}>
      <div class="inv-header" onMouseDown={onHeaderMouseDown} style={{ cursor: 'grab' }}>
        <span>インベントリ</span>
        <button class="inv-close-btn" onClick={() => useUIStore.getState().toggleInventory()}>✕</button>
      </div>
      <div id="inventory-body">
        {/* 防具スロット（左） */}
        <div id="armor-slots-panel">
          <div class="inv-section-label">防具</div>
          {['helmet', 'chestplate', 'leggings', 'boots'].map((slot) => (
            <ArmorSlot
              key={slot}
              slotKey={slot}
              label={ARMOR_SLOT_LABELS[slot]}
              equippedType={armorEquipped[slot]}
              isDragOver={armorDragOver === slot}
              onDragOver={(s) => setArmorDragOver(s)}
              onDrop={handleArmorDrop}
            />
          ))}
        </div>
        {/* インベントリグリッド（右） */}
        <div id="inventory-grid-section">
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
        </div>
      </div>
      <div class="inv-hint-bar">
        <span>Tab / ESC: 閉じる</span>
        <span>防具ドラッグ: 装備</span>
        <span>防具クリック: 外す</span>
      </div>
    </div>
  );
}
