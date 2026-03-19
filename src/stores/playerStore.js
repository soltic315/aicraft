import { create } from 'zustand';

export const usePlayerStore = create((set) => ({
  health: 20,
  maxHealth: 20,
  position: { x: 0, y: 0, z: 0 },
  onGround: false,

  syncFromPlayer(player) {
    set({
      health: player.health,
      maxHealth: player.maxHealth,
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
      },
      onGround: player.onGround,
    });
  },
}));
