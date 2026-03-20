import { create } from 'zustand';
import { TOOL_ORDER } from '../tools.js';

// ティア別最大耐久値
export const TOOL_DURABILITY_MAX = {
  pickaxe:       60,
  axe:           60,
  shovel:        60,
  stone_pickaxe: 132,
  stone_axe:     132,
  stone_shovel:  132,
  iron_pickaxe:  250,
  iron_axe:      250,
  iron_shovel:   250,
};

const fullDurability = () =>
  Object.fromEntries(TOOL_ORDER.map((t) => [t, TOOL_DURABILITY_MAX[t] ?? 60]));

export const useDurabilityStore = create((set, get) => ({
  durability: fullDurability(),

  // 耐久値を1減らす。0以下になったら true を返す（ツール破壊）
  damage(toolType) {
    const { durability } = get();
    const current = durability[toolType];
    if (current == null) return false;
    const next = current - 1;
    set({ durability: { ...durability, [toolType]: Math.max(0, next) } });
    return next <= 0;
  },

  // 耐久値を回復する
  repair(toolType, amount) {
    const { durability } = get();
    if (durability[toolType] == null) return;
    const max = TOOL_DURABILITY_MAX[toolType] ?? 60;
    set({
      durability: {
        ...durability,
        [toolType]: Math.min(max, durability[toolType] + amount),
      },
    });
  },

  // 指定ツールの耐久値を最大にリセット
  resetTool(toolType) {
    const { durability } = get();
    const max = TOOL_DURABILITY_MAX[toolType] ?? 60;
    set({ durability: { ...durability, [toolType]: max } });
  },

  // 全ツールの耐久値をリセット
  reset() {
    set({ durability: fullDurability() });
  },

  // セーブデータから復元
  restoreFromSave(saved) {
    if (!saved || typeof saved !== 'object') return;
    const current = fullDurability();
    for (const t of TOOL_ORDER) {
      if (typeof saved[t] === 'number') {
        const max = TOOL_DURABILITY_MAX[t] ?? 60;
        current[t] = Math.min(max, Math.max(0, Math.floor(saved[t])));
      }
    }
    set({ durability: current });
  },
}));
