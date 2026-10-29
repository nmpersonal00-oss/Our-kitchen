# The Little Kitchen — Grocery List & Recipe Book (Version 2)

A standalone, mobile-first autumn cooking app. This update is based on the prior Little Kitchen recipe diary and uses the same local browser database; it does **not** change the health app repository.

## Features

- **Five bottom tabs:** Groceries (first), Recipes, Food, Drinks, Desserts.
- **Settings:** tap the illuminated Little Kitchen icon in the upper-left corner, on any list page. The icon opens settings; the X button returns to your previous tab.
- **Grocery list:** quick add; item editor with quantities, units, aisles, stores, estimated unit prices, priority, purchased status, notes, and optional originating recipe; search, store/category filters, aisle/store grouping, checkout progress, estimated totals, optional budget, clear purchased/clear all, and CSV export.
- **Add ingredients from recipes:** open any saved recipe, tap **Add to groceries**, choose ingredients, then tap **Add selected**. Or tap **Add from recipe** on the grocery screen. Numeric amounts and common units are parsed when possible; unknown ingredient formats remain editable. Matching unpurchased items with the same name, unit, and store are combined.
- **Recipe book:** save/edit/duplicate/delete/favorite recipes and filter by recipe type; cover photo, cooking time, servings, difficulty, ingredients, instructions, and notes.
- **Step-by-step photos:** attach or replace a photo on **each** individual cooking step. Upload images from inside the recipe detail or editor. Images are resized/compressed before storage.
- **Original bundled illustrated artwork:** autumn kitchen backdrop, market basket composition, food images, sticker details, glowing edges, custom iconography. Art is local SVG rather than a remotely generated or dynamically loaded image.
- **Backup:** Settings → Export saves recipes, groceries, and embedded photos to a JSON file. Import supports both the original v1 cookbook backups and v2 backups (adds data as new entries). Grocery CSV export is separate and for spreadsheet/shopping use, not for full backups.
- **Installable PWA:** works from static HTTPS hosting (e.g. GitHub Pages), supports Add to Home Screen and offline use after initial load.

## Run and publish

Upload the entire folder contents to the **root of a new, separate GitHub repository**, then enable GitHub Pages in **Settings → Pages → Deploy from a branch → main / (root)**. Open the published HTTPS URL on an iPhone, then use **Share → Add to Home Screen**. Do not overwrite the original health app.

For local development, run `python3 -m http.server 8000` in this folder and open `http://localhost:8000` (the local server is preferable to `file://` for browser storage and service workers).

## Data and limitations

Data remains in **IndexedDB inside the current browser/device** and is not synced between phones. Browser storage clearing, private browsing, or reinstalling may erase local data. Export a JSON backup regularly. User photos are stored inside the database; storage size limits depend on the device/browser. The eight built-in starter recipes are illustrative examples. Prices are manually estimated in USD; there is no store-price lookup or live grocery pricing.

When replacing the original v1 Little Kitchen files at the **same published URL**, IndexedDB is upgraded in place from version 1 to version 2 without intentionally deleting saved recipes. Before replacing a site, still export a v1 JSON backup. Hosting at a different URL or origin creates a separate local database (import a backup to transfer your data).

## Files

- `index.html`: application shell.
- `app.js`: grocery workflows, recipe editor, photos, local database, imports/exports.
- `styles.css` + `visual-upgrade.css`: layout, autumn atmosphere, responsive design.
- `assets/`: the included original SVG illustrations and icons.
- `manifest.webmanifest`, `sw.js`: home-screen install and offline caching.
- `make_art.py`: source script for the preexisting recipe art.
