/* Language choices describe content availability, not a promise of translated UI. */
(function () {
  const codes = 'af am ar as az be bg bn bo br bs ca ceb co cs cy da de el en eo es et eu fa fi fil fo fr fy ga gd gl gu ha he hi hr ht hu hy id ig is it ja jv ka kk km kn ko ku ky la lb lo lt lv mg mi mk ml mn mr ms mt my ne nl nn no oc or pa pl ps pt qu ro ru rw sa sd si sk sl sm sn so sq sr st su sv sw ta te tg th tk tl tn to tr tt ug uk ur uz vi wo xh yi yo zh zu'.split(' ');
  const ui = new Set(['en', 'he', 'ar', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ru']);
  const rtl = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi']);
  const displayName = (locale, code) => {
    try { return new Intl.DisplayNames([locale], { type: 'language' }).of(code); }
    catch { return ({en: 'English', he: 'עברית', ar: 'العربية'})[code] || code; }
  };
  const languages = codes.map(code => {
    let native;
    native = displayName(code, code);
    return { code, native, english: displayName('en', code), ui: ui.has(code), dir: rtl.has(code) ? 'rtl' : 'ltr' };
  });
  function normalize(value) {
    const code = String(value || '').toLowerCase().split(/[-_]/)[0];
    return languages.some(l => l.code === code) ? code : 'en';
  }
  window.BirdLanguages = { languages, normalize, ui, rtl };
})();
