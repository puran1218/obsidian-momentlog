# Momentlog

Capture the small moments that are easy to lose.

Momentlog is for the things that happen between longer notes: what you're doing, what just happened, a quick thought, or a photo you want to remember. Capture it in a few seconds and keep going with your day.

The workflow is deliberately small:

**write or add a photo → record → move on**

Everything stays in ordinary Markdown inside your vault.

## Quick start

1. Open **Momentlog**.
2. Write a short note, or add one or more photos.
3. Select **Record**, or press `Cmd/Ctrl + Enter` on desktop.
4. Your newest moment appears at the top of today's timeline.

Use the day navigation to look back. On desktop, hover a moment to edit or delete it. On mobile, use the **…** menu beside the timestamp.

### Open Momentlog on desktop

Select the Momentlog clock icon in the left ribbon, or open the Command palette and run **Open Momentlog**.

### Open Momentlog on mobile

Open Obsidian's ribbon/menu and select **Momentlog**. You can also open the Command palette and run **Open Momentlog**.

## What Momentlog does

- Quick text capture
- Paste, drag, or choose images
- Automatic local timestamps
- A newest-first daily timeline
- Previous day, next day, and today navigation
- Edit and delete moments
- Full-screen image viewing with zoom and pan
- Desktop and mobile support
- Plain Markdown storage
- No database, cloud service, telemetry, or AI

## Settings

Momentlog only needs two storage settings:

- **Daily note folder** — defaults to `Momentlog`
- **Daily note file format** — defaults to `YYYY-MM-DD`

By default Momentlog writes to:

```
Momentlog/YYYY-MM-DD.md
```

Images are stored under:

```
<folder>/attachments/YYYY-MM-DD/
```

The settings page also includes a quick-start guide, Daily Notes setup instructions, and an **Open Momentlog** button.

## Use Momentlog with Daily Notes

Momentlog works on its own. It can also share the same daily Markdown file as Obsidian's **Daily Notes** core plugin.

To use Momentlog's defaults for both:

1. Enable the **Daily Notes** core plugin.
2. Open **Settings → Daily Notes**.
3. Set **New file location** to `Momentlog`.
4. Set **Date format** to `YYYY-MM-DD`.
5. Keep Momentlog's **Daily note folder** and **Daily note file format** set to those same values.

Now opening a Daily Note and recording a Momentlog moment both target the same file. Momentlog only manages its own `## Momentlog` entries.

If you already have an established Daily Notes folder or date format, leave Daily Notes unchanged and set Momentlog's two storage settings to match it instead.

## Markdown stays the source of truth

A note looks like this:

```markdown
# 2026-09-30

## Momentlog

<!-- momentlog-entry:2026-09-30T13:03:24.000Z -->
### 21:03

Played tennis for an hour after work.

![[Momentlog/attachments/2026-09-30/210324.jpg]]
<!-- /momentlog-entry -->
```

The HTML comments give Momentlog stable entry boundaries while keeping the note readable and usable without the plugin.

### Upgrading from the Timelog beta

Momentlog uses a new plugin ID, `momentlog`, so it installs as a separate plugin from the earlier Timelog beta.

Momentlog still reads legacy `## Timelog` sections and `timelog-entry` blocks. If a vault already has a `Timelog` folder and no `Momentlog` folder, Momentlog automatically keeps using the legacy folder so existing moments remain visible.

After confirming your moments appear in Momentlog, disable or remove the old Timelog beta plugin.

## Installation

### Community Plugins

Once Momentlog is approved for the Obsidian Community directory:

1. Open **Settings → Community plugins**.
2. Select **Browse**.
3. Search for **Momentlog**.
4. Install and enable it.

### Public beta with BRAT

Before the Community Plugins listing is live, install BRAT and add this repository as a beta plugin. BRAT uses the GitHub release assets published by this repository.

### Manual installation

Run:

```bash
npm install
npm run build
```

The ready-to-install plugin is produced at:

```
dist/momentlog/
├── main.js
├── manifest.json
└── styles.css
```

Copy the entire `momentlog` folder into:

```
<vault>/.obsidian/plugins/
```

The final layout should be:

```
<vault>/.obsidian/plugins/momentlog/
├── main.js
├── manifest.json
└── styles.css
```

Reload Obsidian, then enable **Momentlog** under **Settings → Community plugins**.

The same files work on Obsidian Mobile. If your vault is in iCloud Drive, you can copy the folder into the vault from a computer and let iCloud sync it to your iPhone or iPad.

## Commands

- **Open Momentlog**
- **Capture a moment**

There is also a clock icon in the ribbon.

## Development

```bash
npm install
npm run dev
```

Production build and installable package:

```bash
npm run build
```

## Release

The release workflow publishes the files Obsidian and BRAT expect:

- `main.js`
- `manifest.json`
- `styles.css`
- `momentlog-<version>.zip` for convenient manual installation

The release version comes from `manifest.json`. A merge to `main` checks that version and publishes a GitHub Release when one does not already exist.

The GitHub release tag must exactly match the version in `manifest.json`.

## Privacy

Momentlog works entirely inside your Obsidian vault. It has no telemetry, no external service dependency, and no self-update mechanism.

## License

MIT
