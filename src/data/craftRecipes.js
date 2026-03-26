// クラフト・精錬レシピ定義
import { BlockType } from '../blocks.js';

export const CRAFT_RECIPES = [
  {
    id: 'plank_from_wood',
    label: '木材 x1 -> 板材 x4',
    consumes: { [BlockType.WOOD]: 1 },
    produces: { [BlockType.PLANK]: 4 },
  },
  {
    id: 'torch_from_coal_and_plank',
    label: '石炭 x1 + 板材 x1 -> たいまつ x4',
    consumes: { [BlockType.COAL]: 1, [BlockType.PLANK]: 1 },
    produces: { [BlockType.TORCH]: 4 },
  },
  {
    id: 'torch_from_charcoal_and_plank',
    label: '木炭 x1 + 板材 x1 -> たいまつ x4',
    consumes: { [BlockType.CHARCOAL]: 1, [BlockType.PLANK]: 1 },
    produces: { [BlockType.TORCH]: 4 },
  },
  {
    id: 'glass_from_sand',
    label: '砂 x2 -> ガラス x1',
    consumes: { [BlockType.SAND]: 2 },
    produces: { [BlockType.GLASS]: 1 },
  },
  {
    id: 'crafting_table_from_plank',
    label: '板材 x4 -> 作業台 x1',
    consumes: { [BlockType.PLANK]: 4 },
    produces: { [BlockType.CRAFTING_TABLE]: 1 },
  },
  {
    id: 'repair_table_from_plank',
    label: '板材 x4 -> 修理台 x1',
    consumes: { [BlockType.PLANK]: 4 },
    produces: { [BlockType.REPAIR_TABLE]: 1 },
  },
  {
    id: 'enchanting_table_from_materials',
    label: 'ダイヤ x2 + 石板 x4 -> エンチャント台 x1',
    consumes: { [BlockType.DIAMOND]: 2, [BlockType.COBBLESTONE]: 4 },
    produces: { [BlockType.ENCHANTING_TABLE]: 1 },
  },
  {
    id: 'chest_from_plank',
    label: '板材 x8 -> チェスト x1',
    consumes: { [BlockType.PLANK]: 8 },
    produces: { [BlockType.CHEST]: 1 },
  },
  // 木ツール
  {
    id: 'pickaxe_from_plank',
    label: '板材 x2 -> ツルハシ x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.PLANK]: 2 },
    produces: { [BlockType.PICKAXE]: 1 },
  },
  {
    id: 'axe_from_plank',
    label: '板材 x2 -> 斧 x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.PLANK]: 2 },
    produces: { [BlockType.AXE]: 1 },
  },
  {
    id: 'shovel_from_plank',
    label: '板材 x2 -> シャベル x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.PLANK]: 2 },
    produces: { [BlockType.SHOVEL]: 1 },
  },
  // 木ツール修理レシピ（板材 x1 消費で耐久値 +30）
  {
    id: 'repair_pickaxe',
    label: 'ツルハシ（木）修理（板材 x1 -> 耐久 +30）',
    requiresRepairTable: true,
    consumes: { [BlockType.PICKAXE]: 1, [BlockType.PLANK]: 1 },
    produces: { [BlockType.PICKAXE]: 1 },
    repairTool: 'pickaxe',
    repairAmount: 30,
  },
  {
    id: 'repair_axe',
    label: '斧（木）修理（板材 x1 -> 耐久 +30）',
    requiresRepairTable: true,
    consumes: { [BlockType.AXE]: 1, [BlockType.PLANK]: 1 },
    produces: { [BlockType.AXE]: 1 },
    repairTool: 'axe',
    repairAmount: 30,
  },
  {
    id: 'repair_shovel',
    label: 'シャベル（木）修理（板材 x1 -> 耐久 +30）',
    requiresRepairTable: true,
    consumes: { [BlockType.SHOVEL]: 1, [BlockType.PLANK]: 1 },
    produces: { [BlockType.SHOVEL]: 1 },
    repairTool: 'shovel',
    repairAmount: 30,
  },
  // 石ツールレシピ（丸石 x2）
  {
    id: 'stone_pickaxe',
    label: '丸石 x2 -> ツルハシ（石） x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.COBBLESTONE]: 2 },
    produces: { [BlockType.STONE_PICKAXE]: 1 },
  },
  {
    id: 'stone_axe',
    label: '丸石 x2 -> 斧（石） x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.COBBLESTONE]: 2 },
    produces: { [BlockType.STONE_AXE]: 1 },
  },
  {
    id: 'stone_shovel',
    label: '丸石 x2 -> シャベル（石） x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.COBBLESTONE]: 2 },
    produces: { [BlockType.STONE_SHOVEL]: 1 },
  },
  // 石ツール修理レシピ（丸石 x1 消費で耐久値 +66）
  {
    id: 'repair_stone_pickaxe',
    label: 'ツルハシ（石）修理（丸石 x1 -> 耐久 +66）',
    requiresRepairTable: true,
    consumes: { [BlockType.STONE_PICKAXE]: 1, [BlockType.COBBLESTONE]: 1 },
    produces: { [BlockType.STONE_PICKAXE]: 1 },
    repairTool: 'stone_pickaxe',
    repairAmount: 66,
  },
  {
    id: 'repair_stone_axe',
    label: '斧（石）修理（丸石 x1 -> 耐久 +66）',
    requiresRepairTable: true,
    consumes: { [BlockType.STONE_AXE]: 1, [BlockType.COBBLESTONE]: 1 },
    produces: { [BlockType.STONE_AXE]: 1 },
    repairTool: 'stone_axe',
    repairAmount: 66,
  },
  {
    id: 'repair_stone_shovel',
    label: 'シャベル（石）修理（丸石 x1 -> 耐久 +66）',
    requiresRepairTable: true,
    consumes: { [BlockType.STONE_SHOVEL]: 1, [BlockType.COBBLESTONE]: 1 },
    produces: { [BlockType.STONE_SHOVEL]: 1 },
    repairTool: 'stone_shovel',
    repairAmount: 66,
  },
  // 鉄ツールレシピ（鉄インゴット x2）
  {
    id: 'iron_pickaxe',
    label: '鉄インゴット x2 -> ツルハシ（鉄） x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.IRON_INGOT]: 2 },
    produces: { [BlockType.IRON_PICKAXE]: 1 },
  },
  {
    id: 'iron_axe',
    label: '鉄インゴット x2 -> 斧（鉄） x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.IRON_INGOT]: 2 },
    produces: { [BlockType.IRON_AXE]: 1 },
  },
  {
    id: 'iron_shovel',
    label: '鉄インゴット x2 -> シャベル（鉄） x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.IRON_INGOT]: 2 },
    produces: { [BlockType.IRON_SHOVEL]: 1 },
  },
  // 鉄ツール修理レシピ（鉄インゴット x1 消費で耐久値 +125）
  {
    id: 'repair_iron_pickaxe',
    label: 'ツルハシ（鉄）修理（鉄インゴット x1 -> 耐久 +125）',
    requiresRepairTable: true,
    consumes: { [BlockType.IRON_PICKAXE]: 1, [BlockType.IRON_INGOT]: 1 },
    produces: { [BlockType.IRON_PICKAXE]: 1 },
    repairTool: 'iron_pickaxe',
    repairAmount: 125,
  },
  {
    id: 'repair_iron_axe',
    label: '斧（鉄）修理（鉄インゴット x1 -> 耐久 +125）',
    requiresRepairTable: true,
    consumes: { [BlockType.IRON_AXE]: 1, [BlockType.IRON_INGOT]: 1 },
    produces: { [BlockType.IRON_AXE]: 1 },
    repairTool: 'iron_axe',
    repairAmount: 125,
  },
  {
    id: 'repair_iron_shovel',
    label: 'シャベル（鉄）修理（鉄インゴット x1 -> 耐久 +125）',
    requiresRepairTable: true,
    consumes: { [BlockType.IRON_SHOVEL]: 1, [BlockType.IRON_INGOT]: 1 },
    produces: { [BlockType.IRON_SHOVEL]: 1 },
    repairTool: 'iron_shovel',
    repairAmount: 125,
  },
  // かまどクラフト（丸石 x4）
  {
    id: 'furnace_from_cobblestone',
    label: '丸石 x4 -> かまど x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.COBBLESTONE]: 4 },
    produces: { [BlockType.FURNACE]: 1 },
  },
  // 弓クラフト（板材 x2 + 糸 x1 → 弓 x1）
  {
    id: 'bow_from_plank',
    label: '板材 x2 + 糸 x1 -> 弓 x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.PLANK]: 2, [BlockType.STRING]: 1 },
    produces: { [BlockType.BOW]: 1 },
  },
  // 矢クラフト（骨 x1 -> 矢 x4）
  {
    id: 'arrow_from_bone',
    label: '骨 x1 -> 矢 x4',
    requiresCraftingTable: true,
    consumes: { [BlockType.BONE]: 1 },
    produces: { [BlockType.ARROW]: 4 },
  },
  // きのこシチュー（キノコ x2 -> きのこシチュー x1）
  {
    id: 'mushroom_stew',
    label: 'キノコ x2 -> きのこシチュー x1',
    consumes: { [BlockType.MUSHROOM]: 2 },
    produces: { [BlockType.MUSHROOM_STEW]: 1 },
  },
  // アカシア板材（アカシア木材 x1 -> 板材 x4）
  {
    id: 'plank_from_acacia',
    label: 'アカシア木材 x1 -> 板材 x4',
    consumes: { [BlockType.ACACIA_WOOD]: 1 },
    produces: { [BlockType.PLANK]: 4 },
  },
  // 桜板材（桜木材 x1 -> 板材 x4）
  {
    id: 'plank_from_cherry',
    label: '桜木材 x1 -> 板材 x4',
    consumes: { [BlockType.CHERRY_WOOD]: 1 },
    produces: { [BlockType.PLANK]: 4 },
  },
  // ダイヤモンドツールレシピ（ダイヤモンド x2）
  {
    id: 'diamond_pickaxe',
    label: 'ダイヤモンド x2 -> ツルハシ（ダイヤ） x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.DIAMOND]: 2 },
    produces: { [BlockType.DIAMOND_PICKAXE]: 1 },
  },
  {
    id: 'diamond_axe',
    label: 'ダイヤモンド x2 -> 斧（ダイヤ） x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.DIAMOND]: 2 },
    produces: { [BlockType.DIAMOND_AXE]: 1 },
  },
  {
    id: 'diamond_shovel',
    label: 'ダイヤモンド x2 -> シャベル（ダイヤ） x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.DIAMOND]: 2 },
    produces: { [BlockType.DIAMOND_SHOVEL]: 1 },
  },
  // ダイヤモンドツール修理レシピ（ダイヤモンド x1 -> 耐久 +200）
  {
    id: 'repair_diamond_pickaxe',
    label: 'ツルハシ（ダイヤ）修理（ダイヤ x1 -> 耐久 +200）',
    requiresRepairTable: true,
    consumes: { [BlockType.DIAMOND_PICKAXE]: 1, [BlockType.DIAMOND]: 1 },
    produces: { [BlockType.DIAMOND_PICKAXE]: 1 },
    repairTool: 'diamond_pickaxe',
    repairAmount: 200,
  },
  {
    id: 'repair_diamond_axe',
    label: '斧（ダイヤ）修理（ダイヤ x1 -> 耐久 +200）',
    requiresRepairTable: true,
    consumes: { [BlockType.DIAMOND_AXE]: 1, [BlockType.DIAMOND]: 1 },
    produces: { [BlockType.DIAMOND_AXE]: 1 },
    repairTool: 'diamond_axe',
    repairAmount: 200,
  },
  {
    id: 'repair_diamond_shovel',
    label: 'シャベル（ダイヤ）修理（ダイヤ x1 -> 耐久 +200）',
    requiresRepairTable: true,
    consumes: { [BlockType.DIAMOND_SHOVEL]: 1, [BlockType.DIAMOND]: 1 },
    produces: { [BlockType.DIAMOND_SHOVEL]: 1 },
    repairTool: 'diamond_shovel',
    repairAmount: 200,
  },
  // ---- 防具クラフトレシピ（作業台必要）----
  // 革防具
  {
    id: 'leather_helmet',
    label: '革 x5 -> 革のヘルメット x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.LEATHER]: 5 },
    produces: { [BlockType.LEATHER_HELMET]: 1 },
  },
  {
    id: 'leather_chestplate',
    label: '革 x8 -> 革のチェストプレート x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.LEATHER]: 8 },
    produces: { [BlockType.LEATHER_CHESTPLATE]: 1 },
  },
  {
    id: 'leather_leggings',
    label: '革 x7 -> 革のレギンス x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.LEATHER]: 7 },
    produces: { [BlockType.LEATHER_LEGGINGS]: 1 },
  },
  {
    id: 'leather_boots',
    label: '革 x4 -> 革のブーツ x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.LEATHER]: 4 },
    produces: { [BlockType.LEATHER_BOOTS]: 1 },
  },
  // 鉄防具
  {
    id: 'iron_helmet',
    label: '鉄インゴット x5 -> 鉄のヘルメット x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.IRON_INGOT]: 5 },
    produces: { [BlockType.IRON_HELMET]: 1 },
  },
  {
    id: 'iron_chestplate',
    label: '鉄インゴット x8 -> 鉄のチェストプレート x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.IRON_INGOT]: 8 },
    produces: { [BlockType.IRON_CHESTPLATE]: 1 },
  },
  {
    id: 'iron_leggings',
    label: '鉄インゴット x7 -> 鉄のレギンス x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.IRON_INGOT]: 7 },
    produces: { [BlockType.IRON_LEGGINGS]: 1 },
  },
  {
    id: 'iron_boots',
    label: '鉄インゴット x4 -> 鉄のブーツ x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.IRON_INGOT]: 4 },
    produces: { [BlockType.IRON_BOOTS]: 1 },
  },
  // ダイヤモンド防具
  {
    id: 'diamond_helmet',
    label: 'ダイヤモンド x5 -> ダイヤのヘルメット x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.DIAMOND]: 5 },
    produces: { [BlockType.DIAMOND_HELMET]: 1 },
  },
  {
    id: 'diamond_chestplate',
    label: 'ダイヤモンド x8 -> ダイヤのチェストプレート x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.DIAMOND]: 8 },
    produces: { [BlockType.DIAMOND_CHESTPLATE]: 1 },
  },
  {
    id: 'diamond_leggings',
    label: 'ダイヤモンド x7 -> ダイヤのレギンス x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.DIAMOND]: 7 },
    produces: { [BlockType.DIAMOND_LEGGINGS]: 1 },
  },
  {
    id: 'diamond_boots',
    label: 'ダイヤモンド x4 -> ダイヤのブーツ x1',
    requiresCraftingTable: true,
    consumes: { [BlockType.DIAMOND]: 4 },
    produces: { [BlockType.DIAMOND_BOOTS]: 1 },
  },
];

