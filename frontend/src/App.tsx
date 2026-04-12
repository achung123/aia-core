import { HashRouter, Routes, Route } from 'react-router-dom';
import NavBar from './NavBar';

// Route target placeholders — these import existing JSX components.
// They will be converted to proper TSX in later tasks.
// For now, use lazy wrappers or simple placeholder components.
function LandingPagePlaceholder() {
  return <div>Landing Page</div>;
}

function PlaybackPlaceholder() {
  return <div>Playback View</div>;
}

function DataPlaceholder() {
  return <div>Data View</div>;
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
          <Route path="/" element={<LandingPagePlaceholder />} />
          <Route path="/playback" element={<PlaybackPlaceholder />} />
          <Route path="/data" element={<DataPlaceholder />} />
          <Route path="/dealer" element={<DealerPlaceholder />} />
          <Route path="/player" element={<PlayerPlaceholder />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
