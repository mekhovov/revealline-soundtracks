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

Add one MP3 or a recursive folder, then let the script create the branch, draft
audio release and pull request:

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

For uploader-confirmed permission without a published open licence, use
`--license unknown` and retain the exact permission evidence. This value does not
claim that other people may reuse the recording.

The [browser form](https://mekhovov.github.io/revealline-soundtracks/#add-music)
can prepare the same metadata and audio as a `.rlintake` package. Finish it with:

```sh
node intake/add-music.mjs "/absolute/path/to/package.rlintake" --open-pr
```

All commands must run in this repository checkout. GitHub Pages cannot hold your
GitHub credentials, so the final authenticated command remains local.

When a PR merges, GitHub Actions verifies and publishes its exact audio assets,
updates the catalogue and deploys Pages automatically. RevealLine loads the
canonical catalogue dynamically, so newly merged songs do not need a separate
game change.

Read [the complete guide](UPLOAD_GUIDE.md) for prerequisites, single-file and
folder examples, styles and collections, licence rules, automated steps, review
instructions and troubleshooting.

## Repository layout

- `catalogue.json` — public recording metadata and immutable audio URLs.
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
