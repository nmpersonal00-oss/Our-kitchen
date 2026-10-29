# The Little Kitchen — Version 3 (Fixed Artwork + Kawaii Cottage)

This update is a real, functional recipe and grocery app. The main **index.html is completely self-contained**, with embedded SVG illustrations, CSS, JavaScript, and the kitchen logo. Even if your web host fails to upload an `assets/` directory, the background, grocery art, and starter recipe illustrations still appear.

## Publish safely

1. **Export a backup before updating**, using Settings → Export on your currently published Little Kitchen site.
2. On your Little Kitchen GitHub repository, replace `index.html` with the new file from this ZIP. For full PWA/offline behavior, also replace `sw.js`, `manifest.webmanifest`, and `assets/` folder. Use the *contents* of the ZIP in your website root, not a nested folder.
3. Commit/publish and **hard refresh** the site (Ctrl/Cmd+Shift+R on desktop; on mobile, close/reopen the website). If the old app is still shown, clear the old website's cached files/service worker for that site (this does not necessarily preserve local data, so export a backup first).
4. If you're using GitHub Pages, allow deployment to complete and check the published `index.html` rather than opening a previous preview or saved download.

The app keeps using the original IndexedDB database `little-kitchen-recipes-v1` at the *same exact site origin*. Recipes, shopping lists, notes, photos, and settings are not intentionally reset. Switching domains or clearing site data can lose local data. Always keep a backup.

## What is included

- Grocery list as first tab, Recipes, Food, Drinks, Desserts, Settings under top-left cookbook icon.
- Detailed grocery manager with quantities, aisles, stores, prices, budget, filtering, shopping progress and recipe ingredient import.
- Recipe diaries with cover art/photo, ingredients, notes, cooking steps, and **a separate user-uploaded picture on every step**.
- Integrated soft-kawaii cottage artwork with warm cream, muted rose, gingham curtains, bakery details, bows and flowers. **No faces**.
- Inlined vector artwork prevents broken SVG asset paths. The icons and CSS don't need external CDNs to render.
- Export/import recipe and grocery backups (JSON), grocery CSV exports.

The illustrated assets are original SVG vector drawings, not images created by an AI image-generation model. The app still works locally after the first download, and can be served from any static web host. For best results use HTTPS and host the whole folder.
