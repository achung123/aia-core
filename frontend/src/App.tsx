import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import NavBar from './NavBar';
import { PlaybackView } from './views/PlaybackView';
import { DataView } from './views/DataView';
import { DealerApp } from './dealer/DealerApp';
import { PlayerApp } from './player/PlayerApp';
import { TableView } from './pages/TableView';
import { GameRecapPage } from './pages/GameRecapPage';
import { PlayerProfilePage } from './pages/PlayerProfilePage';
import { HeadToHeadPage } from './pages/HeadToHeadPage';
import { AwardsGridPage } from './pages/AwardsGridPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';

function GuardedRoutes() {
  // A page that crashes is replaced by a recoverable message; moving to
  // another route clears it.
  const location = useLocation();
  return (
    <AppErrorBoundary resetKey={location.pathname + location.search}>
      <Routes>
        <Route path="/" element={<AnalyticsPage />} />
        <Route path="/playback" element={<PlaybackView />} />
        <Route path="/data" element={<DataView />} />
        <Route path="/dealer" element={<DealerApp />} />
        <Route path="/player" element={<PlayerApp />} />
        <Route path="/player/table" element={<TableView />} />
        <Route path="/games/:gameId/recap" element={<GameRecapPage />} />
        <Route path="/players/:playerName" element={<PlayerProfilePage />} />
        <Route path="/head-to-head" element={<HeadToHeadPage />} />
        <Route path="/awards" element={<AwardsGridPage />} />
        <Route path="/profile/settings" element={<ProfileSettingsPage />} />
      </Routes>
    </AppErrorBoundary>
  );
}

export default function App() {
  return (
    <HashRouter>
      <div id="app-root">
        <NavBar />
        <GuardedRoutes />
      </div>
    </HashRouter>
  );
}
