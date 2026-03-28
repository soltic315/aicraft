import { h } from 'preact';
import { memo, useMemo, useState } from 'preact/compat';
import { BLOCK_NAMES } from '../../blocks.js';
import { generateBlockIcon } from '../../BlockTextureGenerator.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { useUIStore } from '../../stores/uiStore.js';
import { useChestStore } from '../../stores/chestStore.js';
import { HOTBAR_SIZE, getStackLimit } from '../../config.js';
import { ITEM_TO_TOOL_TYPE, TOOL_NAMES } from '../../tools.js';
import { useDurabilityStore, TOOL_DURABILITY_MAX } from '../../stores/durabilityStore.js';

function getIconUrl(type) {
  if (type == null) return null;
  const canvas = generateBlockIcon(type);
  return canvas ? canvas.toDataURL() : null;
}

export function Hotbar() {
  const selectedSlot  = useInventoryStore((s) => s.selectedSlot);
  const slots         = useInventoryStore((s) => s.slots);
  const inventoryOpen = useUIStore((s) => s.inventoryOpen);
  const chestOpen     = useUIStore((s) => s.chestOpen);
  const panelOpen     = inventoryOpen || chestOpen;

  const [dragOverIdx, setDragOverIdx] = useState(null);

  const handleDragOver = (e, i) => {
    if (!panelOpen) return;
    e.preventDefault();
    setDragOverIdx(i);
  };

  const handleDrop = (e, i) => {
    if (!panelOpen) return;
    e.preventDefault();
    // チェストスロットからのドラッグ
    if (window.__chestDragType != null) {
      const ok = useChestStore.getState().transferAllFromChest(window.__chestDragType);
      if (ok) window.__aicraft?.sound?.playPlace();
      window.__chestDragType = null;
      setDragOverIdx(null);
      window.__invDragFrom = null;
      return;
    }
    const from = window.__invDragFrom;
    if (from !== null && from !== undefined && from !== i) {
      useInventoryStore.getState().swapSlots(from, i);
    }
    // ドロップ成功を示すためクリア
    window.__invDragFrom = null;
    setDragOverIdx(null);
  };

  const handleDragLeave = () => setDragOverIdx(null);

  // ホットバーから直接ドラッグ開始（インベントリまたはチェストが開いているとき）
  const handleDragStart = (e, i) => {
    if (!panelOpen) { e.preventDefault(); return; }
    window.__invDragFrom = i;
  };

  // ドラッグ終了: window.__invDragFrom がまだセットされていれば外にドロップ → 床に捨てる
  const handleDragEnd = (e, i) => {
    if (!panelOpen) return;
    const from = window.__invDragFrom;
    window.__invDragFrom = null;
    setDragOverIdx(null);

    if (from != null) {
      const slot = useInventoryStore.getState().slots[from];
      if (slot && slot.type !== null && slot.count > 0) {
        window.__aicraft?.eventBus?.emit('drop-item-from-slot', { slotIndex: from, count: slot.count });
      }
    }
  };

  const durability = useDurabilityStore((s) => s.durability);

  const selectedSlotData = slots[selectedSlot];
  const selectedType = selectedSlotData?.type ?? null;
  const selectedItemName = useMemo(() => {
    if (selectedType == null) return null;
    const toolType = ITEM_TO_TOOL_TYPE[selectedType];
    return toolType ? TOOL_NAMES[toolType] : (BLOCK_NAMES[selectedType] ?? null);
  }, [selectedType]);

  return (
    <div id="hud" style={{ pointerEvents: panelOpen ? 'auto' : 'none' }}>
      {selectedItemName && (
        <div id="hotbar-item-name">{selectedItemName}</div>
      )}
      <div id="hotbar-slots">
      {Array.from({ length: HOTBAR_SIZE }, (_, i) => {
        const slot = slots[i];
        const type = slot?.type ?? null;
        const count = slot?.count ?? 0;
        const iconUrl = useMemo(() => getIconUrl(type), [type]);
        const isDropTarget = panelOpen && dragOverIdx === i;
        const toolType = type != null ? ITEM_TO_TOOL_TYPE[type] : null;
        const durPct = toolType != null
          ? durability[toolType] / (TOOL_DURABILITY_MAX[toolType] ?? 60)
          : null;

        return (
          <div
            key={i}
            class={`hotbar-slot${i === selectedSlot ? ' active' : ''}${isDropTarget ? ' hotbar-drop-target' : ''}`}
            draggable={panelOpen && type != null}
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragLeave={handleDragLeave}
            onDragEnd={(e) => handleDragEnd(e, i)}
          >
            <span class="slot-num">{String(i + 1)}</span>
            {iconUrl && (
              <img
                src={iconUrl}
                width={40}
                height={40}
                alt=""
                style={{ imageRendering: 'pixelated', display: 'block' }}
              />
            )}
            {type != null && getStackLimit(type) > 1 && <span class="slot-count">{count}</span>}
            {durPct !== null && (
              <div class="slot-durability-wrap">
                <div
                  class="slot-durability-bar"
                  style={{
                    width: `${Math.round(durPct * 100)}%`,
                    background: durPct > 0.5 ? '#4c4' : durPct > 0.25 ? '#cc4' : '#c44',
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
