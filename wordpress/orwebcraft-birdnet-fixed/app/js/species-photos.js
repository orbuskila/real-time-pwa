/* OrWebCraft photo repair. Scientific-name matches, attribution, bounded requests. */
const BirdNETPhotos = (() => {
  const memory = new Map();
  const pending = new Map();
  const queue = [];
  const key = 'orwebcraft-birdnet-photos-v1';
  const licenses = new Set(['cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa', 'cc-by-nc-nd', 'cc-by-nd']);
  let active = 0;
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
  const normalize = name => name.trim().toLowerCase();
  function safeURL(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : null;
    } catch (_) { return null; }
  }
  async function lookup(name) {
    const saved = cache[name];
    if (saved && Date.now() - saved.time < 7 * 86400000 && safeURL(saved.photo)) return saved;
    const response = await fetch('https://api.inaturalist.org/v1/taxa?' + new URLSearchParams({q:name, rank:'species', per_page:'5'}),
      {signal:AbortSignal.timeout(12000), credentials:'omit'});
    if (!response.ok) throw new Error('Photo service unavailable');
    const data = await response.json();
    const taxon = data.results?.find(t => normalize(t.name) === normalize(name) && t.iconic_taxon_name === 'Aves');
    const photo = taxon?.default_photo;
    if (!photo || !licenses.has(photo.license_code)) return null;
    const url = safeURL(photo.medium_url || photo.url);
    if (!url) return null;
    const result = {photo:url, attribution:photo.attribution || photo.attribution_name || 'iNaturalist contributor',
      license:photo.license_code, taxon:Number(taxon.id), time:Date.now()};
    cache[name] = result;
    const entries = Object.entries(cache).sort((a,b) => b[1].time-a[1].time).slice(0,500);
    cache = Object.fromEntries(entries);
    try { localStorage.setItem(key, JSON.stringify(cache)); } catch (_) {}
    return result;
  }
  function pump() {
    while (active < 2 && queue.length) {
      const item = queue.shift();
      active++;
      lookup(item.name).then(item.resolve, () => item.resolve(null)).finally(() => {active--; pump();});
    }
  }
  function get(name) {
    if (memory.has(name)) return Promise.resolve(memory.get(name));
    if (pending.has(name)) return pending.get(name);
    const request = new Promise(resolve => {queue.push({name,resolve}); pump();})
      .then(result => {memory.set(name,result); pending.delete(name); return result;});
    pending.set(name,request);
    return request;
  }
  async function load(img) {
    const name = img.dataset.photoSpecies;
    const result = await get(name);
    if (!img.isConnected) return;
    if (!result) {img.alt += ' (photo unavailable)'; return;}
    img.onerror = () => {
      img.onerror = null;
      img.src = (window.PATH_PREFIX || '/') + 'img/dummy.webp';
      img.alt += ' (photo unavailable)';
    };
    img.src = result.photo;
    const taxonLink = img.closest('.card')?.querySelector('.bird-reference-links a[href*="inaturalist.org"]');
    if (taxonLink && Number.isSafeInteger(result.taxon) && result.taxon > 0) taxonLink.href = 'https://www.inaturalist.org/taxa/' + result.taxon;
    const credit = document.createElement('a');
    credit.href = 'https://www.inaturalist.org/taxa/' + result.taxon;
    credit.target = '_blank';
    credit.rel = 'noopener noreferrer';
    credit.className = 'd-block small text-muted px-2 py-1';
    credit.style.fontSize = '0.65rem';
    credit.textContent = result.attribution + ' · ' + result.license;
    img.closest('.card').appendChild(credit);
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {observer.unobserve(entry.target); load(entry.target);}
  }, {rootMargin:'200px'});
  return {observe(img,name) {if (!img || !name) return; img.dataset.photoSpecies = name; observer.observe(img);}};
})();
