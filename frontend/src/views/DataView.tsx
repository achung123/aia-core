import { useState, useEffect, useCallback, type MouseEvent, type ChangeEvent, type FormEvent } from 'react';
import {
  fetchSessions,
  fetchHands,
  fetchPlayers,
  createSession,
  createHand,
  uploadCsvValidate,
  uploadCsvCommit,
  uploadZipValidate,
  uploadZipCommit,
  updateCommunityCards,
  updateHolecards,
  exportGameCsvUrl,
  exportGameZipUrl,
  deleteGame,
  deleteHand,
} from '../api/client.ts';
import type {
  GameSessionListItem,
  HandResponse,
  PlayerResponse,
  PlayerHandResponse,
  ResultEnum,
} from '../api/types';

/* ── Card formatting helpers ──────────────────────────── */

const SUIT_MAP: Record<string, string> = {
  H: '♥', D: '♦', C: '♣', S: '♠',
  h: '♥', d: '♦', c: '♣', s: '♠',
};

function formatCard(card: string | null): string {
  if (!card) return '—';
  const suit = card.slice(-1).toUpperCase();
  const rank = card.slice(0, -1);
  return rank + (SUIT_MAP[suit] || suit);
}

function formatCards(cards: (string | null)[]): string {
  const filtered = cards.filter(Boolean) as string[];
  if (filtered.length === 0) return '—';
  return filtered.map(formatCard).join(' ');
}

/* ── Sort helpers ─────────────────────────────────────── */

type SortColumn = 'date' | 'status' | 'hands' | 'players';

function sortSessions(data: GameSessionListItem[], sortCol: SortColumn, sortAsc: boolean): GameSessionListItem[] {
  return [...data].sort((a, b) => {
    let valueA: string | number;
    let valueB: string | number;
    if (sortCol === 'date') { valueA = a.game_date || ''; valueB = b.game_date || ''; }
    else if (sortCol === 'status') { valueA = a.status || ''; valueB = b.status || ''; }
    else if (sortCol === 'hands') { valueA = a.hand_count ?? -1; valueB = b.hand_count ?? -1; }
    else if (sortCol === 'players') { valueA = a.player_count ?? -1; valueB = b.player_count ?? -1; }
    else { valueA = ''; valueB = ''; }
    if (valueA < valueB) return sortAsc ? -1 : 1;
    if (valueA > valueB) return sortAsc ? 1 : -1;
    return 0;
  });
}

/* ── Column definition ────────────────────────────────── */

interface Column {
  key: SortColumn;
  label: string;
}

const COLUMNS: Column[] = [
  { key: 'date', label: 'Date' },
  { key: 'status', label: 'Status' },
  { key: 'hands', label: 'Hands' },
  { key: 'players', label: 'Players' },
];

/* ── Create Game Modal ────────────────────────────────── */

