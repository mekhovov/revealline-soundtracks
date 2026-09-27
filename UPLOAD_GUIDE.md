# Add music to RevealLine Soundtracks

Use the canonical repository for every new song:

```sh
git clone git@github.com:mekhovov/revealline-soundtracks.git
cd revealline-soundtracks
git switch main
git pull --ff-only
```

You can also use the **Add music** form on the public Pages site. It verifies MP3 signatures, duration and SHA-256 locally and downloads one `.rlintake` package. Static GitHub Pages cannot write to GitHub or hold your credentials, so one authenticated local command is still required to upload the package and open the pull request:

```sh
node intake/add-music.mjs /absolute/path/to/package.rlintake --open-pr
```

## Add a file or folder directly

Install `ffmpeg` so `ffprobe` and the complete decode check are available, authenticate `gh`, and run from the canonical repository checkout:

```sh
node intake/add-music.mjs "/absolute/path/to/music-folder" \
  --source "https://creator.example/exact-source" \
  --artist "Creator name" \
  --description "Public collection description" \
  --styles "metal,UA,ФПВ" \
  --collections "Creator name,ФПВ" \
  --license cc-by-4.0 \
  --confirm-rights \
  --open-pr
```

The command accepts one MP3 or a recursive folder with at most 20 MP3s and 64 MiB per batch. It:

1. fully decodes each MP3;
2. calculates the exact SHA-256 and duration;
3. updates the catalogue, collections, credits and audio-volume manifest;
4. creates a draft GitHub Release and uploads SHA-256-named MP3 assets;
5. commits a `codex/` branch, pushes it and opens a pull request.

When the pull request is merged, GitHub Actions verifies every declared release asset, publishes any matching draft volume, verifies the deterministic Pages payload and deploys the public player automatically.

## Unknown licence

`--license unknown` is supported. It does **not** declare an open licence. It records your explicit assertion that you verified public MP3 redistribution and browser-game playback rights. The exact source or permission page is retained as evidence, and the recording is excluded from Recording mode.

The command you requested is valid from this repository:

```sh
node intake/add-music.mjs "/Users/oleksandr.mekhovov/work/my_projects/go_test/docs/research/dah-soundtracks/TRENCH ORDERLY/" \
  --source "https://www.youtube.com/channel/UCK74qKH4LfMX7JIXIcX35qw" \
  --artist "TRENCH ORDERLY" \
  --description "Пісні про ФПВ" \
  --styles "ФПВ,UA" \
  --collections "TRENCH ORDERLY,ФПВ" \
  --license unknown \
  --confirm-rights \
  --open-pr
```

If `--collections` is omitted, the batch title remains the primary collection. A song may belong to several collections without duplicating its audio or its place in a mixed queue.

## Supported licence values

- `cc0`
- `cc-by-3.0`
- `cc-by-4.0`
- `cc-by-sa-3.0`
- `cc-by-sa-4.0`
- `unknown` (uploader-confirmed permission; not an open licence)

CC BY-SA requires `--derivative-notice`. Use `--rights-evidence` when the permission evidence differs from `--source`.

## Storage model

Git stores the catalogue, rights metadata, UI, tests and automation. MP3s are release assets named `<sha256>.mp3`, grouped into versioned, hash-addressed audio volumes. This keeps clones and Pages deployments small while allowing hundreds of future songs. The player requests only the current recording, supports byte-range seeking, and never downloads the whole library.
