import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePlayerStore } from './stores/playerStore';
import { useDealerStore } from './stores/dealerStore';
import { fetchPlayers, fetchGame } from './api/client';
import type { PlayerResponse } from './api/types';

export default function NavBar() {
  const playerName = usePlayerStore((state) => state.playerName);
  const selectedTitle = usePlayerStore((state) => state.selectedTitle);
  const setPlayerName = usePlayerStore((state) => state.setPlayerName);
  const dealerGameId = useDealerStore((state) => state.gameId);
  const dealerPlayers = useDealerStore((state) => state.players);
  const inActiveGame = !!(dealerGameId && playerName && dealerPlayers.some((p) => p.name === playerName));
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: players } = useQuery<PlayerResponse[], Error>({
    queryKey: ['players'],
    queryFn: fetchPlayers,
  });

  const { data: gameData, error: gameError } = useQuery({
    queryKey: ['game', dealerGameId],
    queryFn: () => fetchGame(dealerGameId!),
    enabled: !!dealerGameId,
  });

  useEffect(() => {
    if (!dealerGameId) return;
    if (gameError || (gameData && gameData.status !== 'active')) {
      useDealerStore.getState().reset();
    }
  }, [dealerGameId, gameData, gameError]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleSelectPlayer(name: string) {
    setPlayerName(name);
    setOpen(false);
    setSwitching(false);
  }

  function handleViewStats() {
    if (playerName) {
      navigate(`/players/${playerName}`);
      setOpen(false);
    }
  }

  function handleProfileSettings() {
    navigate('/profile/settings');
    setOpen(false);
  }

  return (
    <nav className="top-nav">
      <NavLink to="/">Home</NavLink>
      <NavLink to="/dealer">Dealer</NavLink>
      <NavLink to="/player" className={({ isActive }) => inActiveGame ? (isActive ? 'nav-game-active active' : 'nav-game-active') : undefined}>
        {inActiveGame ? 'Game (Active)' : 'Game'}
      </NavLink>
      <div className="nav-spacer" />
      <div className="nav-profile" ref={menuRef}>
        <button
          data-testid="profile-btn"
          className="nav-profile-btn"
          onClick={() => { setOpen((prev) => { if (prev) setSwitching(false); return !prev; }); }}
          type="button"
        >
          <span className="nav-profile-avatar">{playerName ? playerName[0].toUpperCase() : '?'}</span>
          <span className="nav-profile-label">{playerName ? (selectedTitle ? `${playerName} · ${selectedTitle}` : playerName) : 'Select Profile'}</span>
        </button>
        {open && (
          <div data-testid="profile-menu" className="nav-profile-menu">
            {playerName && (
              <>
                <button
                  data-testid="view-stats-btn"
                  className="nav-profile-menu-item"
                  onClick={handleViewStats}
                  type="button"
                >
                  📊 My Stats
                </button>
                <button
                  data-testid="profile-settings-btn"
                  className="nav-profile-menu-item"
                  onClick={handleProfileSettings}
                  type="button"
                >
                  ⚙️ Profile Settings
                </button>
                <div className="nav-profile-divider" />
              </>
            )}
            {!switching ? (
              <button
                data-testid="switch-profile-btn"
                className="nav-profile-menu-item"
                onClick={() => setSwitching(true)}
                type="button"
              >
                🔄 Switch Profile
              </button>
            ) : (
              <>
                <div className="nav-profile-menu-heading">Select a profile</div>
                {players?.map((p) => (
                  <button
                    key={p.name}
                    data-testid={`profile-option-${p.name}`}
                    className={`nav-profile-menu-item${p.name === playerName ? ' active' : ''}`}
                    onClick={() => handleSelectPlayer(p.name)}
                    type="button"
                  >
                    {p.name}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
