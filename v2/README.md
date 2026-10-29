# The Little Kitchen — fresh rebuild preview

A separate app built from scratch around the same screen structure as Wifey & Hubby: a relative 100dvh shell with an image covering 100% × 100% of the scene, a stable five-button bottom bar, and no stacked iPhone-specific fixed-position overrides.

## Original artwork
Six background files provided by the app owner are used unchanged. The CLEANED images are the backgrounds; the EXAMPLE screenshots were used as visual/layout guidance. In the hosted `v2/` preview the original root images are referenced with `../reference-*.png`, and existing root thumbnails `../exact-*.webp` are reused. No visuals from Wifey & Hubby are copied.

## Features
- Groceries: create, edit, check off, delete, optional priority, ingredient import, CSV.
- Recipes: search, food/drinks/desserts, favorites, difficulty filters, recipe viewing, ingredients, steps and photos on each step, cover upload.
- Local-first storage: retains the original IndexedDB `little-kitchen-recipes-v1` version 3 and `recipes`, `groceries`, `meta`, `outbox` object stores. Does not clear those stores.
- Settings: sounds, JSON backup import/export, Supabase sign-in and opt-in sync using the original cloud project, table and photo bucket.

## Important precautions
This `v2` build is an **independent preview**. The original `/index.html` remains untouched. iOS installed Home Screen PWAs may not share their local storage with a new, separately installed PWA. **Export a JSON backup from your existing app before installing/replacing anything**, and import it into the rebuild if needed. Testing in Safari is safer than installing the preview as a new Home Screen app.

A Chromium-emulated 425×925 viewport and an isolated in-memory IndexedDB fixture passed initial visual/layout and CRUD smoke tests. This is not an iPhone/WebKit test. Cloud sync must be validated with a test account on a test device before adopting this as the primary app.