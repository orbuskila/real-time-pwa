/* Optional WordPress popup helper. Load this on the map page, not inside Cornell's iframe. */
(function () {
  function createSpeciesLink(scientificName, language = 'he') {
    if (typeof scientificName !== 'string' || !/^[A-Za-z][A-Za-z .-]{2,119}$/.test(scientificName)) {
      throw new TypeError('An exact scientific species name is required');
    }
    const url = new URL('https://donations.orwebcraft.com/birdnet-live-analyzer/species/');
    url.searchParams.set('species', scientificName);
    url.searchParams.set('lang', /^[a-z]{2,3}$/.test(language) ? language : 'he');
    const link = document.createElement('a');
    link.href = url.href;
    link.textContent = 'פרטי הציפור · Bird details';
    link.dir = 'auto'; link.target = '_blank'; link.rel = 'noopener noreferrer';
    return link;
  }
  window.BirdsOnEarthBridge = { createSpeciesLink };
})();
