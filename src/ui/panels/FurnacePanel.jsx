import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { useDraggable } from '../hooks/useDraggable.js';
import { useUIStore } from '../../stores/uiStore.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { SMELT_RECIPES } from '../../config.js';
import { BLOCK_NAMES } from '../../blocks.js';

export function FurnacePanel() {
  const furnaceOpen = useUIStore((s) => s.furnaceOpen);
  const slots = useInventoryStore((s) => s.slots);
  const { panelRef, dragStyle, onHeaderMouseDown } = useDraggable();

  // ESC で閉じる
  useEffect(() => {
    if (!furnaceOpen) return;
    const handleKey = (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        useUIStore.getState().closeFurnacePanel();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [furnaceOpen]);

  if (!furnaceOpen) return null;

  const getCount = (type) =>
    slots.reduce((sum, s) => (s.type === type ? sum + s.count : sum), 0);

  const canSmelt = (recipe) =>
    getCount(recipe.inputType) >= recipe.inputCount &&
    getCount(recipe.fuelType) >= recipe.fuelCount;

  const handleSmelt = (recipe) => {
    const inv = useInventoryStore.getState();
    // 素材とその確認
    if (!canSmelt(recipe)) {
      window.__aicraft?.sound?.playError();
      useUIStore.getState().showFeedback('精錬失敗: 素材または燃料が不足しています');
      return;
    }
    // 素材消費
    inv.consumeItem(recipe.inputType, recipe.inputCount);
    inv.consumeItem(recipe.fuelType, recipe.fuelCount);
    // 成果物追加
    inv.addItem(recipe.outputType, recipe.outputCount);
    window.__aicraft?.sound?.playPlace();
    useUIStore.getState().showFeedback(
      `精錬成功: ${BLOCK_NAMES[recipe.outputType] ?? '?'} x${recipe.outputCount}`,
      900
    );
  };

  const available = SMELT_RECIPES.filter(canSmelt).length;

  return (
    <div id="furnace-panel-window" ref={panelRef} style={dragStyle}>
      <div class="inv-header" onMouseDown={onHeaderMouseDown} style={{ cursor: 'grab' }}>
        <span>かまど（精錬可能: {available} 件）</span>
        <button class="inv-close-btn" onClick={() => useUIStore.getState().closeFurnacePanel()}>✕</button>
      </div>
      <div class="inv-craft-list">
        {SMELT_RECIPES.map((recipe) => (
          <div key={recipe.id} class="craft-row">
            <span>
              {recipe.label}
              <span class="smelt-fuel-hint">
                （燃料: {BLOCK_NAMES[recipe.fuelType] ?? '?'} x{recipe.fuelCount}）
              </span>
            </span>
            <button
              type="button"
              disabled={!canSmelt(recipe)}
              onClick={() => handleSmelt(recipe)}
            >
              精錬
            </button>
          </div>
        ))}
      </div>
      <div class="inv-hint-bar">
        <span>ESC: 閉じる</span>
      </div>
    </div>
  );
}
