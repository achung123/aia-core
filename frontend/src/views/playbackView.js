import { fetchSessions, fetchHands } from '../api/client.js';
import { createPokerScene } from '../scenes/pokerScene.js';
import { createSeatLabels, loadSession, updateSeatLabelPositions } from '../scenes/tableGeometry.js';
import { createCommunityCards } from '../scenes/communityCards.js';
import { createSessionScrubber } from '../components/sessionScrubber.js';
import { createStreetScrubber } from '../components/streetScrubber.js';
import { calculateEquity } from '../poker/evaluator.js';
import { createEquityOverlay } from '../components/equityOverlay.js';

const SUIT_SYMBOL = { h: '♥', d: '♦', c: '♣', s: '♠', H: '♥', D: '♦', C: '♣', S: '♠' };

function parseCard(cardStr) {
  if (!cardStr) return null;
  const rank = cardStr.slice(0, -1);
  const suitChar = cardStr.slice(-1);
  return { rank, suit: SUIT_SYMBOL[suitChar] || suitChar };
}

function handToCardData(hand) {
  return {
    flop: [parseCard(hand.flop_1), parseCard(hand.flop_2), parseCard(hand.flop_3)],
    turn: parseCard(hand.turn),
    river: parseCard(hand.river),
    player_hands: (hand.player_hands || []).map(ph => ({
      player_name: ph.player_name,
      hole_cards: ph.card_1 && ph.card_2 ? [parseCard(ph.card_1), parseCard(ph.card_2)] : null,
      result: ph.result,
      profit_loss: ph.profit_loss,
    })),
  };
}

function communityForStreet(cardData, streetName) {
  const cards = [];
  if (streetName !== 'Pre-Flop' && cardData.flop) {
    cards.push(...cardData.flop.filter(Boolean));
  }
  if ((streetName === 'Turn' || streetName === 'River' || streetName === 'Showdown') && cardData.turn) {
    cards.push(cardData.turn);
  }
  if ((streetName === 'River' || streetName === 'Showdown') && cardData.river) {
    cards.push(cardData.river);
  }
  return cards;
}

function updateEquity(cardData, streetName, seatPlayerMap, equityOverlay) {
  const community = communityForStreet(cardData, streetName);
  const active = cardData.player_hands.filter(ph => ph.hole_cards);

  if (active.length < 2) {
    equityOverlay.hide();
    return;
  }

  const results = calculateEquity(
    active.map(ph => ph.hole_cards),
    community,
  );

  const eqMap = {};
  active.forEach((ph, i) => { eqMap[ph.player_name] = results[i].equity; });
  equityOverlay.update(eqMap, seatPlayerMap);
}

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
  // Wait until the canvas has real dimensions before initialising the 3D scene
  function waitForLayout(cb, tries = 30) {
    if (tries <= 0) { cb(); return; }
    if (canvas.clientWidth > 0 && canvas.clientHeight > 0) { cb(); return; }
    requestAnimationFrame(() => waitForLayout(cb, tries - 1));
  }
  waitForLayout(() => {
    const pokerScene = createPokerScene(canvas);
    const { renderer, scene, camera, seatPositions, chipStacks: chipStacksCtrl, holeCards: holeCardsCtrl, dispose } = pokerScene;
    const canvasArea = container.querySelector('#canvas-area');
    const labels = createSeatLabels(canvasArea);
    updateSeatLabelPositions(labels, seatPositions, camera, renderer);
    const equityOverlay = createEquityOverlay(canvasArea, 10);
    equityOverlay.updatePositions(seatPositions, camera, renderer);

    // Keep overlays positioned on resize
    window.addEventListener('resize', () => {
      updateSeatLabelPositions(labels, seatPositions, camera, renderer);
      equityOverlay.updatePositions(seatPositions, camera, renderer);
    });

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

    let activeScrubber = null;
    let activeStreetScrubber = null;
    let activeCommunityCards = null;

    window.__onSessionLoaded = ({ hands, playerNames }) => {
      loadSession(labels, playerNames);
      updateSeatLabelPositions(labels, seatPositions, camera, renderer);
      equityOverlay.updatePositions(seatPositions, camera, renderer);
      equityOverlay.hide();

      if (activeScrubber) { activeScrubber.dispose(); activeScrubber = null; }
      if (activeStreetScrubber) { activeStreetScrubber.dispose(); activeStreetScrubber = null; }
      if (activeCommunityCards) { activeCommunityCards.dispose(); activeCommunityCards = null; }

      const scrubberContainer = container.querySelector('#scrubber-container');
      scrubberContainer.innerHTML = '';

      if (!hands.length) return;

      const seatPlayerMap = {};
      playerNames.forEach((name, i) => { seatPlayerMap[i] = name; });
      chipStacksCtrl.updateChipStacks({}, seatPlayerMap);

      function showHand(handIndex) {
        const hand = hands[handIndex];
        const cardData = handToCardData(hand);

        // Community cards — recreate per hand
        if (activeCommunityCards) { activeCommunityCards.dispose(); activeCommunityCards = null; }
        activeCommunityCards = createCommunityCards(scene, cardData);

        // Hole cards
        holeCardsCtrl.initHand(cardData, seatPlayerMap);

        // Street scrubber
        if (activeStreetScrubber) { activeStreetScrubber.dispose(); activeStreetScrubber = null; }
        const streetContainer = scrubberContainer.querySelector('#street-scrubber-area') ||
          (() => { const d = document.createElement('div'); d.id = 'street-scrubber-area'; scrubberContainer.appendChild(d); return d; })();
        streetContainer.innerHTML = '';
        activeStreetScrubber = createStreetScrubber(streetContainer, cardData, (streetName) => {
          const streetMap = { 'Pre-Flop': 0, 'Flop': 1, 'Turn': 2, 'River': 3, 'Showdown': 4 };
          const streetIdx = streetMap[streetName] ?? 0;
          activeCommunityCards.goToStreet(streetIdx);
          if (streetName === 'Showdown') {
            holeCardsCtrl.goToShowdown();
          } else {
            holeCardsCtrl.initHand(cardData, seatPlayerMap);
          }
          // Update equity display for current street
          updateEquity(cardData, streetName, seatPlayerMap, equityOverlay);
        });

        // Chip stacks
        const plMap = computeCumulativePL(hands, handIndex);
        chipStacksCtrl.updateChipStacks(plMap);
      }

      activeScrubber = createSessionScrubber(scrubberContainer, hands.length, (handNumber) => {
        showHand(handNumber - 1);
      });
    };
  });

  loadSessionList();

  // Allow data view to load a session by ID
  window.__loadSessionById = async (gameId) => {
    const allSessions = await fetchSessions();
    const match = allSessions.find(s => s.game_id === gameId);
    if (match) loadSession_(match);
  };
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
