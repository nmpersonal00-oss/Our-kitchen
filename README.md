# The Little Kitchen — V5 · Bunny Stories

This version fixes iPhone top-safe-area overlap, removes browser-native validation bubbles from Quick Add, and adds **five different detailed bunny artwork scenes**. All grocery, recipe, image upload, editing, step-photo and backup functions remain available.

## Quick add
Type an item and tap **Add item** to save immediately. Pressing Add item while the field is blank opens the item editor instead of showing “Fill out this field.” The app only shows the iPhone keyboard when you tap an actual text field; the keyboard does not reopen after each saved item.

## Artwork
- Groceries: bunny holding paper bags of produce.
- Recipes: bunny reading a recipe book surrounded by books.
- Food: bunny preparing vegetables on a cutting board.
- Drinks: bunny holding a cozy marshmallow-topped cocoa mug.
- Desserts: bunny placing a strawberry cake on the table.

Artwork is original SVG vector illustration in `assets/bunny-*.svg` and **embedded within `index.html`**, so no separate art files are required for the web page to display correctly.

## Publishing to your existing site
1. In the current app, go to **Settings → Export** to back up your saved recipes, step photos and groceries.
2. Publish all extracted files together to the same site directory, replacing the previous files. The standalone `index.html` includes everything needed for the illustration and functional UI.
3. Reopen the site. If an older page persists, close and reopen the installed Home Screen app or clear the website cache. This build updates the service-worker cache version.

Data remains saved in this browser's IndexedDB at the same URL / origin; the update does not clear it. There is no automatic multi-device sync.

The screenshot and artwork scenes are authored illustrations, not a promise of externally AI-generated raster images.
