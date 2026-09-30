# runner2088 (Game mix)

This is a technical derivative of wekont's owner-approved runner2088 composition,
prepared on 30 September 2026. It is a separate recording, initially review-only.
The existing `wekont.runner2088` recording, public URL, hash, credits and metadata
remain unchanged. No listening or device result is claimed for the derivative.

## Exact identities and measured result

| Recording | SHA-256 | Bytes | LUFS | dBTP |
| --- | --- | ---: | ---: | ---: |
| Original | `9924c6163116b0db94cc0c1878542d2576aac02051dd25f6ebb3b9767869cef9` | 3,884,999 | -15.34 | +0.45 |
| Game mix | `528e7ebe15c91bc686ab9cdfadb4085ebd64b907f795282f7f9c817a46c672ba` | 3,887,378 | -16.94 | -1.14 |

Both files fully decoded with FFmpeg 9.0.2, with `-xerror`, to exactly 4,283,136
stereo frames at 44.1 kHz (97.123265306 seconds). The Game mix meets the agreed
-17..-15 LUFS and <=-1 dBTP thresholds. `measurements.json` records native metadata,
identities, decoded frame counts and raw loudnorm output. Use **input_i** and
**input_tp**: the filter's discarded output measurements are not this MP3's result.
The two measurement logs preserve the actual decoder output.

The only signal processing is constant -1.6 dB attenuation followed by a 320 kb/s
MP3 re-encode. There is no trimming, looping, dynamic compression, limiting or
arrangement change. This is a lossy second encoding from the creator-native MP3;
no lossless original was found in the retained intake. `mp3gain` and `aacgain`
were unavailable; no tools were installed. The renderer retained BPM/date metadata
and added explicit title, artist, encoder and change notices. `recipe.json` gives
the complete command and the exact source pin.
A second render using that recipe and renderer reproduced the exact derivative
SHA-256. All 260 previous catalogue recording objects remain unchanged.

## Source and permission evidence

The retained `original-source-observation.json` is copied unchanged from Archive
02's `intake/runner2088-source-20260925.json`, committed in bootstrap
`32f1d0b9f7e8df3ca78e1fb761c56ea83a47f8cf`. Its SHA-256 is
`b1b5de8ff80a57d8c77e1d08302b3b54a3331c70e82a5172da610574e029edcb`.
It binds FMA track 244490, the creator download URL, CC BY 4.0 and the native MP3
identity. The page observation was 44,027 bytes with hash
`ba240897d6c0b2e2af533bf7571686b967eae833cd06e002ef2094ca777886cb`;
raw HTML was explicitly not retained, so this is dated semantic evidence.

The [creator's FMA page](https://freemusicarchive.org/music/wekont/single/runner2088mp3/)
was independently returned by web search on 30 September 2026 with its CC BY 4.0
licence declaration. A direct page fetch returned HTTP 403. This fresh-fetch
limitation does not replace the dated evidence. The
[CC BY 4.0 licence](https://creativecommons.org/licenses/by/4.0/)
permits redistribution and modification with attribution and disclosure of changes.
The catalogue credit and change notice identify wekont, source, licence and exact
processing; they do not imply creator endorsement. Content ID remains unknown.

## Publication and remaining qualification

The existing `intake/add-music.mjs` prepared the new catalogue entry and immutable
audio-volume manifest. The archive review boundary was then applied explicitly:
`visibility: review-only`, `Soundtrack Review`, `listeningApproval: not-reviewed`,
no game admission, no default, and no Recording mode eligibility. The normal
public queue keeps the original composition once. A separate one-object inventory
is prepared at `admissions/runner2088-game-mix-20260930.json` for later trusted
game admission; the previous seven-object inventory is unchanged.

The new volume is `audio-runner2088-game-mix-20260930`. Its only asset must be
named `528e7ebe15c91bc686ab9cdfadb4085ebd64b907f795282f7f9c817a46c672ba.mp3`.
Upload without replacing existing assets. Existing CI publishes the exact draft
volume on merge and verifies hashes during Pages staging. Local preparation does
not establish publication, public delivery or game admission.

Full-track human listening, repeated sessions, in-game transitions, warning
audibility, mono, small-speaker and physical-device checks remain pending.
The original composition's owner approval does not assert any of these checks
for either encoding. Public byte/hash/range verification and the separate game
admission are still required after archive publication.
