import { NavLink } from 'react-router-dom';

// Placeholder for Zustand store (T-008). Replace with actual store import when available.
const useDealerGameActive = (): boolean => false;

export default function NavBar() {
  const dealerGameActive = useDealerGameActive();

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
