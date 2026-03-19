import { h } from 'preact';
import { useUIStore } from '../../stores/uiStore.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { CRAFT_RECIPES } from '../../config.js';

export function CraftPanel() {
  const open = useUIStore((s) => s.craftOpen);
  const counts = useInventoryStore((s) => s.counts);

  if (!open) return null;

  const hasIngredients = (recipe) => {
    return Object.entries(recipe.consumes).every(
      ([type, amount]) => (counts[Number(type)] ?? 0) >= amount,
    );
  };

  const available = CRAFT_RECIPES.filter(hasIngredients).length;

  return (
    <div id="craft-panel" style={{ display: 'block' }} aria-label="クラフトパネル">
      <h2>クラフト（C で表示切替）</h2>
      <div id="craft-list">
        {CRAFT_RECIPES.map((recipe) => (
          <div key={recipe.id} class="craft-row">
            <span>{recipe.label}</span>
            <button
              type="button"
              disabled={!hasIngredients(recipe)}
              onClick={() => {
                const inv = useInventoryStore.getState();
                if (inv.craftRecipe(recipe)) {
                  window.__aicraft?.sound?.playPlace();
                  useUIStore.getState().showFeedback(`クラフト成功: ${recipe.label}`, 900);
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
      <p id="craft-hint" class="craft-hint">
        {available > 0
          ? `作成可能レシピ: ${available} 件`
          : '素材が足りるレシピのみクラフトできます。'}
      </p>
    </div>
  );
}
