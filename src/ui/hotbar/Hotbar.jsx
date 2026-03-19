import { h } from 'preact';
import { memo } from 'preact/compat';
import { useRef, useEffect } from 'preact/hooks';
import { generateBlockIcon } from '../../blocks.js';
import { HOTBAR_BLOCKS } from '../../config.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';

const HotbarSlot = memo(function HotbarSlot({ type, index, isActive, count }) {
  const iconRef = useRef(null);

  useEffect(() => {
    const container = iconRef.current;
    if (!container) return;
    container.innerHTML = '';
    const icon = generateBlockIcon(type);
    if (icon) container.appendChild(icon);
  }, [type]);

  const label = index === 9 ? '0' : String(index + 1);

  return (
    <div class={`hotbar-slot${isActive ? ' active' : ''}`}>
      <span class="slot-num">{label}</span>
      <span ref={iconRef} />
      <span class="slot-count">{count}</span>
    </div>
  );
});

export function Hotbar() {
  const selectedSlot = useInventoryStore((s) => s.selectedSlot);
  const counts = useInventoryStore((s) => s.counts);

  return (
    <div id="hud">
      {HOTBAR_BLOCKS.map((type, i) => (
        <HotbarSlot
          key={type}
          type={type}
          index={i}
          isActive={i === selectedSlot}
          count={counts[type] ?? 0}
        />
      ))}
    </div>
  );
}
