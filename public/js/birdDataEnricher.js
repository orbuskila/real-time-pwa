/**
 * Resolves bird images and external links (Wikipedia, iNaturalist).
 * Image order: Wikipedia thumbnail -> iNaturalist default photo -> local placeholder.
 */
(function () {
  const CACHE_KEY = "birdEnrichCache.v1";
  const TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const FAIL_TTL_MS = 60 * 60 * 1000;
  const inflight = new Map();
  const errors = [];
  let store = null;

  function loadStore() {
    if (store) return store;
    try { store = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {}; }
    catch { store = {}; }
    return store;
  }

  function saveStore() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(store)); }
    catch {
      store = {};
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
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 429 ? " (rate limited)" : ""}`);
    return res.json();
  }

  async function fromWikipedia(name) {
    const title = encodeURIComponent(name.trim().replace(/\s+/g, "_"));
    const data = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);
    const page = data && data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page;
    return {
      imageUrl: data && data.thumbnail && data.thumbnail.source || null,
      wikiUrl: page || wikiPageUrl(name),
    };
  }

  async function fromINaturalist(name) {
    const data = await fetchJson(
      `https://api.inaturalist.org/v2/taxa/autocomplete?q=${encodeURIComponent(name)}&per_page=1&fields=id,default_photo.medium_url,default_photo.square_url`
    );
    const taxon = data && data.results && data.results[0];
    if (!taxon) return { imageUrl: null, inatId: null };
    const photo = taxon.default_photo || {};
    return { imageUrl: photo.medium_url || photo.square_url || null, inatId: taxon.id || null };
  }

  async function resolve(name) {
    const result = { imageUrl: null, wikiUrl: wikiPageUrl(name), inatId: null, inatUrl: null };
    let failed = false;
    try {
      const w = await fromWikipedia(name);
      result.imageUrl = w.imageUrl;
      result.wikiUrl = w.wikiUrl;
    } catch (e) { failed = true; logError("wikipedia", name, e); }

    // iNaturalist: used for the image when Wikipedia has none, and for the taxon link
    try {
      const i = await fromINaturalist(name);
      if (!result.imageUrl) result.imageUrl = i.imageUrl;
      result.inatId = i.inatId;
    } catch (e) { failed = true; logError("inaturalist", name, e); }

    result.inatUrl = result.inatId
      ? `https://www.inaturalist.org/taxa/${result.inatId}`
      : `https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(name)}`;
    result.partial = failed && !result.imageUrl;
    return result;
  }

  /** Returns {imageUrl, wikiUrl, inatUrl, inatId}; imageUrl falls back to placeholder. Never rejects. */
  function enrich(scientificName) {
    const name = (scientificName || "").trim();
    if (!name) return Promise.resolve({ imageUrl: fallbackImage(), wikiUrl: null, inatUrl: null, inatId: null });

    const s = loadStore();
    const hit = s[name];
    if (hit && Date.now() < hit.expires) return Promise.resolve({ ...hit.data, imageUrl: hit.data.imageUrl || fallbackImage() });
    if (inflight.has(name)) return inflight.get(name);

    const p = resolve(name).then(data => {
      s[name] = { data, expires: Date.now() + (data.imageUrl ? TTL_MS : FAIL_TTL_MS) };
      saveStore();
      return { ...data, imageUrl: data.imageUrl || fallbackImage() };
    }).catch(e => {
      logError("enrich", name, e);
      return { imageUrl: fallbackImage(), wikiUrl: wikiPageUrl(name), inatUrl: null, inatId: null };
    }).finally(() => inflight.delete(name));
    inflight.set(name, p);
    return p;
  }

  window.BirdEnricher = { enrich, wikiPageUrl, fallbackImage, errors };
})();
