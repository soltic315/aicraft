import { create } from 'zustand';
import { ToolType, isToolType } from '../tools.js';

export const useToolStore = create((set) => ({
  selectedTool: ToolType.PICKAXE,

  setTool(toolType) {
    if (!isToolType(toolType)) return;
    set({ selectedTool: toolType });
  },

  reset() {
    set({ selectedTool: ToolType.PICKAXE });
  },
}));
