import { HashRouter, Routes, Route } from 'react-router-dom';
import NavBar from './NavBar';
import { LandingPage } from './views/LandingPage';
import { PlaybackView } from './views/PlaybackView';
import { DataView } from './views/DataView';
import { DealerApp } from './dealer/DealerApp';
import { PlayerApp } from './player/PlayerApp';
import { TableView } from './pages/TableView';
import { GameListPage } from './pages/GameListPage';
import { GameRecapPage } from './pages/GameRecapPage';
import { PlayerProfilePage } from './pages/PlayerProfilePage';
import { HeadToHeadPage } from './pages/HeadToHeadPage';
import { AwardsGridPage } from './pages/AwardsGridPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

export default function App() {
  return (
    <HashRouter>
      <div id="app-root">
        <NavBar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/playback" element={<PlaybackView />} />
          <Route path="/data" element={<DataView />} />
          <Route path="/dealer" element={<DealerApp />} />
          <Route path="/player" element={<PlayerApp />} />
          <Route path="/player/table" element={<TableView />} />
          <Route path="/games" element={<GameListPage />} />
          <Route path="/games/:gameId/recap" element={<GameRecapPage />} />
          <Route path="/players/:playerName" element={<PlayerProfilePage />} />
          <Route path="/head-to-head" element={<HeadToHeadPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/awards" element={<AwardsGridPage />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
