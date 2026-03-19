import { h } from 'preact';
import { StartScreen } from './screens/StartScreen.jsx';
import { LoadingScreen } from './screens/LoadingScreen.jsx';
import { DeathScreen } from './screens/DeathScreen.jsx';
import { Hotbar } from './hotbar/Hotbar.jsx';
import { HealthDisplay } from './health/HealthDisplay.jsx';
import { InfoOverlay } from './info/InfoOverlay.jsx';
import { SettingsPanel } from './panels/SettingsPanel.jsx';
import { CraftPanel } from './panels/CraftPanel.jsx';
import { ChestPanel } from './panels/ChestPanel.jsx';
import { BreakProgress } from './overlays/BreakProgress.jsx';
import { ActionFeedback } from './overlays/ActionFeedback.jsx';
import { WaterOverlay } from './overlays/WaterOverlay.jsx';
import { ResumeHint } from './overlays/ResumeHint.jsx';

export function App() {
  return (
    <>
      <StartScreen />
      <LoadingScreen />
      <DeathScreen />
      <WaterOverlay />
      <BreakProgress />
      <ActionFeedback />
      <ResumeHint />
      <InfoOverlay />
      <HealthDisplay />
      <SettingsPanel />
      <CraftPanel />
      <ChestPanel />
      <Hotbar />
    </>
  );
}
