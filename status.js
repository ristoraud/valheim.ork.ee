(() => {
  const state = document.getElementById('server-state');
  const players = document.getElementById('server-players');
  const version = document.getElementById('server-version');
  const checked = document.getElementById('server-checked');
  const url = 'https://farlands-status.onrender.com/status';
  let busy = false;
  let snapshot = null;

  function render(data) {
    const timestamp = Date.parse(data.checkedAt);
    if (!Number.isFinite(timestamp) || !['online', 'unreachable'].includes(data.state)) throw new Error('Invalid status');
    const stale = Date.now() - timestamp > 30 * 60 * 1000 || timestamp > Date.now() + 60000;
    state.textContent = stale ? 'Andmed aegunud' : data.state === 'online' ? 'Server töötab' : 'Server ei vastanud';
    state.dataset.state = stale ? 'stale' : data.state;
    players.textContent = !stale && data.state === 'online' && Number.isInteger(data.players) && Number.isInteger(data.maxPlayers)
      ? `${data.players}/${data.maxPlayers}` : '—';
    version.textContent = !stale && data.state === 'online' && typeof data.version === 'string' ? data.version : '—';
    checked.textContent = 'Kontrollitud: ' + new Date(timestamp).toLocaleString('et-EE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    checked.dateTime = data.checkedAt;
  }

  async function load() {
    if (busy) return;
    busy = true;
    try {
      const response = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error('Status unavailable');
      const data = await response.json();
      render(data);
      snapshot = data;
    } catch {
      snapshot = null;
      state.textContent = 'Staatus pole saadaval';
      state.dataset.state = 'unknown';
      players.textContent = '—';
      version.textContent = '—';
    } finally {
      busy = false;
    }
  }

  window.setInterval(() => { if (!document.hidden) load(); }, 60000);
  window.setInterval(() => { if (snapshot) render(snapshot); }, 15000);
  load();
})();
