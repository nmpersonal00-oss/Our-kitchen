# The Little Kitchen — V4 (Simple Grocery Checklist)

A fully functional, mobile-first illustrated recipe diary with a streamlined groceries tab.

## What changed
- Grocery page now has **one Add item field and button**, followed by **one large high-contrast checklist**.
- Tap any square checkbox to mark an item bought (or uncheck it). Purchased items remain on the list.
- Tap the item name or pencil to change the name, quantity, unit, or notes, or delete the item.
- Removed the grocery search, store/aisle selectors, sorting, chips, extra add buttons, cost display, and grouped sections from the groceries screen.
- Recipe ingredient import remains available inside each recipe's details page.
- Preserved all V3 illustrated backgrounds, icons, recipes, step photos, and settings.
- Existing grocery and recipe data remain in the same IndexedDB stores; no reset/migration.

## Install / publish
Publish the **entire contents of this folder** to the same GitHub Pages location, including `index.html`, `sw.js`, `manifest.webmanifest`, and `assets/`. `index.html` contains the full CSS, JavaScript, and embedded illustration assets, and can be previewed on its own. Reload the published site (or close and reopen the installed app) to pick up the changed service worker.

**Back up first:** From Little Kitchen, tap the upper-left book icon → Settings → Export. Data is local to this browser and is not automatically shared across devices. Do not clear website storage when updating.
