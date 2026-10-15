/**
 * Resolves bird images and external links (Wikipedia, iNaturalist).
 * Image order: Wikipedia thumbnail -> iNaturalist default photo -> local placeholder.
 */
(function () {
  const CACHE_KEY = "birdEnrichCache.v2";
  const TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const FAIL_TTL_MS = 60 * 60 * 1000;
  const inflight = new Map();
  const pending = [];
  let active = 0;
  function schedule(task) {
    return new Promise((resolve, reject) => {
      pending.push({ task, resolve, reject });
      drain();
    });
  }
  function drain() {
    while (active < 4 && pending.length) {
      const job = pending.shift(); active++;
      Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => { active--; drain(); });
    }
  }
  const errors = [];
  let store = null;

  function loadStore() {
    if (store) return store;
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      store = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }
    catch { store = {}; }
    return store;
  }

  function saveStore() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(store)); }
    catch {
      try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
    }
  }

  function logError(source, name, err) {
    errors.push({ source, name, error: String(err && err.message || err), time: Date.now() });
    if (errors.length > 100) errors.shift();
    console.warn(`[BirdEnricher] ${source} failed for "${name}":`, err);
  }

  function fallbackImage() {
    return `${window.PATH_PREFIX || "/"}img/dummy.webp`;
  }

  function wikiPageUrl(name) {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(name.trim().replace(/\s+/g, "_"))}`;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 429 ? " (rate limited)" : ""}`);
    return res.json();
  }

  async function fromWikipedia(name, language) {
    const query = new URLSearchParams({ action: 'query', format: 'json', origin: '*', titles: name, redirects: '1', prop: 'pageprops|langlinks', llprop: 'url', lllimit: '500' });
    const data = await fetchJson('https://en.wikipedia.org/w/api.php?' + query);
    const page = Object.values(data.query?.pages || {})[0];
    const id = page?.pageprops?.wikibase_item;
    if (!/^Q[0-9]+$/.test(id || '')) throw new Error('No verified species entity');
    const entity = await fetchJson('https://www.wikidata.org/wiki/Special:EntityData/' + id + '.json');
    const claims = entity.entities?.[id]?.claims || {};
    if (!(claims.P225 || []).some(c => c.mainsnak?.datavalue?.value === name)) throw new Error('Scientific name mismatch');
    const localized = page.langlinks?.find(l => l.lang === language);
    let targetLang = localized ? language : 'en';
    let title = localized ? localized['*'] : page.title;
    let summary;
    try {
      summary = await fetchJson('https://' + targetLang + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title));
      if (!summary.extract && targetLang !== 'en') throw new Error('Localized summary unavailable');
    } catch (error) {
      if (targetLang === 'en') throw error;
      targetLang = 'en'; title = page.title;
      summary = await fetchJson('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title));
    }
    return {
      imageUrl: summary.thumbnail?.source || null,
      imageSourceUrl: summary.thumbnail ? 'https://' + targetLang + '.wikipedia.org/wiki/' + encodeURIComponent(title) : null,
      wikiUrl: 'https://' + targetLang + '.wikipedia.org/wiki/' + encodeURIComponent(title),
      localizedName: localized ? localized['*'] : title, nameLanguage: localized ? language : 'en',
      description: summary.extract || null, descriptionLanguage: targetLang,
      nameSource: 'Wikipedia', descriptionSource: 'Wikipedia',
    };
  }

  async function fromINaturalist(name, language) {
    const data = await fetchJson(
      `https://api.inaturalist.org/v2/taxa/autocomplete?q=${encodeURIComponent(name)}&per_page=1&locale=${encodeURIComponent(language)}&fields=id,name,preferred_common_name,default_photo.medium_url,default_photo.square_url,default_photo.attribution`
    );
    const taxon = data && data.results && data.results[0];
    if (!taxon || taxon.name !== name) return { imageUrl: null, inatId: null };
    const photo = taxon.default_photo || {};
    return { imageUrl: photo.medium_url || photo.square_url || null, inatId: taxon.id || null, imageSourceUrl: taxon.id ? `https://www.inaturalist.org/taxa/${taxon.id}` : null };
  }

  async function resolve(name, language) {
    const result = { imageUrl: null, wikiUrl: wikiPageUrl(name), inatId: null, inatUrl: null };
    let failed = false;
    try {
      const w = await fromWikipedia(name, language);
      Object.assign(result, w);
    } catch (e) { failed = true; logError("wikipedia", name, e); }

    // iNaturalist: used for the image when Wikipedia has none, and for the taxon link
    try {
      const i = await fromINaturalist(name, language);
      if (!result.imageUrl) { result.imageUrl = i.imageUrl; result.imageSourceUrl = i.imageSourceUrl; }
      result.inatId = i.inatId;
    } catch (e) { failed = true; logError("inaturalist", name, e); }

    result.inatUrl = result.inatId
      ? `https://www.inaturalist.org/taxa/${result.inatId}`
      : `https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(name)}`;
    result.partial = failed;
    return result;
  }

  /** Returns {imageUrl, wikiUrl, inatUrl, inatId}; imageUrl falls back to placeholder. Never rejects. */
  function enrich(scientificName, language = 'en') {
    const name = (scientificName || "").trim();
    if (!name) return Promise.resolve({ imageUrl: fallbackImage(), wikiUrl: null, inatUrl: null, inatId: null });

    language = /^[a-z]{2,3}$/.test(language) ? language : 'en';
    const key = language + ':' + name;
    const s = loadStore();
    const hit = s[key];
    if (hit?.data && Date.now() < hit.expires) return Promise.resolve({ ...hit.data, imageUrl: hit.data.imageUrl || fallbackImage() });
    if (inflight.has(key)) return inflight.get(key);

    const p = schedule(() => resolve(name, language)).then(data => {
      s[key] = { data, expires: Date.now() + (data.imageUrl && !data.partial ? TTL_MS : FAIL_TTL_MS) };
      const keys = Object.keys(s);
      if (keys.length > 300) keys.slice(0, keys.length - 300).forEach(k => delete s[k]);
      saveStore();
      return { ...data, imageUrl: data.imageUrl || fallbackImage() };
    }).catch(e => {
      logError("enrich", name, e);
      return { imageUrl: fallbackImage(), wikiUrl: wikiPageUrl(name), inatUrl: null, inatId: null };
    }).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  window.BirdEnricher = { enrich, wikiPageUrl, fallbackImage, errors };
})();
