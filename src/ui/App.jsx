import { h } from 'preact';
import { useUIStore } from '../stores/uiStore.js';
import { useEnchantmentStore } from '../stores/enchantmentStore.js';
import { StartScreen } from './screens/StartScreen.jsx';
import { LoadingScreen } from './screens/LoadingScreen.jsx';
import { DeathScreen } from './screens/DeathScreen.jsx';
import { Hotbar } from './hotbar/Hotbar.jsx';
import { HealthDisplay } from './health/HealthDisplay.jsx';
import { HungerDisplay } from './health/HungerDisplay.jsx';
import { ArmorDisplay } from './health/ArmorDisplay.jsx';
import { XpDisplay } from './health/XpDisplay.jsx';
import { InfoOverlay } from './info/InfoOverlay.jsx';
import { TimeDisplay } from './info/TimeDisplay.jsx';
import { SettingsPanel } from './panels/SettingsPanel.jsx';
import { CraftPanel } from './panels/CraftPanel.jsx';
import { ChestPanel } from './panels/ChestPanel.jsx';
import { FurnacePanel } from './panels/FurnacePanel.jsx';
import { InventoryPanel } from './panels/InventoryPanel.jsx';
import { EnchantPanel } from './panels/EnchantPanel.jsx';
import { BreakProgress } from './overlays/BreakProgress.jsx';
import { ActionFeedback } from './overlays/ActionFeedback.jsx';
import { WaterOverlay } from './overlays/WaterOverlay.jsx';
import { HitOverlay } from './overlays/HitOverlay.jsx';
import { KeyHints } from './overlays/KeyHints.jsx';
import { ResumeHint } from './overlays/ResumeHint.jsx';
import { AchievementToast } from './overlays/AchievementToast.jsx';
import { MiniMap } from './overlays/MiniMap.jsx';
import { TutorialOverlay } from './overlays/TutorialOverlay.jsx';

export function App() {
  const anyPanelOpen = useUIStore((s) =>
    s.inventoryOpen || s.craftOpen || s.settingsOpen || s.chestOpen || s.furnaceOpen
  );
  const enchantOpen = useEnchantmentStore(s => s.enchantPanelOpen);

  const closeAll = () => {
    useUIStore.setState({ settingsOpen: false, inventoryOpen: false, craftOpen: false, chestOpen: false, furnaceOpen: false });
    useEnchantmentStore.getState().closeEnchantPanel();
  };

  return (
    <>
      {(anyPanelOpen || enchantOpen) && <div class="panel-backdrop" onClick={closeAll} />}
      <StartScreen />
      <LoadingScreen />
      <DeathScreen />
      <WaterOverlay />
      <HitOverlay />
      <ResumeHint />
      <BreakProgress />
      <ActionFeedback />
      <InfoOverlay />
      <TimeDisplay />
      <KeyHints />
      <MiniMap />
      <HealthDisplay />
      <HungerDisplay />
      <ArmorDisplay />
      <XpDisplay />
      <SettingsPanel />
      <InventoryPanel />
      <CraftPanel />
      <ChestPanel />
      <FurnacePanel />
      <EnchantPanel />
      <Hotbar />
      <AchievementToast />
      <TutorialOverlay />
    </>
  );
}
