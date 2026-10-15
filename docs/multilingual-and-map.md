# Multilingual analyzer and Birds on Earth

This branch is stacked on `copilot/replace-cornell-image-dependency` at `a255256`, the head of draft PR #2. PR #2 is stacked on PR #1. Neither existing PR was merged or modified. Review the multilingual diff against PR #2; do not merge upstream branches merely to get this feature.

## Language coverage

The shared, searchable picker contains over 100 native and English language names. English, Hebrew and Arabic have matching keys for all application UI, About and Share text. Seven previously supplied translations remain available with English fallback for new keys. Other language choices keep English UI and clearly say so; they select the requested species-content language. The existing English legal notice is retained as supplied, not presented as a legal translation. Color-map and product names retain their names.

Preference order is explicit `?lang=`, saved preference, then browser language. `bn_ui_lang` stores the species/UI preference; storage denial keeps the app usable for the session. UI changes do not restart the model or microphone. The separate BirdNET model-label setting still supports only bundled label files. There is no fabricated Hebrew label file.

RTL languages change layout direction and load Bootstrap's RTL stylesheet. `html.lang` identifies the actual UI language, including English fallback. Names and descriptions carry their source language and use bidirectional isolation. The language picker uses labeled native controls, search by native/English name or code, touch-sized controls, and live availability text. Closed settings are inert, keyboard focus stays inside open settings, and native species dialogs provide keyboard dismissal.

## Species data

Wikipedia redirects resolve the scientific name, Wikidata P225 must match that name exactly, and Wikipedia language links select the localized article. The displayed localized name is the article title, not a claim of an independently verified vernacular name. Summaries retain source/language metadata; absent or failed localized summaries fall back to English. Names unavailable in Hebrew or another chosen language are identified by their actual language. No automatic translations are invented.

Images retain PR #2's Wikipedia → exact-match iNaturalist → local placeholder order. Details link to the image source/credits and to Wikipedia for summary attribution. Image licenses must be checked at the linked source; they are not assumed to match the summary license. Source lookups have timeouts, a four-job concurrency limit, language-specific cache keys, bounded cache size, in-flight deduplication, and shorter retry periods for partial failures. Cards outside the viewport are enriched when they come into view.

Species dialogs show the selected language plus Hebrew and English names, scientific name, available image and description, external sources and a shareable link. Sound is a link to species recordings on xeno-canto, not an embedded recording or an invented observation-specific sound. Recording availability and licensing remain with the source.

## Map integration

Example link after deployment:

`https://donations.orwebcraft.com/birdnet-live-analyzer/species/?species=Passer%20domesticus&lang=he`

The dedicated species route loads no worker, model, geolocation or microphone. It uses the existing enrichment component and dialog. The analyzer navigation links back to Birds on Earth. It does not embed another analyzer or replace the map.

`public/js/birdsOnEarthBridge.js` is an optional helper for the **WordPress map popup renderer**. After the tested analyzer is deployed, enqueue the helper on the map page and append a link where the renderer already has an exact scientific name:

```js
// In the existing map plugin's popup renderer:
popupElement.appendChild(
  window.BirdsOnEarthBridge.createSpeciesLink(observation.scientificName, 'he')
);
```

`observation.scientificName` is illustrative: bind it to the actual plugin schema rather than guessing the field. The helper validates the species value, constructs an encoded URL and uses textContent. It does not inject HTML from observation data and creates no analyzer.

The inspected public map page links to Cornell's submission map and appears to embed it. That iframe belongs to a different origin. This repository cannot inspect its bird clicks or modify its popups. An actual map-selection connection requires either an existing documented event API from Cornell, or access to the WordPress plugin's own data/popup renderer. No unrestricted postMessage listener or iframe scraping is added. This bridge is prepared, not installed into WordPress.

## Validation and release

Run `node --test tests/*.test.cjs`, then `npm ci` and `npm run build`. Repeat the build with `ELEVENTY_PATH_PREFIX=/birdnet-live-analyzer/`. The validation workflow builds both prefixes without deploying and saves the custom-prefix site as a preview artifact.

Before release, preview Live, Explore, About, Share and a species deep link on mobile and desktop. Check Hebrew/Arabic/English switching, keyboard navigation, real API responses/CORS, unavailable translations, image failure, and recording/source links. Test microphone identification on an HTTPS staging origin; source-network failures must not affect inference. Native-speaker review of Hebrew/Arabic wording and a deployment-specific review of the inherited legal notice remain necessary.

Deployment/merging is a separate approval step. Pushing this draft branch does not trigger the existing main-only Pages deployment workflow. Installing the WordPress bridge requires the map plugin's code/access and a reviewable change there. No WordPress settings or production pages are changed by this branch.
