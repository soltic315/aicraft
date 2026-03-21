import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { useDraggable } from '../hooks/useDraggable.js';
import { useUIStore } from '../../stores/uiStore.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { SMELT_RECIPES, SMELT_FUELS } from '../../config.js';
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

  // 使用可能な燃料を探す（最初にマッチしたものを使用）
  const findAvailableFuel = () =>
    SMELT_FUELS.find((f) => getCount(f.type) >= f.count) ?? null;

  const canSmelt = (recipe) =>
    getCount(recipe.inputType) >= recipe.inputCount && findAvailableFuel() !== null;

  const handleSmelt = (recipe) => {
    const inv = useInventoryStore.getState();
    // 最新のストア状態で素材・燃料を確認（古いクロージャの slots を使わない）
    const freshSlots = inv.slots;
    const freshGetCount = (type) => freshSlots.reduce((sum, s) => (s.type === type ? sum + s.count : sum), 0);
    const freshFuel = SMELT_FUELS.find((f) => freshGetCount(f.type) >= f.count) ?? null;
    if (!freshFuel || freshGetCount(recipe.inputType) < recipe.inputCount) {
      window.__aicraft?.sound?.playError();
      useUIStore.getState().showFeedback('精錬失敗: 素材または燃料が不足しています');
      return;
    }
    // 素材と燃料を消費（両方成功した場合のみ成果物を追加）
    const inputOk = inv.consumeItem(recipe.inputType, recipe.inputCount);
    const fuelOk = inv.consumeItem(freshFuel.type, freshFuel.count);
    if (!inputOk || !fuelOk) {
      window.__aicraft?.sound?.playError();
      useUIStore.getState().showFeedback('精錬失敗: 素材または燃料が不足しています');
      return;
    }
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
                （燃料: 石炭 x1 / 木材 x2 / 板材 x2）
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
