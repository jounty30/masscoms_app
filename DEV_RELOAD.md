# Why changes don't show on the mobile app

If you edit code but the app doesn't update, it's usually one of these:

## 1. CI mode (most common)

When `CI=true` is set (e.g. in your shell or by Cursor), Metro runs in CI mode and **disables watch mode and reloads**. Your edits are ignored.

**Fix:** Use the dev script instead of `npm start`:

```bash
npm run dev
```

Or manually:

```bash
CI=false npx expo start --clear
```

## 2. Cached bundle

Metro or the simulator may be serving an old JavaScript bundle.

**Fix:** Full reset:

```bash
npm run reset
```

Then in the simulator: **Cmd+Shift+R** (or delete the app and reinstall).

## 3. Reload the app

After Metro rebuilds, the simulator won't auto-reload. You must:

- **Cmd+R** – reload
- **Cmd+Shift+R** – force reload (clears cache)
- Or shake device → **Reload** from the dev menu

## Quick checklist

1. Stop Metro (Ctrl+C)
2. Run `npm run dev` (not `npm start`)
3. Wait for "Bundled" in the Metro terminal
4. Press **Cmd+R** in the simulator
5. If still stale: `npm run reset`, then **Cmd+R** again
