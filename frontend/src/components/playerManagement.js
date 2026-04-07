import { fetchLeaderboard, createPlayer } from '../api/client.js';

function buildPlayerRow(playerName, totalHands) {
  const tr = document.createElement('tr');

  const tdName = document.createElement('td');
  tdName.textContent = playerName;

  const tdHands = document.createElement('td');
  tdHands.textContent = totalHands;

  tr.appendChild(tdName);
  tr.appendChild(tdHands);
  return tr;
}

export function createPlayerManagement(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'player-management';

  const heading = document.createElement('h2');
  heading.textContent = 'Players';
  wrapper.appendChild(heading);

  // --- Player list table ---
  const table = document.createElement('table');
  table.className = 'player-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Player', 'Total Hands'].forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  wrapper.appendChild(table);

  const loadingEl = document.createElement('p');
  loadingEl.textContent = 'Loading players…';
  wrapper.appendChild(loadingEl);

  // --- New Player form ---
  const formSection = document.createElement('div');
  formSection.className = 'new-player-form';

  const formHeading = document.createElement('h3');
  formHeading.textContent = 'New Player';
  formSection.appendChild(formHeading);

  const form = document.createElement('form');

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Player name';
  nameInput.name = 'playerName';
  form.appendChild(nameInput);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Submit';
  form.appendChild(submitBtn);

  const inlineError = document.createElement('p');
  inlineError.className = 'inline-error';
  inlineError.style.color = 'red';
  inlineError.hidden = true;
  form.appendChild(inlineError);

  formSection.appendChild(form);
  wrapper.appendChild(formSection);

  container.appendChild(wrapper);

  // --- Fetch and render leaderboard ---
  fetchLeaderboard()
    .then(entries => {
      loadingEl.remove();
      if (!entries || entries.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.textContent =
          'No player data yet. Players appear here after sessions are recorded.';
        wrapper.insertBefore(emptyMsg, formSection);
        return;
      }
      entries.forEach(entry => {
        const row = buildPlayerRow(
          entry.player_name,
          entry.hands_played ?? 0,
        );
        tbody.appendChild(row);
      });
    })
    .catch(err => {
      loadingEl.remove();
      const errorEl = document.createElement('p');
      errorEl.style.color = 'red';
      errorEl.textContent = `Failed to load players: ${err.message}`;
      wrapper.insertBefore(errorEl, formSection);
    });

  // --- Form submit handler ---
  form.addEventListener('submit', async event => {
    event.preventDefault();

    inlineError.hidden = true;
    inlineError.textContent = '';

    const name = nameInput.value.trim();
    if (!name) {
      inlineError.textContent = 'Player name cannot be empty.';
      inlineError.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    try {
      const newPlayer = await createPlayer({ name });
      const playerName = (newPlayer && newPlayer.name) ? newPlayer.name : name;
      tbody.appendChild(buildPlayerRow(playerName, 0));
      nameInput.value = '';
    } catch (err) {
      const status = err.message && err.message.startsWith('HTTP 409')
        ? `Player "${name}" already exists.`
        : err.message;
      inlineError.textContent = status;
      inlineError.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });

  return {
    dispose() {
      container.removeChild(wrapper);
    },
  };
}
