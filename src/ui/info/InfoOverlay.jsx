import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { useGameStore } from '../../stores/gameStore.js';
import { useDayNightStore } from '../../stores/dayNightStore.js';
import { usePlayerStore } from '../../stores/playerStore.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { useToolStore } from '../../stores/toolStore.js';
import { BLOCK_NAMES } from '../../blocks.js';
import { TOOL_NAMES } from '../../tools.js';

export function InfoOverlay() {
  const elRef = useRef(null);

  useEffect(() => {
    const update = () => {
      const el = elRef.current;
      if (!el) return;

      const { fps } = useGameStore.getState();
      const { cycleRatio, isDay } = useDayNightStore.getState();
      const { position, health, maxHealth } = usePlayerStore.getState();
      const { selectedSlot, slots } = useInventoryStore.getState();
      const { selectedTool } = useToolStore.getState();

      const selectedSlotData = slots[selectedSlot];
      const blockType = selectedSlotData?.type ?? null;
      const blockName = blockType != null ? (BLOCK_NAMES[blockType] || '') : '（空）';
      const selectedCount = selectedSlotData?.count ?? 0;
      const toolName = TOOL_NAMES[selectedTool] || '-';

      el.innerHTML =
        `FPS: ${fps}<br>` +
        `時刻: ${isDay ? '昼' : '夜'} (${Math.floor(cycleRatio * 24).toString().padStart(2, '0')}:00)<br>` +
        `座標: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}<br>` +
        `体力: ${Math.round(health)} / ${maxHealth}<br>` +
        `選択: ${blockName}${blockType != null ? ` x${selectedCount}` : ''}<br>` +
        `道具: ${toolName}`;
    };

    const unsubs = [
      useGameStore.subscribe(update),
      useDayNightStore.subscribe(update),
      usePlayerStore.subscribe(update),
      useInventoryStore.subscribe(update),
      useToolStore.subscribe(update),
    ];

    update();
    return () => unsubs.forEach((u) => u());
  }, []);

  return <div id="info" ref={elRef} />;
}
