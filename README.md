# The Little Kitchen — V6 Shared Cloud

This version adds shared Supabase sign-in, synchronized recipes/groceries and private photo storage, plus optional gentle tap sounds. The five bunny scene backgrounds, photo-per-step editor, notes, and local offline database are retained.

## Use it
1. **Before updating**, open the old version, go to Settings, and export a JSON backup. Keep it safe.
2. Publish the entire contents of this folder to the **same** Little Kitchen GitHub Pages directory. Replace `index.html`, `sw.js`, and `manifest.webmanifest` together. The main HTML is self-contained except for the pinned Supabase JavaScript client from jsDelivr, which needs an internet connection for cloud sign-in.
3. Open **Settings → Shared cloud** (the Little Kitchen icon at upper left), and sign in using the existing email/password belonging to the **Tulip & Honey Closet / other multi-app project**. This is not a Wifey & Hubby sign-in: that app currently uses a separate Supabase Auth project. You can choose the *same email/password* in both projects, but they are separate accounts and sessions.
4. Open Settings → **Sync now**. Wait until you see **Cloud up to date** before changing devices. On the second device, open the updated site and log into the same account, then Sync now. Avoid editing the same recipe simultaneously on both phones; this version is not a collaborative conflict-free editor.
5. In Settings you can turn **Cute tap sounds** on/off. iOS may mute sounds while the phone is silent or in Low Power Mode. Sounds only play on a user tap.

## Cloud design
- Supabase project `pptbmupnpxigwfqkdpzt` (existing multi-app project).
- `public.lk_entries` with owner-scoped row level security, soft-delete records, and separate recipe and grocery entries.
- Private bucket `lk-private-photos` with owner-scoped storage policies. Step photos and cover photos are uploaded as compressed JPEG images; cloud records contain private paths. Retrieval requires a signed-in account.
- Local-first IndexedDB plus a durable `outbox` object store. Local edits save immediately; background sync retries when online, on focus, and every 25 seconds.
- Existing local records migrate into the shared account when first signed in. This can take time with many recipe photos. The app is **not** an end-to-end verified two-device sync; check the Sync status and test with a small recipe and photo before relying on it exclusively. Backup regularly.
- Cloud does not automatically synchronize with Wifey & Hubby because that uses a different Supabase project.

## Limitations and recovery
- If the cloud library fails to load or the connection fails, the app remains usable locally and displays an offline/failed sync status. Reopen with internet access to sign in or retry.
- Existing backup import/export remains available. Backups include local photos currently cached; downloaded photos unavailable offline may need to be synchronized first.
- The current sync uses last-write-wins for an entire record, not per-field conflict merging. It retains local pending edits but cannot guarantee no conflict losses from two simultaneous editors. Maintain backups.
- Photos removed/replaced are not yet automatically garbage-collected from the private storage bucket. They stay private but may use storage until maintenance cleanup is added.
- This package was code-checked and database RLS/storage policies were verified, but authenticated live image transfer with a real user account and physical iPhone verification are pending. Do not treat it as production-proven without those tests.
