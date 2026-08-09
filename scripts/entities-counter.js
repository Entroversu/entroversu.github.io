(() => {
  const counter = document.querySelector('[data-entities-counter]');
  if (!counter) return;

  const output = counter.querySelector('[data-entities-count]');
  const endpoint = counter.dataset.endpoint;
  const storageKey = 'entroversu.entity-entered.v1';

  if (!output || !endpoint) return;

  const request = async () => {
    let hasEntered = false;

    try {
      hasEntered = localStorage.getItem(storageKey) === 'yes';
    } catch {
      // Storage can be unavailable in restricted browser modes. The service
      // still works, but the resulting public number remains approximate.
    }

    const response = await fetch(`${endpoint}/${hasEntered ? 'count' : 'enter'}`, {
      method: hasEntered ? 'GET' : 'POST',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) throw new Error(`Entity counter returned ${response.status}`);

    const data = await response.json();
    if (!Number.isSafeInteger(data.count) || data.count < 0) {
      throw new Error('Entity counter returned an invalid count');
    }

    if (!hasEntered) {
      try {
        localStorage.setItem(storageKey, 'yes');
      } catch {
        // The counter intentionally avoids fallback identifiers or tracking.
      }
    }

    output.textContent = new Intl.NumberFormat('en-US').format(data.count);
    counter.dataset.state = 'ready';
  };

  request().catch(() => {
    output.textContent = '—';
    counter.dataset.state = 'unavailable';
  });
})();
