import { HashRouter, Routes, Route } from 'react-router-dom';
import NavBar from './NavBar';
import { LandingPage } from './views/LandingPage';
import { MobilePlaybackView } from './views/MobilePlaybackView';
import { DataView } from './views/DataView';
import { DealerApp } from './dealer/DealerApp';
import { PlayerApp } from './player/PlayerApp';
import { TableView } from './pages/TableView';

export default function App() {
  return (
    <HashRouter>
      <div id="app-root">
        <NavBar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/playback" element={<MobilePlaybackView />} />
          <Route path="/data" element={<DataView />} />
          <Route path="/dealer" element={<DealerApp />} />
          <Route path="/player" element={<PlayerApp />} />
          <Route path="/player/table" element={<TableView />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
