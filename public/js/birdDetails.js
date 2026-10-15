/* Shareable species cards; no microphone, model, or extra analyzer is created. */
(function () {
  const map = 'https://donations.orwebcraft.com/birds-on-earth-birdnet-live-map/';
  let dialog, generation = 0, activeName;
  const text = (tag, value, parent, lang) => {
    const el = document.createElement(tag); el.textContent = value; el.dir = 'auto';
    if (lang) el.lang = lang; parent.append(el); return el;
  };
  function link(label, url, parent) {
    const a = text('a', label, parent); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.className = 'btn btn-outline-primary m-1'; return a;
  }
  function decorate(card, name, info) {
    const heading = card.querySelector('.card-title');
    if (heading && info.localizedName) {
      heading.textContent = info.localizedName; heading.title = info.localizedName; heading.lang = info.nameLanguage; heading.dir = 'auto';
      const img = card.querySelector('img'); if (img) img.alt = info.localizedName;
    }
    const links = card.querySelector('.bird-links');
    if (links && !links.querySelector('.species-details')) {
      const button = text('button', t('species_details'), links); button.type = 'button';
      button.className = 'species-details btn btn-sm btn-outline-primary';
      button.addEventListener('click', () => open(name));
    }
  }
  async function open(name) {
    if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z .-]{2,119}$/.test(name)) return;
    activeName = name;
    const run = ++generation;
    if (!dialog) { dialog = document.createElement('dialog'); dialog.className = 'species-dialog'; document.body.append(dialog); }
    dialog.replaceChildren();
    const close = text('button', t('btn_close'), dialog); close.className = 'btn btn-secondary'; close.onclick = () => { generation++; dialog.close(); };
    const heading = text('h2', name, dialog); heading.id = 'speciesDialogTitle'; dialog.setAttribute('aria-labelledby', heading.id);
    const body = text('div', t('species_loading'), dialog); body.setAttribute('aria-live','polite');
    if (!dialog.open) dialog.showModal();
    close.focus();
    const language = currentUiLang;
    const results = await Promise.all([language, 'he', 'en'].map(lang => BirdEnricher.enrich(name, lang)));
    if (run !== generation || !dialog.open || language !== currentUiLang) return;
    body.replaceChildren();
    const info = results[0];
    for (const [i, lang] of [language, 'he', 'en'].entries()) {
      if (i && lang === language) continue;
      const r = results[i];
      const fallback = r.nameLanguage && r.nameLanguage !== lang ? ' (' + r.nameLanguage + ')' : '';
      text('p', lang.toUpperCase() + fallback + ': ' + (r.localizedName || name), body, r.nameLanguage || 'la');
    }
    text('p', name, body, 'la');
    const image = document.createElement('img'); image.src = info.imageUrl; image.alt = info.localizedName || name;
    image.onerror = () => { image.onerror = null; image.src = BirdEnricher.fallbackImage(); }; body.append(image);
    if (info.description) text('p', info.description, body, info.descriptionLanguage);
    else text('p', t('species_no_description'), body);
    if (info.descriptionLanguage && info.descriptionLanguage !== language) text('small', t('species_english_fallback'), body);
    if (info.wikiUrl) link('Wikipedia (' + (info.descriptionLanguage || 'en') + ') · CC BY-SA', info.wikiUrl, body);
    if (info.imageSourceUrl) link(t('image_source'), info.imageSourceUrl, body);
    if (info.inatUrl) link('iNaturalist', info.inatUrl, body);
    link(t('species_recordings'), 'https://xeno-canto.org/explore?query=' + encodeURIComponent(name), body);
    text('small', t('species_recordings_hint'), body);
    const url = new URL((window.PATH_PREFIX || '/') + 'species/', location.origin); url.searchParams.set('species',name); url.searchParams.set('lang',language);
    const share = text('input', '', body); share.value = url.href; share.readOnly = true; share.className = 'form-control mt-2'; share.setAttribute('aria-label',t('species_share'));
    link(t('map_link'), map, body);
  }
  document.addEventListener('birdnet:language', () => {
    if (dialog?.open && activeName) open(activeName);
  });
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    if (params.has('species')) {
      document.addEventListener('birdnet:language', () => open(params.get('species')), {once:true});
    }
  });
  window.BirdDetails = { open, decorate };
})();
