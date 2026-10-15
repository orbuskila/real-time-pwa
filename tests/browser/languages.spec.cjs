const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const locales = Object.fromEntries(['en', 'he', 'ar'].map(code => [code, require('../../public/locales/' + code + '.json')]));
const names = { en: 'House sparrow', he: 'דרור הבית', ar: 'عصفور دوري' };
// Deterministic species fixtures exercise the real enrichment/DOM code. Live source
// availability is checked separately; captions identify fixture-backed screenshots.
async function speciesFixtures(page) {
  await page.route(/https:\/\/(en|he|ar)\.wikipedia\.org\/(w\/api\.php|api\/rest_v1\/page\/summary\/)/, async route => {
    const url = new URL(route.request().url());
    const lang = url.hostname.split('.')[0];
    const data = url.pathname.includes('/w/api.php')
      ? { query: { pages: { 1: { title: names.en, pageprops: { wikibase_item: 'Q14683' }, langlinks: [{ lang: 'he', '*': names.he }, { lang: 'ar', '*': names.ar }] } } } }
      : { extract: { en: 'Preview species: the house sparrow is a small bird commonly found near people.', he: 'מין לדוגמה בתצוגה המקדימה: דרור הבית הוא ציפור קטנה הנפוצה בקרבת האדם.', ar: 'نوع تجريبي للمعاينة: العصفور الدوري طائر صغير شائع قرب مساكن الإنسان.' }[lang], thumbnail: { source: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/House_sparrow_male_in_Prospect_Park_%2853532%29.jpg/330px-House_sparrow_male_in_Prospect_Park_%2853532%29.jpg' } };
    await route.fulfill({ json: data, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('https://www.wikidata.org/wiki/Special:EntityData/Q14683.json', route => route.fulfill({json:{entities:{Q14683:{claims:{P225:[{mainsnak:{datavalue:{value:'Passer domesticus'}}}]}}}},headers:{'access-control-allow-origin':'*'}}));
  await page.route('https://api.inaturalist.org/**', route => route.fulfill({ json: { results: [{ id: 13858, name: 'Passer domesticus' }] }, headers: { 'access-control-allow-origin': '*' } }));
}
async function noHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
async function capture(page, info, lang, screen) {
  const dir = path.resolve('preview-screenshots'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, info.project.name + '-' + lang + '-' + screen + '.png');
  await page.screenshot({ path: file, fullPage: true });
  await info.attach(screen, { path: file, contentType: 'image/png' });
}
for (const lang of ['en', 'he', 'ar']) {
  test(lang + ': language, navigation, settings, persistence and species details', async ({ page }, info) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await speciesFixtures(page);
    const ui = locales[lang];
    await page.goto('./');
    const picker = page.locator('#languageSelect');
    expect(await picker.locator('option').count()).toBeGreaterThanOrEqual(100);
    await picker.selectOption(lang);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
    await expect(page.locator('#languageSearch')).toHaveAttribute('placeholder', ui.language_search);
    await noHorizontalOverflow(page);
    await page.locator('#languageSearch').fill(names[lang] === names.he ? 'עברית' : lang === 'ar' ? 'العربية' : 'English');
    await expect(picker.locator('option:checked')).toHaveAttribute('value', lang);
    await page.locator('#languageSearch').fill('');
    await page.locator('#settingsToggle').click();
    await expect(page.locator('#settingsDrawer')).toHaveAttribute('aria-hidden','false');
    await expect(page.locator('#settingsClose')).toBeFocused();
    await expect(page.locator('#settingsDrawer')).toContainText(ui.lbl_label_lang);
    await page.keyboard.press('Shift+Tab');
    expect(await page.locator('#settingsDrawer').evaluate(el=>el.contains(document.activeElement))).toBe(true);
    await capture(page,info,lang,'settings');
    await page.keyboard.press('Escape');
    await expect(page.locator('#settingsToggle')).toBeFocused();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang',lang);
    await expect(picker).toHaveValue(lang);
    await capture(page,info,lang,'live');
    await page.goto('about/');
    await expect(page.locator('h1')).toHaveText(ui.about_title);
    await noHorizontalOverflow(page);
    await capture(page,info,lang,'about');
    await page.goto('explore/');
    await expect(page.locator('h1')).toHaveText(ui.msg_explore_title);
    await noHorizontalOverflow(page);
    await page.goto('share/');
    await expect(page.locator('h1')).toHaveText(ui.share_title);
    await noHorizontalOverflow(page);
    await page.goto('species/?species=Passer%20domesticus&lang='+lang);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(names.he);
    await expect(dialog).toContainText(names.en);
    await expect(dialog).toContainText(names[lang]);
    await expect(dialog).toContainText('Passer domesticus');
    await expect(dialog.getByRole('link',{name:ui.species_recordings,exact:true})).toHaveAttribute('href',/xeno-canto\.org/);
    const share = dialog.getByRole('textbox',{name:ui.species_share});
    await expect(share).toHaveValue(new RegExp('/species/\\?species=Passer\\+domesticus&lang='+lang));
    expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await capture(page,info,lang,'species-fixture');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    expect(errors).toEqual([]);
  });
}
