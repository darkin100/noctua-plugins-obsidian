# Noctua for Obsidian

Send any note (or selection) to [Noctua](https://noctua.uno) and listen to it later as an episode in your personal podcast feed.

## What it does

- **Send note to your podcast feed** — command, ribbon icon, or right-click a note in the file explorer
- **Send selection to your podcast feed** — convert just the highlighted text
- Shows progress while Noctua prepares the audio, and confirms when the episode is in your feed
- Optionally writes `noctua_id` and `noctua_url` into the note's frontmatter so the same note isn't sent twice by accident
- **Save episode transcripts to your vault** — optionally save the transcript automatically once an episode is ready, or on demand:
  - **Save transcript of this note's episode** — for a note you've already sent (uses its `noctua_id`)
  - **Save an episode transcript from your podcast feed** — pick any episode, including ones created from web articles or emails

  Transcripts are saved as notes in the **Transcript folder** (default `Noctua transcripts`) with `noctua_transcript_of`, `noctua_url`, `source` and `created` properties. Saving the same episode again refreshes the existing note rather than creating a duplicate. When sent-note marking is on, the sent note gets a `noctua_transcript` link to its transcript.
- Works on desktop and mobile (requires Obsidian 1.13.0+)

## Setup

1. Sign in at [cast.noctua.uno](https://cast.noctua.uno) and open **Settings → API keys**
2. Create a key (e.g. labelled "Obsidian") and copy it — it is shown only once
3. In Obsidian, open **Settings → Noctua** and paste the key
4. Use **Test connection** to confirm it works and see your remaining credits

## Network use & privacy disclosure

This plugin sends data to the Noctua API (`api.cast.noctua.uno`) — this is its entire purpose and it only happens when you explicitly trigger a send:

- **What is sent**: the content of the note (or selection) you choose to send, its title, and an `obsidian://` link containing your vault name and the note's path (stored with the episode to identify its source; it is not included in your podcast RSS feed or on public share pages)
- **When**: only when you run a send command; nothing is sent in the background
- **What is downloaded**: episode transcripts, and your episode list when you pick an episode to save a transcript from — only when you run a transcript command or have **Save transcripts** turned on
- **Telemetry**: none — the plugin collects no analytics or usage data

A **Noctua account is required**, and each conversion consumes one Noctua credit (new accounts include free credits; more can be purchased). See Noctua's [privacy policy](https://noctua.uno/privacy/) and [terms](https://noctua.uno/terms/).

Your API key is stored in Obsidian's secret storage, so it is never written to the plugin's `data.json` inside your vault and is not picked up by vault syncs or backups. Secret storage needs Obsidian 1.11.4+, and the plugin's settings use the declarative settings API added in 1.13.0, so 1.13.0 is the minimum supported version. A key saved by an earlier plugin version is migrated into secret storage and removed from `data.json` on first run.

## Development

```bash
npm install
npm run dev      # esbuild watch mode
npm test         # vitest unit tests
npm run build    # type-check + production bundle (main.js)
```

To test in a vault, copy `manifest.json` and the built `main.js` into `<vault>/.obsidian/plugins/noctua/`, then enable the plugin in **Settings → Community plugins**.

### Releasing

`npm version <patch|minor|major>` bumps `package.json`, `manifest.json` and `versions.json` together. Push the tag (no `v` prefix, so it matches `manifest.json`) and the release workflow builds and drafts a GitHub release with `main.js` and `manifest.json` attached:

```bash
npm version patch
git push && git push --tags
```

## License

MIT
