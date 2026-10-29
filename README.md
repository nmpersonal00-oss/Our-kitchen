# The Little Kitchen V7 — iPhone Layout Fix

This update fixes the installed iPhone app viewport and improves Settings. It does **not** change your saved recipes, groceries, cloud credentials, database schema, photos, or sounds.

## Changes

- Home Screen web apps use a fixed full-viewport layout instead of relying solely on `100dvh`. This targets the extra dark band sometimes displayed below the app on iOS.
- Scrolling stays within the recipe/grocery/settings content, keeping the header and bottom navigation stable.
- Settings hides the app's bottom navigation, giving the cloud sign-in and appearance panels more room. Close Settings with the X in the header.
- Background now matches the app's brown palette instead of black if the browser exposes an area around the home indicator.
- Service-worker cache version is increased to encourage updated files to replace the old version.

## How to publish

1. Back up from **Settings → Backups → Export** before replacing files.
2. Upload the complete contents of this ZIP to the same folder/site as your existing Little Kitchen version. Keep the existing URL.
3. Fully close the iPhone Home Screen app and open it again to pick up the updated service worker. If you still see the older layout, ensure the new `index.html` and `sw.js` are both published; sometimes iOS requires reopening twice after a service-worker refresh.
4. Test Settings, grocery checklist, and recipe photo uploads. Your data remains in the same local database and the configured Supabase project.

**iOS limitation:** The thin white/gray swipe-up *Home indicator* belongs to iOS; websites cannot remove it. This fix addresses the avoidable blank area and layout jitter **around** it, not the operating system's gesture bar. This version was browser-tested with phone-sized viewports, not physically tested on iPhone.
