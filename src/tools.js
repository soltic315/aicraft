import { BlockType } from './blocks.js';

export const ToolType = {
  PICKAXE:       'pickaxe',
  AXE:           'axe',
  SHOVEL:        'shovel',
  STONE_PICKAXE: 'stone_pickaxe',
  STONE_AXE:     'stone_axe',
  STONE_SHOVEL:  'stone_shovel',
  IRON_PICKAXE:  'iron_pickaxe',
  IRON_AXE:      'iron_axe',
  IRON_SHOVEL:   'iron_shovel',
};

export const TOOL_ORDER = [
  ToolType.PICKAXE,
  ToolType.AXE,
  ToolType.SHOVEL,
  ToolType.STONE_PICKAXE,
  ToolType.STONE_AXE,
  ToolType.STONE_SHOVEL,
  ToolType.IRON_PICKAXE,
  ToolType.IRON_AXE,
  ToolType.IRON_SHOVEL,
];

export const TOOL_NAMES = {
  [ToolType.PICKAXE]:       'ツルハシ（木）',
  [ToolType.AXE]:           '斧（木）',
  [ToolType.SHOVEL]:        'シャベル（木）',
  [ToolType.STONE_PICKAXE]: 'ツルハシ（石）',
  [ToolType.STONE_AXE]:     '斧（石）',
  [ToolType.STONE_SHOVEL]:  'シャベル（石）',
  [ToolType.IRON_PICKAXE]:  'ツルハシ（鉄）',
  [ToolType.IRON_AXE]:      '斧（鉄）',
  [ToolType.IRON_SHOVEL]:   'シャベル（鉄）',
};

// ホットバーのツールアイテム(BlockType) → ToolType への変換
export const ITEM_TO_TOOL_TYPE = {
  [BlockType.PICKAXE]:       ToolType.PICKAXE,
  [BlockType.AXE]:           ToolType.AXE,
  [BlockType.SHOVEL]:        ToolType.SHOVEL,
  [BlockType.STONE_PICKAXE]: ToolType.STONE_PICKAXE,
  [BlockType.STONE_AXE]:     ToolType.STONE_AXE,
  [BlockType.STONE_SHOVEL]:  ToolType.STONE_SHOVEL,
  [BlockType.IRON_PICKAXE]:  ToolType.IRON_PICKAXE,
  [BlockType.IRON_AXE]:      ToolType.IRON_AXE,
  [BlockType.IRON_SHOVEL]:   ToolType.IRON_SHOVEL,
};

// ToolType → BlockType の逆引き（所持数チェックに使用）
export const TOOL_TYPE_TO_ITEM = {
  [ToolType.PICKAXE]:       BlockType.PICKAXE,
  [ToolType.AXE]:           BlockType.AXE,
  [ToolType.SHOVEL]:        BlockType.SHOVEL,
  [ToolType.STONE_PICKAXE]: BlockType.STONE_PICKAXE,
  [ToolType.STONE_AXE]:     BlockType.STONE_AXE,
  [ToolType.STONE_SHOVEL]:  BlockType.STONE_SHOVEL,
  [ToolType.IRON_PICKAXE]:  BlockType.IRON_PICKAXE,
  [ToolType.IRON_AXE]:      BlockType.IRON_AXE,
  [ToolType.IRON_SHOVEL]:   BlockType.IRON_SHOVEL,
};

const TOOL_BREAK_MULTIPLIERS = {
  // 木ツール
  [ToolType.PICKAXE]: {
    [BlockType.STONE]:       2.4,
    [BlockType.COBBLESTONE]: 2.4,
    [BlockType.GLASS]:       1.6,
    [BlockType.IRON_ORE]:    2.0,
  },
  [ToolType.AXE]: {
    [BlockType.WOOD]:           2.2,
    [BlockType.LEAVES]:         1.5,
    [BlockType.PLANK]:          2.0,
    [BlockType.CRAFTING_TABLE]: 2.1,
    [BlockType.CHEST]:          2.0,
  },
  [ToolType.SHOVEL]: {
    [BlockType.GRASS]: 2.0,
    [BlockType.DIRT]:  2.0,
    [BlockType.SAND]:  2.4,
  },
  // 石ツール
  [ToolType.STONE_PICKAXE]: {
    [BlockType.STONE]:       5.0,
    [BlockType.COBBLESTONE]: 5.0,
    [BlockType.GLASS]:       3.5,
    [BlockType.IRON_ORE]:    5.0,
  },
  [ToolType.STONE_AXE]: {
    [BlockType.WOOD]:           4.5,
    [BlockType.LEAVES]:         3.0,
    [BlockType.PLANK]:          4.2,
    [BlockType.CRAFTING_TABLE]: 4.5,
    [BlockType.CHEST]:          4.2,
  },
  [ToolType.STONE_SHOVEL]: {
    [BlockType.GRASS]: 4.0,
    [BlockType.DIRT]:  4.0,
    [BlockType.SAND]:  5.0,
  },
  // 鉄ツール
  [ToolType.IRON_PICKAXE]: {
    [BlockType.STONE]:       9.0,
    [BlockType.COBBLESTONE]: 9.0,
    [BlockType.GLASS]:       6.0,
    [BlockType.IRON_ORE]:    9.0,
  },
  [ToolType.IRON_AXE]: {
    [BlockType.WOOD]:           8.0,
    [BlockType.LEAVES]:         5.0,
    [BlockType.PLANK]:          7.5,
    [BlockType.CRAFTING_TABLE]: 8.0,
    [BlockType.CHEST]:          7.5,
  },
  [ToolType.IRON_SHOVEL]: {
    [BlockType.GRASS]: 7.0,
    [BlockType.DIRT]:  7.0,
    [BlockType.SAND]:  9.0,
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
