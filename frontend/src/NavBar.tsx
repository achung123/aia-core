import { NavLink } from 'react-router-dom';
import { useDealerStore } from './stores/dealerStore';

export default function NavBar() {
  const gameId = useDealerStore((s) => s.gameId);
  const dealerGameActive = gameId !== null;

  return (
    <nav>
      <NavLink to="/">Home</NavLink>
      <NavLink
        to="/playback"
        className={({ isActive }) =>
          [isActive ? 'active' : '', dealerGameActive ? 'disabled' : '']
            .filter(Boolean)
            .join(' ') || undefined
        }
        onClick={(e) => {
          if (dealerGameActive) e.preventDefault();
        }}
      >
        Playback
      </NavLink>
      <NavLink to="/data">Data</NavLink>
      <NavLink to="/dealer">Dealer</NavLink>
      <NavLink to="/player">Player</NavLink>
    </nav>
  );
}
