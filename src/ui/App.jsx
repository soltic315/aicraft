import { h } from 'preact';
import { useUIStore } from '../stores/uiStore.js';
import { StartScreen } from './screens/StartScreen.jsx';
import { LoadingScreen } from './screens/LoadingScreen.jsx';
import { DeathScreen } from './screens/DeathScreen.jsx';
import { Hotbar } from './hotbar/Hotbar.jsx';
import { HealthDisplay } from './health/HealthDisplay.jsx';
import { HungerDisplay } from './health/HungerDisplay.jsx';
import { InfoOverlay } from './info/InfoOverlay.jsx';
import { SettingsPanel } from './panels/SettingsPanel.jsx';
import { CraftPanel } from './panels/CraftPanel.jsx';
import { ChestPanel } from './panels/ChestPanel.jsx';
import { FurnacePanel } from './panels/FurnacePanel.jsx';
import { InventoryPanel } from './panels/InventoryPanel.jsx';
import { BreakProgress } from './overlays/BreakProgress.jsx';
import { ActionFeedback } from './overlays/ActionFeedback.jsx';
import { WaterOverlay } from './overlays/WaterOverlay.jsx';
import { HitOverlay } from './overlays/HitOverlay.jsx';
import { KeyHints } from './overlays/KeyHints.jsx';
export function App() {
  const anyPanelOpen = useUIStore((s) =>
    s.inventoryOpen || s.craftOpen || s.settingsOpen || s.chestOpen || s.furnaceOpen
  );
  const closeAll = () => {
    useUIStore.setState({ settingsOpen: false, inventoryOpen: false, craftOpen: false, chestOpen: false, furnaceOpen: false });
  };

  return (
    <>
      {anyPanelOpen && <div class="panel-backdrop" onClick={closeAll} />}
      <StartScreen />
      <LoadingScreen />
      <DeathScreen />
      <WaterOverlay />
      <HitOverlay />
      <BreakProgress />
      <ActionFeedback />
      <InfoOverlay />
      <KeyHints />
      <HealthDisplay />
      <HungerDisplay />
      <SettingsPanel />
      <InventoryPanel />
      <CraftPanel />
      <ChestPanel />
      <FurnacePanel />
      <Hotbar />
    </>
  );
}
