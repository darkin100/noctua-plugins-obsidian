# Noctua for Obsidian

Send any note (or selection) to [Noctua](https://noctua.uno) and listen to it later as an episode in your personal podcast feed. Noctua turns your text into natural-sounding audio with text-to-speech (TTS), so you can listen to your notes on the go, and you can save episode transcripts back into your vault.

## What it does

- **Send note to your podcast feed** — command, ribbon icon, or right-click a note in the file explorer
- **Send selection to your podcast feed** — convert just the highlighted text
- Shows progress while Noctua prepares the audio, and confirms when the episode is in your feed
- Optionally writes `noctua_id` and `noctua_url` into the note's frontmatter so the same note isn't sent twice by accident
- **Save episode transcripts to your vault** — optionally save the transcript automatically once an episode is ready, or on demand:
  - **Save transcript of this note's episode** — for a note you've already sent (uses its `noctua_id`)
  - **Save episode transcripts from your podcast feed** — browse the episodes in your Noctua account and save the transcripts of the ones you choose (see [Saving transcripts from your feed](#saving-transcripts-from-your-feed))

  Transcripts are saved as notes in the **Transcript folder** (default `Noctua transcripts`) with `noctua_transcript_of`, `noctua_url`, `source` and `created` properties. Saving the same episode again refreshes the existing note rather than creating a duplicate. When sent-note marking is on, the sent note gets a `noctua_transcript` link to its transcript.
- Works on desktop and mobile (requires Obsidian 1.13.0+)

## Installation

The plugin is published in the Obsidian community plugin directory: [Noctua on community.obsidian.md](https://community.obsidian.md/plugins/noctua).

To install it from inside Obsidian:

1. Open **Settings → Community plugins**. If you see **Restricted mode is on**, click **Turn on community plugins**.
2. Click **Browse**, search for **Noctua** and click **Install**.
3. Click **Enable**, then follow [Setup](#setup) below.

To run a build from this repository instead, see [Installing a local build in Obsidian](#installing-a-local-build-in-obsidian).

## Setup

1. Sign in at [cast.noctua.uno](https://cast.noctua.uno) and open **Settings → API keys**
2. Create a key (e.g. labelled "Obsidian") and copy it — it is shown only once
3. In Obsidian, open **Settings → Noctua** and paste the key
4. Use **Test connection** to confirm it works and see your remaining credits

## Saving transcripts from your feed

You can save the transcript of any episode in your Noctua account, not just notes you sent from Obsidian. This includes episodes made from web articles, emails or the Noctua web app.

1. Open the command palette (**Ctrl/Cmd + P**) and run **Noctua: Save episode transcripts from your podcast feed**.
2. A window lists your episodes, newest first. Each one shows its date, and also:
   - its status (for example `processing` or `expired`) if it isn't completed
   - **transcript saved** if its transcript is already in your vault

   Failed episodes aren't listed because they have no transcript.
3. Type in the **Filter episodes by title** box to narrow the list. Each word you type must appear in the title, in any order.
4. Tick the episodes you want. Ticks are kept when you change the filter, so you can search for one episode, tick it, clear the search and look for another. To select several at once:
   - **Select shown** ticks every episode in the current (filtered) list
   - **Select unsaved** ticks only the shown episodes whose transcript isn't in your vault yet
   - **Clear** unticks everything

   The line above the list shows how many episodes are selected and how many are shown.
5. Click **Save N transcripts**. The button stays disabled until at least one episode is ticked.

The transcripts are saved one at a time, with a progress message such as *Saving transcript 2 of 5: "Weekly review"…*. When they're done:

- A summary shows how many were saved and in which folder, and lists any that failed with the reason.
- If you saved a single transcript, its note opens.
- Each transcript is saved to your **Transcript folder** (set it in **Settings → Noctua**; default `Noctua transcripts`). If the episode already has a transcript note, that note is updated wherever you've moved it, and any properties you added are kept.

A few things to know:

- **Episodes that are still processing** can fail with *no transcript for this episode yet*. Noctua has the transcript once it has extracted the content. Run the command again a little later.
- **Expired episodes** can still be saved: the transcript stays available after the audio expires.
- **Only your 100 most recent episodes are listed.** If you have more, the window says *Showing your 100 most recent episodes of N*.
- **If Noctua rejects your API key**, saving stops straight away and the remaining episodes are marked *skipped*. Check the key in **Settings → Noctua** and use **Test connection**.

## Network use & privacy disclosure

This plugin sends data to the Noctua API (`api.cast.noctua.uno`) — this is its entire purpose and it only happens when you explicitly trigger a send:

- **What is sent**: the content of the note (or selection) you choose to send, its title, and an `obsidian://` link containing your vault name and the note's path (stored with the episode to identify its source; it is not included in your podcast RSS feed or on public share pages)
- **When**: only when you run a send command; nothing is sent in the background
- **What is downloaded**: episode transcripts, and your episode list when you open the episode picker — only when you run a transcript command or have **Save transcripts** turned on
- **Client identifier**: each request carries an `X-Noctua-Client: obsidian/<plugin version>` header, so Noctua can tell which app an episode came from
- **Telemetry**: none — the plugin collects no analytics or usage data

### Vault access

The plugin reads and writes files in your vault only through Obsidian's API, and only for these tasks:

- **Reading** the note you send (or the selected text).
- **Writing** `noctua_id`, `noctua_url` and `noctua_transcript` to the frontmatter of a sent note (if sent-note marking is on), and creating or updating transcript notes in your **Transcript folder**.
- **Listing the Markdown files in your vault** when it saves a transcript or opens the episode picker. It checks each file's frontmatter for a `noctua_transcript_of` property to find transcripts you've already saved. That's how saving the same episode twice updates your existing note (even if you've moved it out of the transcript folder), and how the picker marks episodes as *transcript saved*. It reads the frontmatter from Obsidian's metadata cache, not the note contents.

None of this vault information is sent to Noctua or anywhere else. The only data sent is what's listed above.

A **Noctua account is required**, and each conversion consumes one Noctua credit (new accounts include free credits; more can be purchased). See Noctua's [privacy policy](https://noctua.uno/privacy/) and [terms](https://noctua.uno/terms/).

Your API key is stored in Obsidian's secret storage, so it is never written to the plugin's `data.json` inside your vault and is not picked up by vault syncs or backups. Secret storage needs Obsidian 1.11.4+, and the plugin's settings use the declarative settings API added in 1.13.0, so 1.13.0 is the minimum supported version. A key saved by an earlier plugin version is migrated into secret storage and removed from `data.json` on first run.

## Development

```bash
npm install
npm run dev      # esbuild watch mode
npm test         # vitest unit tests
npm run build    # type-check + production bundle (main.js)
```

### Installing a local build in Obsidian

Obsidian loads community plugins from `<vault>/.obsidian/plugins/<plugin id>/`. For this plugin the folder must be named `noctua`, to match the `id` in `manifest.json`. The folder needs three files: `main.js`, `manifest.json` and `styles.css`.

It's best to test in a separate vault rather than your everyday one. If the [published version](https://community.obsidian.md/plugins/noctua) is already installed in that vault, the local build replaces it, because both use the same folder.

**1. Build the plugin**

```bash
npm install
npm run build    # writes main.js to the repository root
```

**2. Put the plugin in your vault** using one of these options.

- **Option A: link the repository (best while developing).** Obsidian then loads the files straight from your checkout, so every rebuild is picked up:

  ```bash
  mkdir -p "<vault>/.obsidian/plugins"
  ln -s "$(pwd)" "<vault>/.obsidian/plugins/noctua"
  ```

  Obsidian writes the plugin's settings to `data.json` in this folder. That file is in `.gitignore`, so it won't be committed.

- **Option B: copy the files.**

  ```bash
  mkdir -p "<vault>/.obsidian/plugins/noctua"
  cp main.js manifest.json styles.css "<vault>/.obsidian/plugins/noctua/"
  ```

  Copy the files again after each build.

`.obsidian` is a hidden folder. On macOS, press **Cmd + Shift + .** in Finder to show hidden files.

**3. Enable the plugin in Obsidian**

1. Open **Settings → Community plugins**.
2. If you see **Restricted mode is on**, click **Turn on community plugins**.
3. Under **Installed plugins**, find **Noctua** and switch it on. If it isn't listed, click the refresh icon next to **Installed plugins**.
4. Follow [Setup](#setup) to add your API key. The key is kept in Obsidian's secret storage on this device, not in the plugin folder.

**4. Load your changes**

- Run `npm run dev` to rebuild `main.js` automatically whenever you save a source file.
- Obsidian doesn't reload a plugin by itself. After a rebuild, switch **Noctua** off and on again in **Settings → Community plugins**, or run **Reload app without saving** from the command palette.
- If you used Option B, copy the files into the vault again first.
- Open the developer console (**Cmd + Option + I** on macOS, **Ctrl + Shift + I** on Windows/Linux) to see errors from the plugin.

### Releasing

`npm version <patch|minor|major>` bumps `package.json`, `manifest.json` and `versions.json` together. Push the tag (no `v` prefix, so it matches `manifest.json`) and the release workflow builds and drafts a GitHub release with `main.js`, `manifest.json` and `styles.css` attached:

```bash
npm version patch
git push && git push --tags
```

## License

MIT
