import { fetchSessions, fetchHands } from '../api/client.js';
import { initScene } from '../scenes/table.js';
import { addPokerTable, computeSeatPositions, createSeatLabels, loadSession, updateSeatLabelPositions } from '../scenes/tableGeometry.js';
import { createChipStacks } from '../scenes/chipStacks.js';
import { createSessionScrubber } from '../components/sessionScrubber.js';

export function renderPlaybackView(container) {
  container.innerHTML = `
    <div id="playback-layout" style="display:flex;height:100vh;">
      <div id="session-panel" style="width:240px;overflow-y:auto;background:#111;padding:10px;">
        <h2 style="color:#fff;font-size:14px;">Sessions</h2>
        <div id="session-list"><p style="color:#aaa;">Loading...</p></div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;">
        <div id="canvas-area" style="flex:1;position:relative;">
          <canvas id="three-canvas" style="display:block;width:100%;height:100%;"></canvas>
          <div id="spinner" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;display:none;">Loading...</div>
          <div id="error-banner" style="display:none;position:absolute;top:0;left:0;right:0;background:#c00;color:#fff;padding:8px;"></div>
        </div>
        <div id="scrubber-container"></div>
      </div>
    </div>
  `;

  const canvas = container.querySelector('#three-canvas');
  requestAnimationFrame(() => {
    const { renderer, scene, camera, dispose } = initScene(canvas);
    addPokerTable(scene);
    const seatPositions = computeSeatPositions();
    const chipStacksCtrl = createChipStacks(scene, seatPositions, {});
    const canvasArea = container.querySelector('#canvas-area');
    const labels = createSeatLabels(canvasArea);
    updateSeatLabelPositions(labels, seatPositions, camera, renderer);

    function computeCumulativePL(hands, handIndex) {
      const plMap = {};
      for (let i = 0; i <= handIndex; i++) {
        (hands[i].player_hands || []).forEach(ph => {
          const pl = ph.profit_loss ?? 0;
          plMap[ph.player_name] = (plMap[ph.player_name] || 0) + pl;
        });
      }
      return plMap;
    }

    window.__onSessionLoaded = ({ hands, playerNames }) => {
      loadSession(labels, playerNames);
      updateSeatLabelPositions(labels, seatPositions, camera, renderer);
      const seatPlayerMap = {};
      playerNames.forEach((name, i) => { seatPlayerMap[i] = name; });
      chipStacksCtrl.updateChipStacks({}, seatPlayerMap);

      const scrubberContainer = container.querySelector('#scrubber-container');
      createSessionScrubber(scrubberContainer, hands.length, (handNumber) => {
        const plMap = computeCumulativePL(hands, handNumber - 1);
        chipStacksCtrl.updateChipStacks(plMap);
      });
    };
  });

  loadSessionList();
}

async function loadSessionList() {
  const list = document.getElementById('session-list');
  try {
    const sessions = await fetchSessions();
    if (!sessions.length) {
      list.innerHTML = '<p style="color:#aaa;">No sessions found.</p>';
      return;
    }
    list.innerHTML = '';
    sessions.forEach(s => {
      const row = document.createElement('div');
      row.className = 'session-row';
      row.style.cssText = 'padding:8px;cursor:pointer;color:#ddd;border-bottom:1px solid #333;';
      const nameEl = document.createElement('div');
      nameEl.style.fontWeight = '600';
      nameEl.textContent = s.game_date || s.date || 'Unknown date';

      const infoEl = document.createElement('div');
      infoEl.style.cssText = 'font-size:11px;color:#999;';
      infoEl.textContent = `${s.hand_count ?? '?'} hands · ${s.player_count ?? '?'} players`;

      row.appendChild(nameEl);
      row.appendChild(infoEl);
      row.addEventListener('click', () => loadSession_(s));
      list.appendChild(row);
    });
  } catch (err) {
    const p = document.createElement('p');
    p.style.color = '#f55';
    p.textContent = `Error: ${err.message}`;
    list.innerHTML = '';
    list.appendChild(p);
  }
}

async function loadSession_(session) {
  const spinner = document.getElementById('spinner');
  const errorBanner = document.getElementById('error-banner');
  spinner.style.display = 'block';
  errorBanner.style.display = 'none';

  try {
    const hands = await fetchHands(session.game_id);
    spinner.style.display = 'none';

    // Extract unique player names from hands
    const playerNames = [];
    const seen = new Set();
    hands.forEach(h => {
      (h.player_hands || []).forEach(ph => {
        if (ph.player_name && !seen.has(ph.player_name)) {
          seen.add(ph.player_name);
          playerNames.push(ph.player_name);
        }
      });
    });

    // Initialize scene seat labels (dummy — real scene integration done in T-011+)
    console.log('Session loaded:', session.game_id, 'players:', playerNames, 'hands:', hands.length);
    
    // Signal session loaded — stub for T-010 scrubber integration
    if (window.__onSessionLoaded) {
      window.__onSessionLoaded({ session, hands, playerNames });
    }
  } catch (err) {
    spinner.style.display = 'none';
    errorBanner.textContent = `Failed to load session: ${err.message}`;
    errorBanner.style.display = 'block';
  }
}
