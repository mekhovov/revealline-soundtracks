# Add music to RevealLine soundtrack archive 02

Verify that each exact recording permits public MP3 redistribution and web-game
playback. A streaming page or video alone is not permission. Preserve the creator
page, licence URL, required credit, native filename and any derivative disclosure.

## Browser-first intake

Open the [Archive 02 Add music form](https://mekhovov.github.io/revealline-soundtracks-02/#add-music).
The form runs locally in the browser; it does not upload the selected files. It
accepts one or more MP3s or a folder, checks their signatures and durations,
calculates SHA-256 identities, binds the reviewed rights metadata and downloads
one `.rlintake` package.

One browser package must use the same source, licence, rights evidence and style
set for every selected recording. Split mixed-rights folders into separate
packages. Accurate MP3 artist tags are preserved per track; the form's creator
value is used only when a file has no artist tag.

Send that package to a maintainer or, from a clean **RevealLine Soundtracks 02**
checkout, run one command. The package already contains the exact audio and all
metadata, so no flags are repeated:

```sh
node intake/add-music.mjs "/path/to/collection.rlintake" --open-pr
```

The admission command rechecks every byte and hash, fully decodes every MP3 with
ffmpeg, updates the catalogue and deployment manifest, runs the archive verifier,
then opens the scoped pull request. GitHub Pages is a static host, so the public
page deliberately does not hold a GitHub token or write directly to the
repository. The reviewed PR remains the publication boundary.

## Direct command-line intake

From a clean **RevealLine Soundtracks 02** checkout, select one MP3 or a folder
containing up to 20 MP3s. The
tool reads ID3 title/artist metadata, verifies complete decoding with ffmpeg,
preserves exact bytes under SHA-256 paths, updates every catalogue and deployment
file, and runs the archive verifier:

```sh
cd /path/to/revealline-soundtracks-02
node intake/add-music.mjs "/path/to/song-or-folder" \
  --artist "Creator name" \
  --source "https://creator.example/album" \
  --license cc-by-4.0 \
  --styles "synthwave,electro,gameplay" \
  --confirm-rights
```

Run `node intake/add-music.mjs --help` to print the complete syntax. If you start
from the RevealLine game repository, use its launcher and point it at this clean
archive checkout:

```sh
node intake/add-music.mjs "/path/to/song-or-folder" \
  --archive-root "/path/to/revealline-soundtracks-02" \
  --artist "Creator name" \
  --source "https://creator.example/album" \
  --rights-evidence "https://creator.example/album#license" \
  --license cc-by-4.0 \
  --styles "synthwave,electro,gameplay" \
  --confirm-rights
```

Omit `--artist` when every file has an accurate artist ID3 tag. For one file,
`--title` overrides its title. Optional `--batch-id`, `--batch-title`,
`--description`, `--attribution`, `--rights-evidence` and
`--derivative-notice` provide exact reviewed metadata. Supported licences are
`cc0`, `cc-by-3.0`, `cc-by-4.0`, `cc-by-sa-3.0` and `cc-by-sa-4.0`.

Add `--open-pr` to create the `codex/` branch when needed, commit only the
generated archive files, push them and open the pull request. The command refuses
dirty checkouts, duplicate IDs/hashes, symbolic links, unsupported licences,
oversized batches, insufficient disk reserve and missing rights confirmation.

Larger cleared collections must be split into batches of no more than 20 MP3s
and 64 MiB. Use one `--artist` override only when every recording in that batch
has the same artist; otherwise keep accurate ID3 artist tags or split the batch.

YouTube availability does not grant public MP3 redistribution or game-playback
rights. Do not pass `--confirm-rights` for a YouTube-derived collection unless
the copyright holder has provided recording-specific permission or a supported
licence. Keep such files in the game's private upload workflow until that
evidence exists.

The public archive writer deliberately does not accept unknown licences. From a
RevealLine game checkout containing the intake launcher, `--license unknown`
selects the private UA-FPV pack builder instead:

```sh
node intake/add-music.mjs "/path/to/unknown-rights-folder" \
  --license unknown \
  --private-output "/path/to/new-empty-private-directory"
```

This private mode never changes the archive or opens a pull request. It cannot
be combined with `--confirm-rights`, `--open-pr` or `--archive-root`. Import the
generated `.rlsound` volumes locally in Music Studio. The output path is
mandatory, must be new and empty, and the builder preserves at least 1 GiB of
free disk space.

After generation, or before review, run:

```sh
node --test test-*.mjs
node verify.mjs
node verify.mjs --stage /tmp/revealline-soundtracks-02-public
git diff --check
```

Keep every new recording outside defaults. Listening approval and game catalogue
admission stay false until their separate reviews finish. After merge, wait for
the Pages workflow and verify the public catalogue, byte-range/CORS response and
same-page playback.

Add Archive 02 to Archive 01's bounded `archive-directory.json` only after the
game client supporting multiple archives is public.
