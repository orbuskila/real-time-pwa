# OrWebCraft BirdNET Live for WordPress

The [live OrWebCraft page](https://donations.orwebcraft.com/birdnet-live-analyzer/) loads `/wp-content/plugins/orwebcraft-birdnet-fixed/app/index.html?v=1.2.0`. Its separate bird photo search is visible on the WordPress page. The repository root contains the Eleventy browser app, including the multilingual release from [PR #4](https://github.com/orbuskila/real-time-pwa/pull/4) and its own species enrichment code.

| Directory | Local source and dependencies |
| --- | --- |
| `orwebcraft-birdnet-fixed/` | Version 1.2.0 shortcode wrapper and its custom iNaturalist photo helper. The wrapper expects a complete built app at `app/index.html`. |
| `orwebcraft-birdnet-photo-repair/` | Version 0.1.0 backup app overlay. Its two pages and scripts reuse model, styling, and vendor assets from the main plugin. Production installation could not be verified. |
| `orwebcraft-birdnet-updater/` | Version 1.0.0 installer source and checksum manifest from the local release package. The installer requires the exact matching `payload/` from that package. Production installation could not be verified. |

These are historical local source copies. This directory alone is insufficient to install the main plugin or run the updater. The PWA build instructions and licenses are in the [root README](../README.md). Keep the BirdNET license notices with redistributed source or model files and retain image attribution at the source. Model files, bundled vendor libraries, photos, and release archives are omitted here.

## Files to supply for an exact production snapshot

1. A current export of `wp-content/plugins/orwebcraft-birdnet-fixed/`, including its main PHP file and custom files under `app/` such as HTML, JavaScript, CSS, translations, and service-worker changes. This is needed to verify which local copies match production.
2. The WordPress block markup or custom HTML for the analyzer and backup pages, plus any custom PHP or JavaScript snippets or must-use plugin files that implement the separate photo search or register its shortcodes.
3. If the backup or updater plugin is installed, its current source folder and version. For updater reproduction, provide the exact payload from the existing local release package or a verified reference to that package. The hash manifest refers to the packaged bytes.

Export only the files relevant to these pages, with credentials and site configuration removed.
