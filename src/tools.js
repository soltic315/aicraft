import { BlockType } from './blocks.js';

export const ToolType = {
  PICKAXE: 'pickaxe',
  AXE: 'axe',
  SHOVEL: 'shovel',
};

export const TOOL_ORDER = [
  ToolType.PICKAXE,
  ToolType.AXE,
  ToolType.SHOVEL,
];

export const TOOL_NAMES = {
  [ToolType.PICKAXE]: 'ツルハシ',
  [ToolType.AXE]: '斧',
  [ToolType.SHOVEL]: 'シャベル',
};

const TOOL_BREAK_MULTIPLIERS = {
  [ToolType.PICKAXE]: {
    [BlockType.STONE]: 2.4,
    [BlockType.GLASS]: 1.6,
  },
  [ToolType.AXE]: {
    [BlockType.WOOD]: 2.2,
    [BlockType.LEAVES]: 1.5,
    [BlockType.PLANK]: 2.0,
    [BlockType.CRAFTING_TABLE]: 2.1,
    [BlockType.CHEST]: 2.0,
  },
  [ToolType.SHOVEL]: {
    [BlockType.GRASS]: 2.0,
    [BlockType.DIRT]: 2.0,
    [BlockType.SAND]: 2.4,
  },
};

export function isToolType(value) {
  return TOOL_ORDER.includes(value);
}

export function getToolBreakMultiplier(toolType, blockType) {
  const byTool = TOOL_BREAK_MULTIPLIERS[toolType];
  if (!byTool) return 1;
  return byTool[blockType] ?? 1;
}