interface CreateGameModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateGameModal({ onClose, onCreated }: CreateGameModalProps) {
  const [dateValue, setDateValue] = useState(new Date().toISOString().slice(0, 10));
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPlayers().then(setPlayers).catch(() => {});
  }, []);

  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions).map(option => option.value);
    setSelectedNames(selected);
  };

  const handleAddPlayer = () => {
    const name = newPlayerName.trim();
    if (!name) return;
    setPlayers(prev => [...prev, { player_id: 0, name, created_at: '' }]);
    setSelectedNames(prev => [...prev, name]);
    setNewPlayerName('');
  };

  const handleSubmit = async () => {
    setError('');
    if (!selectedNames.length) { setError('Select at least one player'); return; }
    setSubmitting(true);
    try {
      await createSession({ game_date: dateValue, player_names: selectedNames });
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setSubmitting(false); }
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <h2>New Game Session</h2>
        <label>Date</label>
        <input type="date" value={dateValue} onChange={e => setDateValue(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box' }} />
        <label>Players (select multiple)</label>
        <select multiple style={{ width: '100%', height: '120px', marginTop: '0.5rem' }}
          value={selectedNames} onChange={handleSelectChange}>
          {players.map(player => <option key={player.name} value={player.name}>{player.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
          <input type="text" placeholder="New player name" style={{ flex: 1 }}
            value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} />
          <button type="button" className="dv-btn dv-btn-sm" onClick={handleAddPlayer}>+ Add</button>
        </div>
        {error && <p className="error-msg">{error}</p>}
        <div className="btn-row">
          <button type="button" className="dv-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="dv-btn dv-btn-primary" disabled={submitting}
            onClick={handleSubmit}>Create</button>
        </div>
      </div>
    </div>
  );
}

/* ── CSV Upload Modal ─────────────────────────────────── */

interface CsvUploadModalProps {
  onClose: () => void;
  onDone: () => void;
}

function CsvUploadModal({ onClose, onDone }: CsvUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [statusColor, setStatusColor] = useState('#94a3b8');
  const [validated, setValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setValidated(false);
    setStatus('');
  };

  const handleValidate = async () => {
    if (!file) return;
    setValidating(true);
    setStatus('Validating…');
    setStatusColor('#94a3b8');
    try {
      const result = await uploadCsvValidate(file);
      if (result.valid) {
        setStatus(`✓ Valid — ${result.total_rows} rows`);
        setStatusColor('#34d399');
        setValidated(true);
      } else {
        const errors = (result.errors || []).slice(0, 5);
        setStatus(`✗ ${result.error_count} errors:\n${errors.join('\n')}`);
        setStatusColor('#f87171');
      }
    } catch (e: unknown) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setStatusColor('#f87171');
    } finally { setValidating(false); }
  };

  const handleCommit = async () => {
    if (!file) return;
    setCommitting(true);
    setStatus('Committing…');
    setStatusColor('#94a3b8');
    try {
      const result = await uploadCsvCommit(file);
      setStatus(`✓ Committed — ${result.games_created} games, ${result.hands_created} hands, ${result.players_created} new players`);
      setStatusColor('#34d399');
      setTimeout(() => onDone(), 1500);
    } catch (e: unknown) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setStatusColor('#f87171');
      setCommitting(false);
    }
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <h2>Import Game from CSV</h2>
        <p className="helper-text">
          Columns: game_date, hand_number, player_name, hole_card_1, hole_card_2, flop_1, flop_2, flop_3, turn, river, result, profit_loss
        </p>
        <label>CSV File</label>
        <input type="file" accept=".csv" style={{ width: '100%' }} onChange={handleFileChange} />
        {status && <div className="status-msg" style={{ color: statusColor, whiteSpace: 'pre-wrap' }}>{status}</div>}
        <div className="btn-row">
          <button type="button" className="dv-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="dv-btn" disabled={!file || validating} onClick={handleValidate}>Validate</button>
          <button type="button" className="dv-btn dv-btn-success" disabled={!validated || committing} onClick={handleCommit}>Commit</button>
        </div>
      </div>
    </div>
  );
}

/* ── ZIP Upload Modal ─────────────────────────────────── */

interface ZipUploadModalProps {
  onClose: () => void;
  onDone: () => void;
}

function ZipUploadModal({ onClose, onDone }: ZipUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [statusColor, setStatusColor] = useState('#94a3b8');
  const [validated, setValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setValidated(false);
    setStatus('');
  };

  const handleValidate = async () => {
    if (!file) return;
    setValidating(true);
    setStatus('Validating…');
    setStatusColor('#94a3b8');
    try {
      const result = await uploadZipValidate(file);
      if (result.valid) {
        setStatus(`✓ Valid — ${result.files_found} files: ${result.files.join(', ')}`);
        setStatusColor('#34d399');
        setValidated(true);
      } else {
        setStatus(`✗ Errors:\n${result.errors.join('\n')}`);
        setStatusColor('#f87171');
      }
    } catch (e: unknown) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setStatusColor('#f87171');
    } finally { setValidating(false); }
  };

  const handleCommit = async () => {
    if (!file) return;
    setCommitting(true);
    setStatus('Committing…');
    setStatusColor('#94a3b8');
    try {
      const result = await uploadZipCommit(file);
      setStatus(
        `✓ Committed — ${result.games_created} games, ${result.hands_created} hands, ` +
        `${result.players_created} new players, ${result.actions_created} actions, ${result.rebuys_created} rebuys`
      );
      setStatusColor('#34d399');
      setTimeout(() => onDone(), 1500);
    } catch (e: unknown) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setStatusColor('#f87171');
      setCommitting(false);
    }
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <h2>Import Game from ZIP</h2>
        <p className="helper-text">
          ZIP containing: game_info.csv, hands.csv, and optionally players.csv, actions.csv, rebuys.csv
        </p>
        <label>ZIP File</label>
        <input type="file" accept=".zip" style={{ width: '100%' }} onChange={handleFileChange} />
        {status && <div className="status-msg" style={{ color: statusColor, whiteSpace: 'pre-wrap' }}>{status}</div>}
        <div className="btn-row">
          <button type="button" className="dv-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="dv-btn" disabled={!file || validating} onClick={handleValidate}>Validate</button>
          <button type="button" className="dv-btn dv-btn-success" disabled={!validated || committing} onClick={handleCommit}>Commit</button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Hand Modal ───────────────────────────────────── */

interface PlayerInput {
  name: string;
  card1: string;
  card2: string;
  result: string;
  profitLoss: string;
}

interface AddHandModalProps {
  session: GameSessionListItem;
  onClose: () => void;
  onDone: () => void;
}

function AddHandModal({ session, onClose, onDone }: AddHandModalProps) {
  const [community, setCommunity] = useState({ flop_1: '', flop_2: '', flop_3: '', turn: '', river: '' });
  const [playerInputs, setPlayerInputs] = useState<PlayerInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchHands(session.game_id).then(hands => {
      const names = new Set<string>();
      hands.forEach(hand => (hand.player_hands || []).forEach(playerHand => names.add(playerHand.player_name)));
      setPlayerInputs(Array.from(names).map(name => ({ name, card1: '', card2: '', result: '', profitLoss: '' })));
      setLoading(false);
    }).catch(err => { setError(err.message); setLoading(false); });
  }, [session.game_id]);

  const updatePlayer = (idx: number, field: keyof PlayerInput, value: string) => {
    setPlayerInputs(prev => prev.map((existing, i) => i === idx ? { ...existing, [field]: value } : existing));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const entries = playerInputs
      .filter(playerInput => playerInput.card1.trim() && playerInput.card2.trim())
      .map(playerInput => ({
        player_name: playerInput.name,
        card_1: playerInput.card1.trim().toUpperCase(),
        card_2: playerInput.card2.trim().toUpperCase(),
        result: (playerInput.result || null) as ResultEnum | null,
        profit_loss: playerInput.profitLoss ? parseFloat(playerInput.profitLoss) : null,
      }));
    if (!entries.length) { setError('At least one player must have cards'); return; }
    setSubmitting(true);
    try {
      await createHand(session.game_id, {
        flop_1: community.flop_1.trim().toUpperCase(),
        flop_2: community.flop_2.trim().toUpperCase(),
        flop_3: community.flop_3.trim().toUpperCase(),
        turn: community.turn.trim().toUpperCase() || null,
        river: community.river.trim().toUpperCase() || null,
        player_entries: entries,
      });
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setSubmitting(false); }
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <h2>{`Add Hand — Game ${session.game_date}`}</h2>
        <form onSubmit={handleSubmit}>
          <fieldset>
            <legend>Community Cards</legend>
            {(['flop_1', 'flop_2', 'flop_3', 'turn', 'river'] as const).map(key => (
              <label key={key} style={{ marginRight: '0.5rem', display: 'inline', marginTop: 0 }}>
                {key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}:{' '}
                <input type="text" placeholder="e.g. AH" style={{ width: '60px', margin: '0 0.25rem' }}
                  value={community[key]} onChange={e => setCommunity(prev => ({ ...prev, [key]: e.target.value }))} />
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Player Hands</legend>
            {loading && <p className="loading">Loading players…</p>}
            {!loading && playerInputs.length === 0 && <p className="empty-msg">No players found in existing hands.</p>}
            {playerInputs.map((playerInput, i) => (
              <div key={playerInput.name} className="player-row">
                <strong>{playerInput.name}</strong>
                <input type="text" placeholder="e.g. AH" style={{ width: '60px' }}
                  value={playerInput.card1} onChange={e => updatePlayer(i, 'card1', e.target.value)} />
                <input type="text" placeholder="e.g. KD" style={{ width: '60px' }}
                  value={playerInput.card2} onChange={e => updatePlayer(i, 'card2', e.target.value)} />
                <select value={playerInput.result} onChange={e => updatePlayer(i, 'result', e.target.value)}>
                  <option value="">--</option>
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="fold">Fold</option>
                </select>
                <input type="number" step="0.01" placeholder="0" style={{ width: '70px' }}
                  value={playerInput.profitLoss} onChange={e => updatePlayer(i, 'profitLoss', e.target.value)} />
              </div>
            ))}
          </fieldset>
          {error && <p className="error-msg">{error}</p>}
          <div className="btn-row">
            <button type="button" className="dv-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="dv-btn dv-btn-primary" disabled={submitting}>Record Hand</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Edit Hand Modal ──────────────────────────────────── */

interface PlayerEdit {
  playerName: string;
  origCard1: string | null;
  origCard2: string | null;
  card1: string;
  card2: string;
  result: string | null;
  profitLoss: number | null;
}

interface EditHandModalProps {
  gameId: number;
  hand: HandResponse;
  onClose: () => void;
  onDone: () => void;
}

function EditHandModal({ gameId, hand, onClose, onDone }: EditHandModalProps) {
  const [community, setCommunity] = useState({
    flop_1: hand.flop_1 || '',
    flop_2: hand.flop_2 || '',
    flop_3: hand.flop_3 || '',
    turn: hand.turn || '',
    river: hand.river || '',
  });
  const [playerEdits, setPlayerEdits] = useState<PlayerEdit[]>(
    (hand.player_hands || []).map(playerHand => ({
      playerName: playerHand.player_name,
      origCard1: playerHand.card_1,
      origCard2: playerHand.card_2,
      card1: playerHand.card_1 || '',
      card2: playerHand.card_2 || '',
      result: playerHand.result,
      profitLoss: playerHand.profit_loss,
    }))
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const updatePlayerEdit = (idx: number, field: 'card1' | 'card2', value: string) => {
    setPlayerEdits(prev => prev.map((existing, i) => i === idx ? { ...existing, [field]: value } : existing));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const commChanged =
        community.flop_1.trim() !== (hand.flop_1 || '') ||
        community.flop_2.trim() !== (hand.flop_2 || '') ||
        community.flop_3.trim() !== (hand.flop_3 || '') ||
        community.turn.trim() !== (hand.turn || '') ||
        community.river.trim() !== (hand.river || '');

      if (commChanged) {
        await updateCommunityCards(gameId, hand.hand_number, {
          flop_1: community.flop_1.trim().toUpperCase(),
          flop_2: community.flop_2.trim().toUpperCase(),
          flop_3: community.flop_3.trim().toUpperCase(),
          turn: community.turn.trim().toUpperCase() || null,
          river: community.river.trim().toUpperCase() || null,
        });
      }

      for (const playerEdit of playerEdits) {
        const newC1 = playerEdit.card1.trim().toUpperCase();
        const newC2 = playerEdit.card2.trim().toUpperCase();
        if (newC1 !== (playerEdit.origCard1 || '').toUpperCase() || newC2 !== (playerEdit.origCard2 || '').toUpperCase()) {
          await updateHolecards(gameId, hand.hand_number, playerEdit.playerName, {
            card_1: newC1,
            card_2: newC2,
          });
        }
      }

      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setSaving(false); }
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <h2>{`Edit Hand #${hand.hand_number}`}</h2>
        <form onSubmit={handleSubmit}>
          <fieldset>
            <legend>Community Cards</legend>
            {(['flop_1', 'flop_2', 'flop_3', 'turn', 'river'] as const).map(key => (
              <label key={key} style={{ marginRight: '0.5rem', display: 'inline', marginTop: 0 }}>
                {key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}:{' '}
                <input type="text" style={{ width: '60px', margin: '0 0.25rem' }}
                  value={community[key]} onChange={e => setCommunity(prev => ({ ...prev, [key]: e.target.value }))} />
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Player Hole Cards</legend>
            {playerEdits.map((playerEdit, i) => (
              <div key={playerEdit.playerName} className="player-row">
                <strong>{playerEdit.playerName}</strong>
                <input type="text" style={{ width: '60px' }}
                  value={playerEdit.card1} onChange={e => updatePlayerEdit(i, 'card1', e.target.value)} />
                <input type="text" style={{ width: '60px' }}
                  value={playerEdit.card2} onChange={e => updatePlayerEdit(i, 'card2', e.target.value)} />
                <span style={{ color: '#64748b', marginLeft: '0.5rem', fontSize: '0.82rem' }}>
                  {playerEdit.result || ''} {playerEdit.profitLoss ?? ''}
                </span>
              </div>
            ))}
          </fieldset>
          {error && <p className="error-msg">{error}</p>}
          <div className="btn-row">
            <button type="button" className="dv-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="dv-btn dv-btn-primary" disabled={saving}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Hand Details (expanded session row) ──────────────── */

interface HandDetailsProps {
  session: GameSessionListItem;
  onRefresh: () => void;
}

function HandDetails({ session, onRefresh }: HandDetailsProps) {
  const [hands, setHands] = useState<HandResponse[] | null>(null);
  const [error, setError] = useState('');
  const [editingHand, setEditingHand] = useState<HandResponse | null>(null);
  const [showAddHand, setShowAddHand] = useState(false);

  useEffect(() => {
    fetchHands(session.game_id)
      .then(setHands)
      .catch(err => setError(err.message));
  }, [session.game_id]);

  const handleDelete = async (handToDelete: HandResponse) => {
    if (!confirm(`Delete hand #${handToDelete.hand_number}? This cannot be undone.`)) return;
    try {
      await deleteHand(session.game_id, handToDelete.hand_number);
      onRefresh();
    } catch (err: unknown) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteGame = async () => {
    if (!confirm(`Delete game ${session.game_date} and all its hands? This cannot be undone.`)) return;
    try {
      await deleteGame(session.game_id);
      onRefresh();
    } catch (err: unknown) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleLoadViz = () => {
    window.location.hash = '#/playback';
    setTimeout(() => {
      if ((window as unknown as Record<string, unknown>).__loadSessionById) {
        (window as unknown as { __loadSessionById: (id: number) => void }).__loadSessionById(session.game_id);
      }
    }, 300);
  };

  const handleExportCsv = () => {
    const a = document.createElement('a');
    a.href = exportGameCsvUrl(session.game_id);
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleExportZip = () => {
    const a = document.createElement('a');
    a.href = exportGameZipUrl(session.game_id);
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (error) return <td colSpan={COLUMNS.length} style={{ color: 'red' }}>{`Error: ${error}`}</td>;
  if (hands === null) return <td colSpan={COLUMNS.length}>Loading hands…</td>;

  return (
    <td colSpan={COLUMNS.length}>
      <div className="action-bar">
        <button type="button" className="dv-btn dv-btn-sm" onClick={() => setShowAddHand(true)}>+ Add Hand</button>
        <button type="button" className="dv-btn dv-btn-sm dv-btn-success" onClick={handleLoadViz}>▶ Load in Visualizer</button>
        <button type="button" className="dv-btn dv-btn-sm" onClick={handleExportCsv}>📥 Export CSV</button>
        <button type="button" className="dv-btn dv-btn-sm" onClick={handleExportZip}>📦 Export ZIP</button>
        <button type="button" className="dv-btn dv-btn-sm dv-btn-danger" onClick={handleDeleteGame}>🗑 Delete Game</button>
      </div>
      {hands.length === 0 ? (
        <p className="empty-msg">No hands recorded.</p>
      ) : (
        <>
          {/* Desktop: traditional table */}
          <table className="hand-table">
            <thead>
              <tr>
                {['#', 'Flop', 'Turn', 'River', 'Players', ''].map(t => <th key={t}>{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {hands.map(handRecord => (
                <tr key={handRecord.hand_id}>
                  <td>{handRecord.hand_number ?? '—'}</td>
                  <td>{formatCards([handRecord.flop_1, handRecord.flop_2, handRecord.flop_3])}</td>
                  <td>{formatCard(handRecord.turn)}</td>
                  <td>{formatCard(handRecord.river)}</td>
                  <td>
                    {(handRecord.player_hands || []).map((playerHand: PlayerHandResponse, idx: number) => {
                      const cards = [playerHand.card_1, playerHand.card_2].filter(Boolean) as string[];
                      const hand = cards.length ? formatCards(cards) : '??';
                      const street = playerHand.outcome_street ? ` (${playerHand.outcome_street})` : '';
                      return (
                        <div key={idx} style={{ whiteSpace: 'nowrap' }}>
                          {playerHand.player_name} [{hand}] {playerHand.result || '?'}{street}
                        </div>
                      );
                    })}
                    {(handRecord.player_hands || []).length === 0 && '—'}
                  </td>
                  <td style={{ display: 'flex', gap: '0.25rem' }}>
                    <button type="button" className="dv-btn dv-btn-sm" onClick={e => { e.stopPropagation(); setEditingHand(handRecord); }}>Edit</button>
                    <button type="button" className="dv-btn dv-btn-sm dv-btn-danger" onClick={e => { e.stopPropagation(); handleDelete(handRecord); }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile: card layout */}
          <div className="hand-cards">
            {hands.map(handRecord => (
              <div key={handRecord.hand_id} className="hand-card">
                <div className="hand-card-header">
                  <span className="hand-card-num">Hand #{handRecord.hand_number ?? '?'}</span>
                  <span className="hand-card-actions">
                    <button type="button" className="dv-btn dv-btn-sm" onClick={e => { e.stopPropagation(); setEditingHand(handRecord); }}>Edit</button>
                    <button type="button" className="dv-btn dv-btn-sm dv-btn-danger" onClick={e => { e.stopPropagation(); handleDelete(handRecord); }}>🗑</button>
                  </span>
                </div>
                <div className="hand-card-community">
                  <span className="hand-card-label">Flop</span> {formatCards([handRecord.flop_1, handRecord.flop_2, handRecord.flop_3])}
                  {' · '}
                  <span className="hand-card-label">Turn</span> {formatCard(handRecord.turn)}
                  {' · '}
                  <span className="hand-card-label">River</span> {formatCard(handRecord.river)}
                </div>
                {(handRecord.player_hands || []).map((playerHand: PlayerHandResponse, idx: number) => {
                  const cards = [playerHand.card_1, playerHand.card_2].filter(Boolean) as string[];
                  const hand = cards.length ? formatCards(cards) : '??';
                  const street = playerHand.outcome_street ? ` (${playerHand.outcome_street})` : '';
                  return (
                    <div key={idx} className="hand-card-player">
                      <span className="hand-card-player-name">{playerHand.player_name}</span>
                      <span className="hand-card-player-cards">{hand}</span>
                      <span className="hand-card-player-result">{playerHand.result || '?'}{street}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
      {showAddHand && (
        <AddHandModal session={session} onClose={() => setShowAddHand(false)} onDone={() => { setShowAddHand(false); onRefresh(); }} />
      )}
      {editingHand && (
        <EditHandModal gameId={session.game_id} hand={editingHand} onClose={() => setEditingHand(null)} onDone={() => { setEditingHand(null); onRefresh(); }} />
      )}
    </td>
  );
}

/* ── DataView (main component) ────────────────────────── */

export function DataView() {
  const [sessions, setSessions] = useState<GameSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortCol, setSortCol] = useState<SortColumn>('date');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [showZipUpload, setShowZipUpload] = useState(false);

  const loadSessions = useCallback(() => {
    fetchSessions()
      .then(data => { setSessions(data); setLoading(false); setError(''); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) setSortAsc(prev => !prev);
    else { setSortCol(col); setSortAsc(true); }
  };

  const handleRowClick = (gameId: number) => {
    setExpandedId(prev => prev === gameId ? null : gameId);
  };

  const handleRefresh = () => {
    loadSessions();
  };

  const sorted = sortSessions(sessions, sortCol, sortAsc);

  return (
    <div className="data-view">
      <h1 className="dv-title">📊 Game Sessions</h1>
      <div className="toolbar">
        <button type="button" className="dv-btn dv-btn-primary" onClick={() => setShowCreateGame(true)}>+ New Game</button>
        <button type="button" className="dv-btn" onClick={() => setShowCsvUpload(true)}>Import CSV</button>
        <button type="button" className="dv-btn" onClick={() => setShowZipUpload(true)}>Import ZIP</button>
      </div>
      {loading && <p className="loading">Loading sessions…</p>}
      {error && <p className="loading" style={{ color: 'red' }}>{`Error: ${error}`}</p>}
      {!loading && !error && (
        <table className="session-table">
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th key={col.key} style={{ cursor: 'pointer' }} onClick={() => handleSort(col.key)}>
                  {col.label}{sortCol === col.key ? (sortAsc ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody id="session-tbody">
            {sorted.map(session => (
              <SessionRow key={session.game_id} session={session} expanded={expandedId === session.game_id}
                onClick={() => handleRowClick(session.game_id)} onRefresh={handleRefresh} />
            ))}
          </tbody>
        </table>
      )}
      {showCreateGame && (
        <CreateGameModal onClose={() => setShowCreateGame(false)} onCreated={() => { setShowCreateGame(false); loadSessions(); }} />
      )}
      {showCsvUpload && (
        <CsvUploadModal onClose={() => setShowCsvUpload(false)} onDone={() => { setShowCsvUpload(false); loadSessions(); }} />
      )}
      {showZipUpload && (
        <ZipUploadModal onClose={() => setShowZipUpload(false)} onDone={() => { setShowZipUpload(false); loadSessions(); }} />
      )}
    </div>
  );
}

/* ── Session Row ──────────────────────────────────────── */

interface SessionRowProps {
  session: GameSessionListItem;
  expanded: boolean;
  onClick: () => void;
  onRefresh: () => void;
}

function SessionRow({ session, expanded, onClick, onRefresh }: SessionRowProps) {
  const statusText = session.status || 'active';
  return (
    <>
      <tr className="session-row" data-game-id={session.game_id} onClick={onClick}>
        <td>{session.game_date || '—'}</td>
        <td><span className={`dv-status dv-status-${statusText}`}>{statusText}</span></td>
        <td>{String(session.hand_count ?? '?')}</td>
        <td>{String(session.player_count ?? '?')}</td>
      </tr>
      {expanded && (
        <tr className="hand-details-row">
          <HandDetails session={session} onRefresh={onRefresh} />
        </tr>
      )}
    </>
  );
}
