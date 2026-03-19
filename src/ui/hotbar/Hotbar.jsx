import { h } from 'preact';
import { memo, useMemo, useState } from 'preact/compat';
import { generateBlockIcon } from '../../blocks.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { useUIStore } from '../../stores/uiStore.js';
import { useChestStore } from '../../stores/chestStore.js';
import { HOTBAR_SIZE } from '../../config.js';

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
      return;
    }
    const from = window.__invDragFrom;
    if (from !== null && from !== undefined && from !== i) {
      useInventoryStore.getState().swapSlots(from, i);
    }
    window.__invDragFrom = null;
    setDragOverIdx(null);
  };

  const handleDragLeave = () => setDragOverIdx(null);

  // ホットバーから直接ドラッグ開始（インベントリまたはチェストが開いているとき）
  const handleDragStart = (e, i) => {
    if (!panelOpen) { e.preventDefault(); return; }
    window.__invDragFrom = i;
  };

  return (
    <div id="hud" style={{ pointerEvents: panelOpen ? 'auto' : 'none' }}>
      {Array.from({ length: HOTBAR_SIZE }, (_, i) => {
        const slot = slots[i];
        const type = slot?.type ?? null;
        const count = slot?.count ?? 0;
        const iconUrl = useMemo(() => getIconUrl(type), [type]);
        const isDropTarget = inventoryOpen && dragOverIdx === i;

        return (
          <div
            key={i}
            class={`hotbar-slot${i === selectedSlot ? ' active' : ''}${isDropTarget ? ' hotbar-drop-target' : ''}`}
            draggable={inventoryOpen && type != null}
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragLeave={handleDragLeave}
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
            {type != null && <span class="slot-count">{count}</span>}
          </div>
        );
      })}
    </div>
  );
}
