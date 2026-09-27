# Legacy soundtrack archives

This directory preserves the exact control-plane evidence used by the retired
`revealline-soundtracks-01` and `revealline-soundtracks-02` repositories.

- `archive-01` records the original 70-track publication, credits, inventory and
  deployment manifest. Its `release/` directory pins the 19 assets from the
  `preview-playlists-2026-09-21` prerelease, including all 15 `.rlsound` packs,
  their checksums and their exact source download URLs.
- `archive-02` records the later audition catalogue, credits, batches and deployment
  manifest.
- The root `../inventory.json` and `../objects/` mirror Archive 01's 70 exact MP3s
  for the game's trusted offline-album compatibility path.
- Every Archive 01 and Archive 02 recording hash is present in the canonical
  `../catalogue.json` and immutable canonical audio volumes.

The legacy repositories remain available until the canonical game release passes
online streaming, offline installation and restoration acceptance. After that they
may be archived read-only. Historical URLs remain evidence and must not be silently
reassigned.
