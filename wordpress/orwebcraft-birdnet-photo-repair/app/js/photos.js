/* Species photos: iNaturalist. Attribution is retained beside each image. */
(() => {
  const cache = new Map();
  const queue = [];
  let active = 0;
  const normalize = value => String(value || '').trim().toLowerCase();
  const licenses = {
    'cc0': 'https://creativecommons.org/publicdomain/zero/1.0/',
    'cc-by': 'https://creativecommons.org/licenses/by/4.0/',
    'cc-by-sa': 'https://creativecommons.org/licenses/by-sa/4.0/',
    'cc-by-nc': 'https://creativecommons.org/licenses/by-nc/4.0/',
    'cc-by-nc-sa': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    'cc-by-nd': 'https://creativecommons.org/licenses/by-nd/4.0/',
    'cc-by-nc-nd': 'https://creativecommons.org/licenses/by-nc-nd/4.0/'
  };
  function request(name) {
    if (cache.has(name)) return cache.get(name);
    const result = new Promise(resolve => { queue.push({ name, resolve }); pump(); });
    cache.set(name, result);
    return result;
  }
  function pump() {
    while (active < 3 && queue.length) {
      const task = queue.shift();
      active++;
      (async () => {
        try {
          const params = new URLSearchParams({ q: task.name, taxon_id: '3', per_page: '5' });
          const response = await fetch('https://api.inaturalist.org/v1/taxa?' + params, { signal: AbortSignal.timeout(12000), credentials: 'omit' });
          if (!response.ok) throw new Error('Photo lookup unavailable');
          const data = await response.json();
          const match = (data.results || []).find(t => normalize(t.name) === normalize(task.name));
          const photo = match && match.default_photo;
          if (!photo || !licenses[photo.license_code]) return null;
          const url = new URL(photo.medium_url || photo.url);
          if (url.protocol !== 'https:') return null;
          return { url: url.href, attribution: photo.attribution, license: photo.license_code, photoId: photo.id, taxonId: match.id };
        } catch (_) { return null; }
      })().then(task.resolve).finally(() => { active--; pump(); });
    }
  }
  function attach(img) {
    if (img.dataset.photoHandled) return;
    img.dataset.photoHandled = 'true';
    let name;
    try { name = decodeURIComponent(img.dataset.birdSpecies); } catch (_) { name = ''; }
    const area = img.parentElement;
    const note = document.createElement('span');
    note.textContent = 'Loading photo…';
    note.style.cssText = 'display:block;padding:8px;font-size:12px;overflow-wrap:anywhere';
    area.appendChild(note);
    request(name).then(photo => {
      if (!img.isConnected) return;
      if (!photo) { note.textContent = 'Photo unavailable'; return; }
      const credit = document.createElement('p');
      credit.className = 'small text-muted mt-2 mb-0';
      credit.append(document.createTextNode('Photo: ' + (photo.attribution || photo.license) + ' '));
      const link = document.createElement('a');
      link.href = 'https://www.inaturalist.org/photos/' + photo.photoId;
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = 'Source & license ↗';
      credit.appendChild(link);
      const card = img.closest('.card');
      const content = card && card.querySelector('.card-body');
      if (content) content.appendChild(credit);
      img.onload = () => { img.hidden = false; note.hidden = true; };
      img.onerror = () => { img.hidden = true; note.hidden = false; note.textContent = 'Photo unavailable'; };
      img.src = photo.url;
    });
  }
  const scheduled = new WeakSet();
  const visible = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      visible.unobserve(entry.target);
      const img = entry.target.querySelector('img[data-bird-species]');
      if (img) attach(img);
    }
  }, { rootMargin: '250px' });
  function scan() {
    document.querySelectorAll('img[data-bird-species]').forEach(img => {
      if (scheduled.has(img)) return;
      scheduled.add(img);
      visible.observe(img.parentElement);
    });
  }
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
})();
