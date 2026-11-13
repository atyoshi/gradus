# macOS app

`npm run build:mac` creates the Apple Silicon `.app`, DMG installer, and ZIP in `release/`. Open the DMG and drag **Gradus ad Parnassum** into Applications. The installed app works offline without Node.js or a terminal.

`npm run build:mac:intel` builds the Intel variant. `npm run desktop` runs the desktop app from source.

The app stores its notebook and browser recovery data in `~/Library/Application Support/Gradus ad Parnassum/`. Use **Gradus ad Parnassum → Show Notebook Folder** to find it. Moving or updating the application preserves this folder. Never store personal notebooks inside the application bundle.

To move your existing browser notebook, run the original web version (`npm start`), open http://127.0.0.1:4173, export a JSON backup on **Your notebook**, then restore that backup on **Your notebook** in the Mac app. The app uses a separate database; the original `data/gradus.sqlite` remains available. Browser-only unsaved recovery drafts should first be saved in the original browser.

Only one app instance runs. The desktop backend binds to 127.0.0.1:4175, keeping a stable origin for recovery storage. Startup reports a port conflict instead of connecting to another server. Downloads use the desktop Save dialog. External source links open in the default browser.

Builds are currently unsigned and unnotarized. For a downloaded copy blocked by Gatekeeper, use macOS **System Settings → Privacy & Security → Open Anyway** only for a build you trust. For public distribution, configure a Developer ID Application identity in `build.mac.identity` (currently `null`) and electron-builder's notarization credentials, then rebuild. No signing credentials are included in this project.

The build deliberately includes only the compiled frontend, desktop entry point, server, and runtime dependencies. Personal databases, test output, and the Parnasso comparison snapshot are excluded.
