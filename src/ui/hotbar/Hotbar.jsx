import { h } from 'preact';
import { memo, useMemo } from 'preact/compat';
import { generateBlockIcon } from '../../blocks.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { HOTBAR_SIZE } from '../../config.js';

/** スロットタイプに対応するアイコン画像URL（null なら null を返す） */
function getIconUrl(type) {
  if (type == null) return null;
  const canvas = generateBlockIcon(type);
  return canvas ? canvas.toDataURL() : null;
}

const HotbarSlot = memo(function HotbarSlot({ slotType, index, isActive, count }) {
  // slotType が変わったときのみ URL を再計算
  const iconUrl = useMemo(() => getIconUrl(slotType), [slotType]);
  const label = String(index + 1);

  return (
    <div class={`hotbar-slot${isActive ? ' active' : ''}`}>
      <span class="slot-num">{label}</span>
      {iconUrl && (
        <img
          src={iconUrl}
          width={40}
          height={40}
          alt=""
          style={{ imageRendering: 'pixelated', display: 'block' }}
        />
      )}
      {slotType != null && <span class="slot-count">{count}</span>}
    </div>
  );
});

export function Hotbar() {
  const selectedSlot = useInventoryStore((s) => s.selectedSlot);
  const slots        = useInventoryStore((s) => s.slots);

  return (
    <div id="hud">
      {Array.from({ length: HOTBAR_SIZE }, (_, i) => {
        const slot = slots[i];
        return (
          <HotbarSlot
            key={i}
            slotType={slot?.type ?? null}
            index={i}
            isActive={i === selectedSlot}
            count={slot?.count ?? 0}
          />
        );
      })}
    </div>
  );
}
