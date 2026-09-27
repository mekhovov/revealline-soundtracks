# Add songs and create a pull request

This is the canonical intake guide for the
[RevealLine soundtrack library](https://mekhovov.github.io/revealline-soundtracks/).
You can add one MP3, a folder of MP3s, a stable hosted MP3 URL, or a package prepared in the browser.
After the pull request is merged, GitHub verifies and publishes the songs and
updates the public player automatically. The game reads that catalogue, so a
separate game change is not required for each new batch.

Prefer a styled page? Open the
[web upload guide](https://mekhovov.github.io/revealline-soundtracks/upload-guide/).

## Before you start

You need:

- permission to redistribute each MP3 publicly and play it in the browser game;
- [Node.js 20 or newer](https://nodejs.org/);
- `ffmpeg` and `ffprobe` for complete audio validation;
- [GitHub CLI](https://cli.github.com/) authenticated with `gh auth login`;
- a clean checkout of
  [`mekhovov/revealline-soundtracks`](https://github.com/mekhovov/revealline-soundtracks).

Set up the repository once:

```sh
git clone git@github.com:mekhovov/revealline-soundtracks.git
cd revealline-soundtracks
git switch main
git pull --ff-only
```

Run all commands below **inside this repository**. If Node reports
`Cannot find module .../intake/add-music.mjs`, you are in the wrong directory.
Change to this checkout and run the command again.

## Fastest option: use the web form

1. Open [Add music](https://mekhovov.github.io/revealline-soundtracks/#add-music).
2. Choose MP3 files/a folder, or switch to **Use hosted MP3 URLs** and add one or more rows.
3. Enter the artist, source, licence, styles and collections.
4. Confirm the rights statement and download the `.rlintake` package.
5. From the repository checkout, run:

   ```sh
   node intake/add-music.mjs "/absolute/path/to/package.rlintake" --open-pr
   ```

The web form reads and hashes local MP3s in your browser. For hosted URLs it
verifies two complete downloads, CORS, range support, duration and hash, then
creates a compact package containing only URL and identity evidence. It never
uploads to your storage provider. GitHub Pages is a static site, so the final
authenticated local command still creates the pull request.

## Add a hosted MP3 URL

```sh
node intake/add-music.mjs \
  --audio-url "https://example-bucket.s3.eu-central-1.amazonaws.com/music/song.mp3" \
  --title "Song title" \
  --artist "Artist" \
  --source "https://artist.example/song" \
  --styles "ФПВ,UA" \
  --collections "TRENCH ORDERLY,ФПВ" \
  --license unknown \
  --confirm-rights \
  --open-pr
```

The supplied URL is authoritative. It must be public HTTPS and stable; S3
presigned URLs and other links with credentials, signatures or expiry tokens
are rejected. Intake follows at most five HTTPS redirects and stores the final
URL. CI downloads the complete file again before merge and Pages deployment.

For several hosted songs, pass `--url-manifest /absolute/path/to/tracks.json`.
The file is either a JSON array or `{ "tracks": [...] }`; every row needs
`audioURL`, `title`, `artist`, and may include `fileName`:

```json
[
  {
    "audioURL": "https://example-bucket.s3.eu-central-1.amazonaws.com/music/one.mp3",
    "title": "One",
    "artist": "Artist",
    "fileName": "one.mp3"
  }
]
```

### Minimal S3 CORS configuration

Configure the bucket to allow the archive/game origin to read metadata and
byte ranges. The object itself must have a stable public-read path through your
chosen S3 access policy.

```json
[
  {
    "AllowedOrigins": ["https://mekhovov.github.io"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["Accept-Ranges", "Content-Length", "Content-Range", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Use the ordinary object URL, without `X-Amz-Signature` or `X-Amz-Expires`.

## Add a folder of songs

This example recursively adds every MP3 in a folder and gives each recording
both `TRENCH ORDERLY` and `ФПВ` collection tags:

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

Use a normal URL in the shell. Do not paste Markdown such as
`[label](https://example.com)` and do not add backslashes before `:` or `/`.

## Add one song

```sh
node intake/add-music.mjs "/absolute/path/to/song.mp3" \
  --source "https://creator.example/song-page" \
  --artist "Artist name" \
  --title "Song title" \
  --description "Energetic synth track for gameplay" \
  --styles "synthwave,electro" \
  --collections "Synthwave & Electro" \
  --license cc-by-4.0 \
  --attribution "Song title by Artist name, licensed CC BY 4.0" \
  --confirm-rights \
  --open-pr
```

`--title` is available only for a single MP3. For folders, the script uses each
file's embedded title or filename and its embedded artist or `--artist`.

## Licence choices

Supported values are:

| Value          | Meaning                                                   |
| -------------- | --------------------------------------------------------- |
| `cc0`          | CC0 1.0 Universal                                         |
| `cc-by-3.0`    | Creative Commons Attribution 3.0                          |
| `cc-by-4.0`    | Creative Commons Attribution 4.0                          |
| `cc-by-sa-3.0` | Creative Commons Attribution-ShareAlike 3.0               |
| `cc-by-sa-4.0` | Creative Commons Attribution-ShareAlike 4.0               |
| `unknown`      | Uploader-confirmed permission; no open licence is claimed |

Use `--license unknown` only when you have separately verified public MP3
redistribution and browser-game playback permission. Supply the exact evidence
with `--rights-evidence` when it differs from `--source`. Unknown-licence tracks
are excluded from Recording mode and the public player does not present
“unknown” as a reusable licence.

CC BY-SA intake also requires `--derivative-notice` describing any conversion or
other changes. Preserve every creator-required credit with `--attribution`.

## Styles and collections

- `--styles` controls style filters and can contain several comma-separated tags,
  such as `metal,industrial` or `ФПВ,UA`.
- `--collections` adds one or more clickable collection filters without copying
  the audio. A song can belong to several collections.
- `--batch-title` sets the primary public collection title. If it is omitted, the
  generated batch title remains the primary collection.
- `--description` explains the batch on its collection page.

Use consistent spelling so existing and new songs appear under the same filter.
The PR preview shows the final tags before anything is merged.

## What the command automates

For each intake, the script:

1. discovers MP3 files recursively;
2. verifies the MP3 signature and fully decodes every file;
3. calculates duration, exact byte size and SHA-256;
4. generates stable recording metadata, credits, styles and collections;
5. updates the catalogue and deterministic deployment manifests;
6. for local audio, creates a draft GitHub Release and uploads SHA-256-named assets; for hosted audio, writes exact delivery evidence without copying bytes;
7. creates a `codex/` branch, commits it, pushes it and opens a pull request.

One intake accepts at most **20 MP3 files** and **64 MiB**. Split larger folders
into several PRs. The same exact audio hash cannot be silently added twice.

## Review and merge the PR

On the pull request:

1. Check the song names, artist, source, styles, collections and licence evidence.
2. Wait for the verification workflow to pass.
3. Review the generated collection page and catalogue diff.
4. Merge the PR.

After merge, GitHub Actions automatically:

- verifies the exact draft-release assets against the catalogue hashes;
- publishes the matching audio volume;
- rebuilds and verifies the deterministic Pages payload;
- deploys the unified public player.

Verify the new songs at
[mekhovov.github.io/revealline-soundtracks](https://mekhovov.github.io/revealline-soundtracks/).
Search for the artist, select the new collection, start playback and use Next to
confirm the queue. The next game catalogue refresh discovers merged recordings
without a per-batch game PR.

## Troubleshooting

### `Cannot find module .../intake/add-music.mjs`

Run the command from the canonical soundtrack checkout:

```sh
cd /absolute/path/to/revealline-soundtracks
git switch main
git pull --ff-only
node intake/add-music.mjs --help
```

You can also invoke the script by absolute path:

```sh
node "/absolute/path/to/revealline-soundtracks/intake/add-music.mjs" \
  "/absolute/path/to/song.mp3" \
  --source "https://creator.example/song" \
  --artist "Artist" \
  --styles "metal" \
  --license cc0 \
  --confirm-rights \
  --open-pr
```

### The repository is not clean

Finish or stash unrelated work, then update `main`. Intake deliberately refuses
to mix generated publication changes with an unrelated working tree.

### A URL looks malformed

Pass a plain quoted URL. Shell input should look like
`"https://example.com/page"`, never Markdown link syntax and never an escaped
`https\\://` value.

### `ffprobe` or `gh` is missing

Install `ffmpeg`, install GitHub CLI, then run `gh auth login`. Confirm with:

```sh
ffprobe -version
gh auth status
```

## Storage model

Git stores catalogue metadata, rights evidence, UI, tests and automation. Local
MP3s are GitHub Release assets named `<sha256>.mp3` and grouped into immutable
audio volumes. Hosted MP3s remain at the supplied URL and are pinned by byte
count and SHA-256 in `external-deliveries.json`. The player requests only the current recording. The original
70-track Pages object set remains an exact compatibility mirror for trusted
offline albums; new intake never adds files to that mirror.
