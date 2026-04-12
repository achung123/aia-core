import { HashRouter, Routes, Route } from 'react-router-dom';
import NavBar from './NavBar';
import { LandingPage } from './views/LandingPage';
import { PlaybackView } from './views/PlaybackView';
import { DataView } from './views/DataView';
import { DealerApp } from './dealer/DealerApp';
import { PlayerApp } from './player/PlayerApp';

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
        </Routes>
      </div>
    </HashRouter>
  );
}
