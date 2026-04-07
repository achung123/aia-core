import { fetchPlayers, createSession } from '../api/client.js';

export function createSessionForm(container, onSessionCreated) {
  const wrapper = document.createElement('div');
  wrapper.className = 'session-form';

  const heading = document.createElement('h2');
  heading.textContent = 'New Session';
  wrapper.appendChild(heading);

  const form = document.createElement('form');

  // --- Date picker ---
  const dateLabel = document.createElement('label');
  dateLabel.textContent = 'Date';
  dateLabel.htmlFor = 'session-date-input';
  form.appendChild(dateLabel);

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.id = 'session-date-input';
  dateInput.name = 'gameDate';
  dateInput.required = true;
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dateInput.value = `${yyyy}-${mm}-${dd}`;
  form.appendChild(dateInput);

  // --- Player multi-select ---
  const playerLabel = document.createElement('label');
  playerLabel.textContent = 'Players';
  playerLabel.htmlFor = 'session-players-select';
  form.appendChild(playerLabel);

  const playerSelect = document.createElement('select');
  playerSelect.id = 'session-players-select';
  playerSelect.name = 'players';
  playerSelect.multiple = true;

  const loadingOption = document.createElement('option');
  loadingOption.textContent = 'Loading players…';
  loadingOption.disabled = true;
  playerSelect.appendChild(loadingOption);
  form.appendChild(playerSelect);

  // --- Inline error ---
  const inlineError = document.createElement('p');
  inlineError.className = 'inline-error';
  inlineError.style.color = 'red';
  inlineError.hidden = true;
  form.appendChild(inlineError);

  // --- Submit button ---
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Submit';
  form.appendChild(submitBtn);

  wrapper.appendChild(form);
  container.appendChild(wrapper);

  // --- Load players into multi-select ---
  fetchPlayers()
    .then(players => {
      playerSelect.removeChild(loadingOption);
      if (!players || players.length === 0) {
        const emptyOption = document.createElement('option');
        emptyOption.textContent = 'No players found';
        emptyOption.disabled = true;
        playerSelect.appendChild(emptyOption);
        return;
      }
      players.forEach(player => {
        const option = document.createElement('option');
        option.value = player.name;
        option.textContent = player.name;
        playerSelect.appendChild(option);
      });
    })
    .catch(err => {
      playerSelect.removeChild(loadingOption);
      const errorOption = document.createElement('option');
      errorOption.textContent = `Failed to load players: ${err.message}`;
      errorOption.disabled = true;
      playerSelect.appendChild(errorOption);
    });

  // --- Form submit handler ---
  form.addEventListener('submit', async event => {
    event.preventDefault();

    inlineError.hidden = true;
    inlineError.textContent = '';

    const selectedNames = Array.from(playerSelect.selectedOptions).map(
      opt => opt.value
    );

    submitBtn.disabled = true;
    try {
      const newSession = await createSession({
        game_date: dateInput.value,
        player_names: selectedNames,
      });
      form.reset();
      dateInput.value = `${yyyy}-${mm}-${dd}`;
      onSessionCreated(newSession);
    } catch (err) {
      const message =
        err.message && err.message.startsWith('HTTP 409')
          ? 'A session for this date already exists'
          : err.message;
      inlineError.textContent = message;
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
