import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface PlayerStoreState {
  playerName: string | null;
  selectedTitle: string | null;
  setPlayerName: (name: string | null) => void;
  setSelectedTitle: (title: string | null) => void;
}

export const usePlayerStore = create<PlayerStoreState>()(
  persist(
    (set) => ({
      playerName: null,
      selectedTitle: null,
      setPlayerName: (name) => set({ playerName: name, selectedTitle: null }),
      setSelectedTitle: (title) => set({ selectedTitle: title }),
    }),
    {
      name: 'aia-active-player',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
