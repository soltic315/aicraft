import { create } from 'zustand';

// レベルごとの累積必要XP
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 1500, 2100, 2800, 3600, 4500];
export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

function calcLevel(xp) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return Math.min(level, MAX_LEVEL);
}

function calcProgress(xp) {
  const level = calcLevel(xp);
  if (level >= MAX_LEVEL) return 1;
  const current = LEVEL_THRESHOLDS[level - 1];
  const next = LEVEL_THRESHOLDS[level];
  return (xp - current) / (next - current);
}

export const useXpStore = create((set, get) => ({
  xp: 0,
  level: 1,
  progress: 0, // 現在レベル内の進捗 0~1

  addXp(amount) {
    const newXp = Math.max(0, get().xp + amount);
    const newLevel = calcLevel(newXp);
    const levelUp = newLevel > get().level;
    set({ xp: newXp, level: newLevel, progress: calcProgress(newXp) });
    return { levelUp, newLevel };
  },

  restoreFromSave(savedXp) {
    if (!Number.isFinite(savedXp) || savedXp < 0) return;
    const level = calcLevel(savedXp);
    set({ xp: savedXp, level, progress: calcProgress(savedXp) });
  },

  reset() {
    set({ xp: 0, level: 1, progress: 0 });
  },
}));
