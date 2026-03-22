import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { useEnchantmentStore, ENCHANT_TYPES, getAvailableEnchants, getEnchantCost } from '../../stores/enchantmentStore.js';
import { useInventoryStore } from '../../stores/inventoryStore.js';
import { useXpStore } from '../../stores/xpStore.js';

// ホットバー選択中アイテムのスロットキーを返す
function getHotbarSlotKey() {
  const inv = useInventoryStore.getState();
  return `slot_${inv.selectedSlot}`;
}

// 安定した空配列参照（毎回 [] を返すと zustand の参照等価チェックが無限ループを引き起こす）
const EMPTY_ENCHANTS = [];

export function EnchantPanel() {
  const enchantPanelOpen = useEnchantmentStore(s => s.enchantPanelOpen);
  const closePanel = useEnchantmentStore(s => s.closeEnchantPanel);
  const applyEnchant = useEnchantmentStore(s => s.applyEnchant);
  const xp = useXpStore(s => s.xp);
  const addXp = useXpStore(s => s.addXp);

  const inv = useInventoryStore(s => s.slots);
  const selectedSlot = useInventoryStore(s => s.selectedSlot);
  const slotKey = `slot_${selectedSlot}`;
  const currentItem = inv[selectedSlot];

  const currentEnchants = useEnchantmentStore(s => s.enchantments[slotKey] || EMPTY_ENCHANTS);

  const [feedback, setFeedback] = useState('');

  const availableTypes = currentItem ? getAvailableEnchants(currentItem.type) : [];

  const handleApply = useCallback((type, level) => {
    const cost = getEnchantCost(type, level);
    if (xp < cost) {
      setFeedback(`XPが足りません（必要: ${cost} XP）`);
      setTimeout(() => setFeedback(''), 2000);
      return;
    }
    applyEnchant(slotKey, type, level);
    addXp(-cost);
    setFeedback(`${ENCHANT_TYPES[type.toUpperCase()]?.name || type} Lv${level} を付与しました！`);
    setTimeout(() => setFeedback(''), 2500);
  }, [xp, slotKey, applyEnchant, addXp]);

  if (!enchantPanelOpen) return null;

  return (
    <div id="enchant-panel">
      <div class="enchant-header">
        <span class="enchant-title">✨ エンチャント台</span>
        <button class="panel-close-btn" onClick={closePanel}>✕</button>
      </div>

      <div class="enchant-xp-bar">
        <span class="enchant-xp-label">所持XP</span>
        <span class="enchant-xp-value">{xp} XP</span>
      </div>

      {!currentItem ? (
        <div class="enchant-empty">
          ホットバーにツール・防具・武器を装備してください
        </div>
      ) : availableTypes.length === 0 ? (
        <div class="enchant-empty">
          このアイテムはエンチャントできません
        </div>
      ) : (
        <div class="enchant-item-info">
          <div class="enchant-current-item">
            対象: <strong>{currentItem.name || 'アイテム'}</strong>
          </div>

          {/* 現在のエンチャント */}
          {currentEnchants.length > 0 && (
            <div class="enchant-current-list">
              <div class="enchant-section-title">付与済み</div>
              {currentEnchants.map(e => {
                const def = ENCHANT_TYPES[e.type.toUpperCase()];
                return (
                  <div key={e.type} class="enchant-badge" style={{ borderColor: def?.color }}>
                    <span>{def?.icon} {def?.name}</span>
                    <span class="enchant-level">Lv {e.level}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 適用可能なエンチャント */}
          <div class="enchant-section-title">エンチャント一覧</div>
          <div class="enchant-list">
            {availableTypes.map(type => {
              const def = ENCHANT_TYPES[type.toUpperCase()];
              if (!def) return null;
              const currentLevel = currentEnchants.find(e => e.type === type)?.level || 0;

              return (
                <div key={type} class="enchant-row">
                  <div class="enchant-row-info">
                    <span class="enchant-icon" style={{ color: def.color }}>{def.icon}</span>
                    <span class="enchant-name">{def.name}</span>
                    {currentLevel > 0 && (
                      <span class="enchant-current-lv" style={{ color: def.color }}>Lv {currentLevel}</span>
                    )}
                  </div>
                  <div class="enchant-level-btns">
                    {Array.from({ length: def.maxLevel }, (_, i) => i + 1).map(lv => {
                      const cost = getEnchantCost(type, lv);
                      const canAfford = xp >= cost;
                      const isActive = currentLevel === lv;
                      return (
                        <button
                          key={lv}
                          class={`enchant-lv-btn${isActive ? ' active' : ''}${!canAfford ? ' unaffordable' : ''}`}
                          onClick={() => handleApply(type, lv)}
                          title={`Lv${lv}: ${cost} XP消費`}
                          style={{ borderColor: isActive ? def.color : undefined }}
                        >
                          Lv{lv}
                          <span class="enchant-cost">{cost}xp</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {feedback && (
        <div class={`enchant-feedback${feedback.includes('足り') ? ' error' : ' success'}`}>
          {feedback}
        </div>
      )}
    </div>
  );
}
