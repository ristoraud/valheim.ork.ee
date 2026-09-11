(() => {
  const state = document.getElementById('server-state');
  const players = document.getElementById('server-players');
  const version = document.getElementById('server-version');
  const checked = document.getElementById('server-checked');

  const url = 'https://farlands-status.onrender.com/status';

  let busy = false;
  let snapshot = null;

  // Hosterfy task algab Eesti aja järgi 04:15.
  // 15 minutit hiljem toimub päris restart.
  const RESTART_HOUR = 4;
  const RESTART_MINUTE = 30;

  let restart = document.getElementById('server-restart');

  if (!restart && checked?.parentElement) {
    restart = document.createElement('span');
    restart.id = 'server-restart';
    restart.style.marginLeft = '0.75rem';
    checked.insertAdjacentElement('afterend', restart);
  }

  function tallinnTimeParts() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Tallinn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });

    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date())
        .filter(part => part.type !== 'literal')
        .map(part => [part.type, part.value])
    );

    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute)
    };
  }

  function updateRestart() {
    if (!restart) return;

    const now = tallinnTimeParts();

    const restartPassed =
      now.hour > RESTART_HOUR ||
      (now.hour === RESTART_HOUR && now.minute >= RESTART_MINUTE);

    restart.textContent =
      `Järgmine restart: ${restartPassed ? 'homme' : 'täna'} ` +
      `${String(RESTART_HOUR).padStart(2, '0')}:` +
      `${String(RESTART_MINUTE).padStart(2, '0')}`;
  }

  function render(data) {
    const timestamp = Date.parse(data.checkedAt);

    if (
      !Number.isFinite(timestamp) ||
      !['online', 'unreachable'].includes(data.state)
    ) {
      throw new Error('Invalid status');
    }

    const stale =
      Date.now() - timestamp > 30 * 60 * 1000 ||
      timestamp > Date.now() + 60000;

    state.textContent = stale
      ? 'Andmed aegunud'
      : data.state === 'online'
        ? 'Server töötab'
        : 'Server ei vastanud';

    state.dataset.state = stale ? 'stale' : data.state;

    players.textContent =
      !stale &&
      data.state === 'online' &&
      Number.isInteger(data.players) &&
      Number.isInteger(data.maxPlayers)
        ? `${data.players}/${data.maxPlayers}`
        : '—';

    version.textContent =
      !stale &&
      data.state === 'online' &&
      typeof data.version === 'string'
        ? data.version
        : '—';

    checked.textContent =
      'Kontrollitud: ' +
      new Date(timestamp).toLocaleString('et-EE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

    checked.dateTime = data.checkedAt;

    updateRestart();
  }

  async function load() {
    if (busy) return;

    busy = true;

    try {
      const response = await fetch(`${url}?t=${Date.now()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        throw new Error('Status unavailable');
      }

      const data = await response.json();

      render(data);
      snapshot = data;
    } catch {
      snapshot = null;

      state.textContent = 'Staatus pole saadaval';
      state.dataset.state = 'unknown';

      players.textContent = '—';
      version.textContent = '—';

      updateRestart();
    } finally {
      busy = false;
    }
  }

  window.setInterval(() => {
    if (!document.hidden) {
      load();
    }
  }, 60000);

  window.setInterval(() => {
    if (snapshot) {
      render(snapshot);
    } else {
      updateRestart();
    }
  }, 15000);

  updateRestart();
  load();
})();
