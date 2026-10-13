import { useState, useEffect, useRef } from 'react';
import { fetchPlayers } from '../api/client';
import type { PlayerResponse } from '../api/types';

interface PlayerSelectorProps {
  onSelect: (playerName: string) => void;
  value?: string;
  placeholder?: string;
}

export function PlayerSelector({ onSelect, value, placeholder }: PlayerSelectorProps) {
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [inputValue, setInputValue] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPlayers().then(setPlayers).catch(() => {});
  }, []);

  useEffect(() => {
    if (value !== undefined) {
      setInputValue(value);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(inputValue.toLowerCase()),
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
    setOpen(true);
  }

  function handleFocus() {
    setOpen(true);
  }

  function handleSelect(name: string) {
    setInputValue(name);
    setOpen(false);
    onSelect(name);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={inputValue}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        style={{ width: '100%', padding: '12px', fontSize: '16px', boxSizing: 'border-box' }}
      />
      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            margin: 0,
            padding: 0,
            listStyle: 'none',
            background: '#fff',
            border: '1px solid #ccc',
            maxHeight: '240px',
            overflowY: 'auto',
            zIndex: 10,
          }}
        >
          {filtered.length === 0 ? (
            <li style={{ padding: '12px', color: '#888' }}>No players found</li>
          ) : (
            filtered.map((p) => (
              <li
                key={p.player_id}
                role="option"
                onClick={() => handleSelect(p.name)}
                style={{
                  minHeight: '44px',
                  padding: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {p.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
