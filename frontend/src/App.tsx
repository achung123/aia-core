import { HashRouter, Routes, Route } from 'react-router-dom';
import NavBar from './NavBar';
import { LandingPage } from './views/LandingPage';
import { DataView } from './views/DataView';


function PlaybackPlaceholder() {
  return <div>Playback View</div>;
}

function DealerPlaceholder() {
  return <div>Dealer App</div>;
}

function PlayerPlaceholder() {
  return <div>Player App</div>;
}

export default function App() {
  return (
    <HashRouter>
      <div id="app-root">
        <NavBar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/playback" element={<PlaybackPlaceholder />} />
          <Route path="/data" element={<DataView />} />
          <Route path="/dealer" element={<DealerPlaceholder />} />
          <Route path="/player" element={<PlayerPlaceholder />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
