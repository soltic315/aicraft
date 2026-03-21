import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { useAchievementStore } from '../../stores/achievementStore.js';

export function AchievementToast() {
  const [visible, setVisible] = useState(false);
  const [achievement, setAchievement] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return useAchievementStore.subscribe((state) => {
      const { pendingToast } = state;
      if (!pendingToast) return;

      // 前のタイマーをキャンセル
      if (timerRef.current) clearTimeout(timerRef.current);

      setAchievement(pendingToast);
      setVisible(true);
      useAchievementStore.getState().clearToast();

      timerRef.current = setTimeout(() => {
        setVisible(false);
        timerRef.current = null;
      }, 4000);
    });
  }, []);

  if (!achievement) return null;

  return (
    <div
      id="achievement-toast"
      class={visible ? 'achievement-visible' : 'achievement-hidden'}
      aria-live="polite"
    >
      <div id="achievement-toast-inner">
        <span id="achievement-icon">{achievement.icon}</span>
        <div id="achievement-text">
          <div id="achievement-title-label">実績解除！</div>
          <div id="achievement-name">{achievement.title}</div>
          <div id="achievement-desc">{achievement.desc}</div>
        </div>
      </div>
    </div>
  );
}
