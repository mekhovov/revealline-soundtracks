# RevealLine Soundtracks

The canonical public soundtrack catalogue, player and intake system for
RevealLine.

- [Play all soundtracks](https://mekhovov.github.io/revealline-soundtracks/)
- [Add music in the browser](https://mekhovov.github.io/revealline-soundtracks/#add-music)
- [Read the web upload guide](https://mekhovov.github.io/revealline-soundtracks/upload-guide/)
- [Complete upload and PR guide](UPLOAD_GUIDE.md)
- [Public catalogue JSON](https://mekhovov.github.io/revealline-soundtracks/catalogue.json)

## Add songs

Clone and update the canonical repository:

```sh
git clone git@github.com:mekhovov/revealline-soundtracks.git
cd revealline-soundtracks
git switch main
git pull --ff-only
```

Add one MP3 or a recursive folder, then let the script create the branch, verified
audio prerelease and catalogue pull request:

```sh
node intake/add-music.mjs "/absolute/path/to/music" \
  --source "https://creator.example/exact-source" \
  --artist "Creator name" \
  --description "Collection description" \
  --styles "metal,UA" \
  --collections "Creator name,Gameplay" \
  --license cc-by-4.0 \
  --confirm-rights \
  --open-pr
```

With `--open-pr`, known-licence local MP3 assets become **public before catalogue review**, after
exact size and SHA-256 verification. Read-only PR checks can then verify complete
audio. Merging promotes the same assets and deploys the catalogue; rejected PRs
never add songs to the public player or game.

Or register one stable public hosted MP3 without copying it into GitHub:

```sh
node intake/add-music.mjs \
  --audio-url "https://example-bucket.s3.eu-central-1.amazonaws.com/music/song.mp3" \
  --title "Song title" \
  --artist "Artist" \
  --source "https://artist.example/song" \
  --styles "ФПВ,UA" \
  --collections "TRENCH ORDERLY,ФПВ" \
  --license cc-by-4.0 \
  --confirm-rights \
  --open-pr
```

Hosted URLs are verified twice and must be public HTTPS, stable, CORS-enabled,
byte-range capable and free of credentials or expiring signatures. The exact
URL, final host, byte count, SHA-256 and verification time are committed; audio
bytes remain on the supplied host.

Use `--license unknown` only for **quarantine**. Its source metadata is retained
in Git, and new local audio is held in an unpublished draft volume. It never
enters the deployed catalogue, player, review view, direct track links or game.
Keep your original files and obtain recording-specific licence evidence before
requesting publication. An uploader assertion does not bypass this boundary.

The [browser form](https://mekhovov.github.io/revealline-soundtracks/#add-music)
can prepare the same metadata and audio as a `.rlintake` package. Finish it with:

```sh
node intake/add-music.mjs "/absolute/path/to/package.rlintake" --open-pr
```

All commands must run in this repository checkout. GitHub Pages cannot hold your
GitHub credentials, so the final authenticated command remains local.

When a PR merges, GitHub Actions verifies and publishes its exact audio assets,
updates the catalogue and deploys Pages automatically. RevealLine loads the
licensed catalogue projection dynamically, so newly merged licensed songs do not need a separate
game change.

Read [the complete guide](UPLOAD_GUIDE.md) for prerequisites, single-file and
folder examples, styles and collections, licence rules, automated steps, review
instructions and troubleshooting.

## Repository layout

- `catalogue.json` — complete source metadata, including quarantined records.
- `licensing-policy.mjs` — known-licence eligibility shared by deployment and player.
- `verify.mjs` — generates the licensed Pages catalogue and inventories without changing source records.
- `external-deliveries.json` — deterministic hash-bound evidence for hosted MP3s.
- `intake/add-music.mjs` — local and `.rlintake` intake automation.
- `batches/` — generated collection pages and evidence.
- `legacy/` — exact metadata and publication evidence migrated from Archive 01
  and Archive 02.

The original 70-track Pages object set is mirrored here for the game's trusted
offline-album installer. Newer recordings are immutable SHA-256-named GitHub
Release assets. Exact legacy metadata and evidence allow the two old archive
repositories to become read-only after the canonical game integration is
publicly qualified.

Add all new music here.

## Quarantine and historical records

Pages serves a deterministic licensed projection at `catalogue.json`, not the
complete repository file. Missing/unknown licence records and their Pages MP3
objects are omitted, including records whose old legacy catalogue incorrectly
claimed CC0. The 70 known-licensed installer files and their pinned metadata stay
unchanged. Licensed songs held for musical review remain available in review mode.

This removes playback from the current archive and game integration. It does
**not** make the public Git repository, old commits or immutable GitHub Release
assets private or delete them. Those records are preserved for a separate later
extraction; no replacement repository is created by this change.
