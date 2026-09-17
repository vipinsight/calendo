# Releasing

CI only runs tests. A release is a local notarized build, then a GitHub upload.

Toolchain and debug builds are in [Building](building.md).

## 1. Bump the version

Set the same version in three places, then commit it to `main`:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

The tag and `latest.json` both take the version from `package.json`.

## 2. Build the notarized image

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm dmg
```

`pnpm dmg` is `scripts/release-dmg.mjs`. It stops unless both of these are present,
rather than producing a release that looks fine and updates nothing:

- **Notarization** from `.env.notarization` (gitignored) or the environment:
  `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_PASSWORD` (an app-specific password),
  and `APPLE_SIGNING_IDENTITY`. Exported variables win over the file, so CI
  can supply them as secrets.
- **Updater signing key** at
  `~/Library/CloudStorage/OneDrive-Personal/keys/macos-dev/updater.key`
  (or `~/.calendo/updater.key`, or `TAURI_SIGNING_PRIVATE_KEY`). The key is
  never in the repository. Its public half is in `tauri.conf.json`.

Then the script:

1. Runs `pnpm tauri build --bundles app,dmg`. Tauri signs the `.app`,
   notarizes and staples it, wraps it in a disk image, and writes the updater
   payload (`Calendo.app.tar.gz` and `.sig`).
2. Submits the **DMG** to Apple with `notarytool`. Tauri notarizes the app
   but not the disk image, and Gatekeeper rejects an unnotarized image.
3. Staples the ticket onto the DMG and runs `spctl --assess`, which has to
   accept it.
4. Writes `latest.json` next to the DMG, pointing at this version’s GitHub
   download URL.

When it finishes it prints the three files to upload.

## 3. Publish on GitHub

Use the paths the script printed:

```bash
gh release create v<version> --target main \
  src-tauri/target/release/bundle/dmg/Calendo_<version>_aarch64.dmg \
  src-tauri/target/release/bundle/macos/Calendo.app.tar.gz \
  src-tauri/target/release/bundle/dmg/latest.json
```

All three have to go up together:

- `Calendo_<version>_aarch64.dmg` — new installs (drag to Applications)
- `Calendo.app.tar.gz` — what installed copies download
- `latest.json` — what installed copies read from
  `releases/latest/download/latest.json`

Without `latest.json`, Settings → About finds no update. Without the tar.gz,
it finds one and then fails to download.

## The signing key

Installed copies update themselves. The app reads
`releases/latest/download/latest.json`, and the payload it downloads is signed
with the key above.

**That key cannot be replaced.** Each copy trusts exactly the public key
compiled into it, and the plugin takes a single key with no rollover. Ship a
release signed by a different one and every installed copy will fetch the
update, download it in full, fail to verify it, and stay where it is until
someone reinstalls by hand. Do not generate a new key.

## Not this

- `pnpm app` is the debug build. It skips updater artifacts so day-to-day
  work does not need the signing key.
- The DMG background (drag-to-Applications window) is already in
  `icons/dmg/background.tiff`. Only regenerate it with `pnpm dmg:background`
  if that art changes.
- For an unsigned local disk image that is not for shipping:

  ```bash
  pnpm tauri build --bundles dmg
  ```
