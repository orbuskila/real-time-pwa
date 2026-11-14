OrWebCraft BirdNET Release Installer 1.0.0

Release commit: 391739c97cdadbb90eca6c6c19e8880a02674529 (merged PR #4).
Target: wp-content/plugins/orwebcraft-birdnet-fixed/app/

INSTALL
1. WordPress > Plugins > Add Plugin > Upload Plugin.
2. Upload orwebcraft-birdnet-updater-1.0.0.zip, Install Now, Activate.
3. Tools > BirdNET Release > Back up and install tested release.
4. Open the existing analyzer page, refresh and test English, Hebrew and Arabic.

ROLLBACK
Tools > BirdNET Release > Restore original analyzer.
The original app is preserved as app-backup-TIMESTAMP-RANDOM inside the existing
orwebcraft-birdnet-fixed plugin directory. Rollback retains the new release in an
app-retired-TIMESTAMP-RANDOM folder. Nothing is automatically deleted. Keep this
installer installed while you want its rollback button. Activation and deactivation
do not alter the analyzer. Existing plugin PHP, WordPress pages and map are untouched.

Checks verify all app file hashes before switches. Unexpected edits stop rollback.
If copying is interrupted before the switch, the original app stays active and an
unused app-stage folder can remain. If interrupted during a switch, recovery state
is saved in WordPress option orwebcraft_birdnet_release_20261015; keep all folders
and seek hosting help. The app-backup folder can be renamed to app to recover if
app is absent. Do not remove folders until recovery is confirmed.

This package does not install the optional map popup bridge. The existing map is
preserved. Mobile tests used emulation; physical-device microphone checks remain.
Browser service workers/CDN caches can retain old assets until refreshed or purged.

Validation: 20 analyzer regression tests, six browser flows and both builds passed
in GitHub Actions run 38780414354. Plugin integration harness: 18 passing checks on
PHP 7.4.33 and PHP 8.3.35, including failure recovery, hashes, capabilities and complete rollback.
