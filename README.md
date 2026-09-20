# <img src="icons/icon.png" alt="" width="48" height="48" align="absmiddle"> Calendo

A month calendar in the macOS menu bar. No account, no main window, and
nothing leaves this Mac.

Apple Silicon and Intel Macs on macOS 13 or newer.

<p align="center">
  <img src="docs/screenshots/menubar.png" alt="Month calendar and upcoming events in the menu bar" width="920">
</p>
<p align="center">
  <img src="docs/screenshots/settings.png" alt="Settings for appearance, the month, and upcoming events" width="920">
</p>

## Features

- **This month, next to the clock.** Click the date to move through months
  without opening Calendar.
- **What’s next.** An optional second menu bar item counts down to the next
  calendar event or scheduled reminder, and opens a list of what’s coming.
- **Your calendars, your lists.** Settings → Events chooses the look-ahead,
  which events qualify, when the countdown appears, and which calendars and
  reminder lists it reads.
- **Stays on this Mac.** Calendar and Reminders are read locally. Nothing is
  uploaded.

Right-click either menu bar item for Settings and Quit. **⌘,** opens Settings.
**⌃⌘K** shows or hides the calendar from any app, and Settings → General can
record a chord for joining the next meeting. macOS may ask for Accessibility
the first time a system-wide shortcut fires.

## Install

Download the disk image from
[Releases](https://github.com/vipinsight/calendo/releases/latest) and drag
Calendo to Applications.

Installed copies can update themselves from Settings → About. Automatic
updates are on by default.

To build from source:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm dmg
```

Then open the disk image in `src-tauri/target/release/bundle/dmg` and drag
Calendo to Applications. See [Building](docs/building.md) for the toolchain
and [Releasing](docs/release.md) to ship.

## License

MIT. See [LICENSE](LICENSE).