// 精錬の燃料として使えるアイテム（いずれか1つを消費）
export const SMELT_FUELS = [
  { type: BlockType.COAL,         count: 1 }, // 石炭: 効率的な燃料
  { type: BlockType.CHARCOAL,     count: 1 }, // 木炭: 石炭と同等
  { type: BlockType.WOOD,         count: 2 }, // 木材: 2本で1回分
  { type: BlockType.PLANK,        count: 2 }, // 板材: 2枚で1回分
  { type: BlockType.ACACIA_WOOD,  count: 2 }, // アカシア木材: 2本で1回分
  { type: BlockType.CHERRY_WOOD,  count: 2 }, // 桜木材: 2本で1回分
];

// 精錬レシピ（かまどで使用）
export const SMELT_RECIPES = [
  {
    id: 'smelt_iron_ore',
    label: '鉄鉱石 -> 鉄インゴット',
    inputType: BlockType.IRON_ORE,
    inputCount: 1,
    outputType: BlockType.IRON_INGOT,
    outputCount: 1,
  },
  {
    id: 'smelt_gold_ore',
    label: '金鉱石 -> 金インゴット',
    inputType: BlockType.GOLD_ORE,
    inputCount: 1,
    outputType: BlockType.GOLD_INGOT,
    outputCount: 1,
  },
  {
    id: 'smelt_beef',
    label: '生肉 -> 焼き肉',
    inputType: BlockType.BEEF,
    inputCount: 1,
    outputType: BlockType.COOKED_BEEF,
    outputCount: 1,
  },
  {
    id: 'smelt_pork',
    label: '豚肉 -> 焼き豚肉',
    inputType: BlockType.PORK_CHOP,
    inputCount: 1,
    outputType: BlockType.COOKED_PORK,
    outputCount: 1,
  },
  {
    id: 'smelt_chicken',
    label: '生チキン -> 焼きチキン',
    inputType: BlockType.CHICKEN,
    inputCount: 1,
    outputType: BlockType.COOKED_CHICKEN,
    outputCount: 1,
  },
  {
    id: 'smelt_wood_to_charcoal',
    label: '木材 -> 木炭',
    inputType: BlockType.WOOD,
    inputCount: 1,
    outputType: BlockType.CHARCOAL,
    outputCount: 1,
  },
  {
    id: 'smelt_jungle_wood_to_charcoal',
    label: 'ジャングル木材 -> 木炭',
    inputType: BlockType.JUNGLE_WOOD,
    inputCount: 1,
    outputType: BlockType.CHARCOAL,
    outputCount: 1,
  },
  {
    id: 'smelt_acacia_wood_to_charcoal',
    label: 'アカシア木材 -> 木炭',
    inputType: BlockType.ACACIA_WOOD,
    inputCount: 1,
    outputType: BlockType.CHARCOAL,
    outputCount: 1,
  },
  {
    id: 'smelt_cherry_wood_to_charcoal',
    label: '桜木材 -> 木炭',
    inputType: BlockType.CHERRY_WOOD,
    inputCount: 1,
    outputType: BlockType.CHARCOAL,
    outputCount: 1,
  },
];
