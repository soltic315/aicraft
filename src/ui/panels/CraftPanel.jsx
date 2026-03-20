import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { useDraggable } from '../hooks/useDraggable.js';
import { useUIStore } from '../../stores/uiStore.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { useDurabilityStore } from '../../stores/durabilityStore.js';
import { CRAFT_RECIPES } from '../../config.js';

export function CraftPanel() {
  const craftOpen = useUIStore((s) => s.craftOpen);
  const craftMode = useUIStore((s) => s.craftMode);
  const slots = useInventoryStore((s) => s.slots);
  const { panelRef, dragStyle, onHeaderMouseDown } = useDraggable();

  // Tab / ESC で全パネル閉じる
  useEffect(() => {
    if (!craftOpen) return;
    const handleKey = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyC') {
        e.preventDefault();
        e.stopPropagation();
        useUIStore.getState().toggleCraft();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [craftOpen]);

  if (!craftOpen) return null;

  const getCount = (type) => slots.reduce((sum, s) => (s.type === type ? sum + s.count : sum), 0);
  const hasIngredients = (recipe) =>
    Object.entries(recipe.consumes).every(([type, amount]) => getCount(Number(type)) >= amount);
  const recipes = craftMode === 'crafting_table'
    ? CRAFT_RECIPES.filter((recipe) => recipe.requiresCraftingTable)
    : craftMode === 'repair_table'
      ? CRAFT_RECIPES.filter((recipe) => recipe.requiresRepairTable)
      : CRAFT_RECIPES.filter((recipe) => !recipe.requiresCraftingTable && !recipe.requiresRepairTable);
  const available = recipes.filter(hasIngredients).length;

  const headerText = craftMode === 'crafting_table'
    ? '作業台クラフト（作業台専用）'
    : craftMode === 'repair_table'
      ? '修理台クラフト（修理専用）'
      : 'クラフト（常時クラフト）';

  return (
    <div id="craft-panel-window" ref={panelRef} style={dragStyle}>
      <div class="inv-header" onMouseDown={onHeaderMouseDown} style={{ cursor: 'grab' }}>
        <span>{headerText}（作成可能: {available} 件）</span>
        <button class="inv-close-btn" onClick={() => useUIStore.getState().closeCraftPanel()}>✕</button>
      </div>
      <div class="inv-craft-list">
        {recipes.map((recipe) => (
          <div key={recipe.id} class="craft-row">
            <span>{recipe.label}</span>
            <button
              type="button"
              disabled={!hasIngredients(recipe)}
              onClick={() => {
                const inv = useInventoryStore.getState();
                if (inv.craftRecipe(recipe)) {
                  if (recipe.repairTool) {
                    useDurabilityStore.getState().repair(recipe.repairTool, recipe.repairAmount);
                    useUIStore.getState().showFeedback(`修理成功: ${recipe.label}`, 900);
                  } else {
                    useUIStore.getState().showFeedback(`クラフト成功: ${recipe.label}`, 900);
                  }
                  window.__aicraft?.sound?.playPlace();
                } else {
                  window.__aicraft?.sound?.playError();
                  useUIStore.getState().showFeedback('クラフト失敗: 素材が不足しています');
                }
              }}
            >
              作成
            </button>
          </div>
        ))}
      </div>
      <div class="inv-hint-bar">
        <span>C / ESC: 閉じる</span>
      </div>
    </div>
  );
}
