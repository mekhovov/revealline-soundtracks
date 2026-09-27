import {
  STYLE_GROUPS,
  buildPlaybackQueue,
  matchesStyles,
  stylesOf,
} from './playback-policy.mjs';

const audio = document.querySelector("#audio");
const now = document.querySelector("#now-playing");
const nowSource = document.querySelector("#now-source");
const status = document.querySelector("#playback-status");
const search = document.querySelector("#search");
const stylesHost = document.querySelector("#styles");
const stylesAll = document.querySelector("#styles-all");
const stylesNone = document.querySelector("#styles-none");
const collection = document.querySelector("#collection");
const order = document.querySelector("#order");
const repeat = document.querySelector("#repeat");
const pause = document.querySelector("#pause");
const nextButton = document.querySelector("#next");
const playResults = document.querySelector("#play-results");
const playFoundation = document.querySelector("#play-foundation");
const browseFoundation = document.querySelector("#browse-foundation");
const foundationCount = document.querySelector("#foundation-count");
const tracksHost = document.querySelector("#tracks");
const count = document.querySelector("#count");
const empty = document.querySelector("#empty");
const summary = document.querySelector("#catalogue-summary");
const FOUNDATION_COLLECTION = "Foundation 70";

let catalogue;
let rows = [];
let current = null;
let queue = [];
let generation = 0;
const styleChecks = new Map();

const text = (node, value) => {
  node.textContent = value ?? "";
  return node;
};
const element = (name, className, value) => {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (value !== undefined) text(node, value);
  return node;
};
const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) return null;
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
};
const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
const searchable = (track) =>
  [
    track.title,
    track.artist,
    ...(track.collections ?? [track.collection]),
    track.license,
    ...track.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
const visible = () => rows.filter((row) => !row.hidden);
const selectedStyles = () =>
  [...styleChecks].filter(([, input]) => input.checked).map(([style]) => style);

function showOnlyStyle(style) {
  search.value = "";
  collection.value = "";
  for (const [name, input] of styleChecks) input.checked = name === style;
  refresh();
}

function showOnlyCollection(value) {
  search.value = "";
  collection.value = value;
  for (const input of styleChecks.values()) input.checked = true;
  refresh();
}

function searchFor(value) {
  collection.value = "";
  for (const input of styleChecks.values()) input.checked = true;
  search.value = value;
  refresh();
  search.focus({ preventScroll: true });
}

function facet(label, filter, value, className = "") {
  const control = element("button", `filter-chip ${className}`.trim(), label);
  control.type = "button";
  control.setAttribute("aria-label", `Filter recordings by ${label}`);
  control.addEventListener("click", () => filter(value));
  return control;
}

function tagStyle(tag) {
  const value = tag.toLocaleLowerCase();
  if (value === "фпв" || value === "fpv") return "fpv";
  if (value === "ua") return "ua";
  if (value.includes("ukrain")) return "ukrainian";
  if (value.includes("metal")) return "metal";
  if (/synth|electro|tracker|fm|dance|techno/.test(value)) return "synth";
  if (/chiptune|8-bit|fakebit/.test(value)) return "chiptune";
  if (/rock|punk/.test(value)) return "rock";
  if (/ambient|atmospher/.test(value)) return "ambient";
  return null;
}

function refresh() {
  const term = search.value.trim().toLocaleLowerCase();
  for (const row of rows) {
    row.hidden =
      !row.dataset.search.includes(term) ||
      !matchesStyles(row.trackStyles, selectedStyles()) ||
      (collection.value && !row.trackCollections.includes(collection.value));
  }
  const found = visible().length;
  count.textContent = `${found} recording${found === 1 ? "" : "s"}`;
  empty.hidden = found > 0;
  playResults.disabled = found === 0;
  queue = [];
}

function refill({ after = current } = {}) {
  queue = buildPlaybackQueue(visible(), {
    order: order.value,
    current: after,
    wrap: repeat.value === 'all',
  });
}

function updateMediaSession(track) {
  if (!("mediaSession" in navigator) || !("MediaMetadata" in globalThis))
    return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: `RevealLine · ${(track.collections ?? [track.collection]).join(' · ')}`,
  });
}

async function play(row) {
  const request = ++generation;
  if (current) current.removeAttribute("data-active");
  current = row;
  const track = row.track;
  row.dataset.active = "true";
  pause.disabled = false;
  nextButton.disabled = false;
  queue = queue.filter((candidate) => candidate !== row);
  audio.pause();
  audio.removeAttribute('crossorigin');
  audio.src = new URL(track.audio.path, catalogue.archive.baseURL).href;
  now.textContent = `${track.title} · ${track.artist}`;
  nowSource.replaceChildren();
  const source = element("a", "", `Source: ${track.collection}`);
  source.href = track.source;
  source.rel = "noopener noreferrer";
  nowSource.append(source);
  status.textContent = "Loading selected recording…";
  updateMediaSession(track);
  history.replaceState(
    null,
    "",
    `?track=${encodeURIComponent(track.id)}#recordings`,
  );
  try {
    await audio.play();
  } catch {
    if (request === generation)
      status.textContent =
        "Press Play in the audio controls to start. Your browser may require a gesture.";
  }
}

function next({ natural = false } = {}) {
  if (natural && repeat.value === 'one' && current) return void play(current);
  if (!queue.length && repeat.value === 'all') refill();
  const row = queue.shift();
  if (row) void play(row);
  else
    status.textContent = visible().length
      ? 'The selected queue has finished.'
      : 'No recordings match the current filters.';
}

function renderTrack(track, index) {
  const row = element("article", "track");
  row.id = `track-${index}`;
  row.track = track;
  row.dataset.search = searchable(track);
  row.trackStyles = stylesOf(track);
  row.dataset.genres = row.trackStyles.join(" ");
  row.trackCollections = track.collections ?? [track.collection];

  const playButton = element("button", "play-track", "▶");
  playButton.type = "button";
  playButton.setAttribute(
    "aria-label",
    `Play ${track.title} by ${track.artist}`,
  );
  playButton.addEventListener("click", () => {
    queue = [];
    void play(row);
    refill({ after: row });
    queue = queue.filter((candidate) => candidate !== row);
  });

  const main = element("div", "track-main");
  main.append(element("h2", "", track.title));
  const artist = element("p", "artist facets");
  artist.append(facet(track.artist, searchFor, track.artist, "artist-chip"));
  main.append(artist);
  const metadata = element("div", "track-facets");
  for (const name of row.trackCollections)
    metadata.append(facet(name, showOnlyCollection, name, "collection-chip"));
  for (const tag of track.tags) {
    const style = tagStyle(tag);
    metadata.append(
      facet(tag, style ? showOnlyStyle : searchFor, style ?? tag, "tag-chip"),
    );
  }
  main.append(metadata);
  const labels = [];
  const duration = formatDuration(track.durationSeconds);
  if (duration) labels.push(duration);
  labels.push(
    track.gameCatalogueAdmission ? "Game playlist" : "Published audition",
  );
  main.append(element("p", "tags", labels.join(" · ")));
  const details = element("details");
  details.append(element("summary", "", "Credits & file details"));
  details.append(
    element("p", "", track.credit),
    ...(track.rights?.derivativeChangeNotice
      ? [element("p", "", `Changes: ${track.rights.derivativeChangeNotice}`)]
      : []),
    element("p", "", `Collections: ${row.trackCollections.join(' · ')}`),
    element(
      "p",
      "",
      `File: ${track.fileName} · ${formatBytes(track.audio.bytes)}`,
    ),
    element("p", "", `SHA-256: ${track.audio.sha256}`),
  );
  main.append(details);

  const links = element("div", "links");
  const download = element("a", "", "MP3 ↓");
  download.href = new URL(track.audio.path, catalogue.archive.baseURL).href;
  download.download = track.fileName;
  // Keep the exact recording URL wired for a future rights-reviewed download control.
  // Public standalone MP3 downloads are intentionally hidden from the player for now.
  download.hidden = true;
  const creator = element("a", "creator-link", "Creator source ↗");
  creator.href = track.source;
  creator.rel = "noopener noreferrer";
  links.append(download, creator);
  if (track.licenseURL) {
    const license = element("a", "", track.license ?? "Licence");
    license.href = track.licenseURL;
    license.rel = "license";
    links.append(license);
  } else links.append(element('span', 'rights-label', track.license));
  row.append(playButton, main, links);
  return row;
}

async function loadCatalogue() {
  try {
    const response = await fetch("catalogue.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    catalogue = await response.json();
    if (catalogue.format !== "revealline-public-soundtrack-catalogue.v1")
      throw new Error("Unsupported catalogue");
    const fragment = document.createDocumentFragment();
    rows = catalogue.tracks.map((track, index) => {
      const row = renderTrack(track, index);
      fragment.append(row);
      return row;
    });
    tracksHost.replaceChildren(fragment);
    tracksHost.setAttribute("aria-busy", "false");
    const sourceCounts = new Map();
    for (const track of catalogue.tracks)
      for (const name of track.collections ?? [track.collection])
        sourceCounts.set(name, (sourceCounts.get(name) ?? 0) + 1);
    for (const [name, total] of [...sourceCounts].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const option = element(
        "option",
        "",
        `${name} (${total})`,
      );
      option.value = name;
      collection.append(option);
    }
    for (const [style, label] of STYLE_GROUPS) {
      const choice = element('label', 'style-choice');
      const input = element('input');
      input.type = 'checkbox';
      input.value = style;
      input.checked = true;
      input.addEventListener('change', refresh);
      styleChecks.set(style, input);
      choice.append(input, document.createTextNode(label));
      stylesHost.append(choice);
    }
    const collectionCount = new Set(catalogue.tracks.flatMap((track) => track.collections ?? [track.collection])).size;
    summary.textContent = `${catalogue.counts.uniqueRecordings} unique recordings across ${collectionCount} collections. Search, filter and keep them playing in one endless queue.`;
    const foundationTracks = catalogue.tracks.filter((track) =>
      (track.collections ?? [track.collection]).includes(FOUNDATION_COLLECTION),
    );
    foundationCount.textContent = String(foundationTracks.length);
    playFoundation.disabled = foundationTracks.length === 0;
    browseFoundation.disabled = foundationTracks.length === 0;
    refresh();
    const requested = new URL(location.href).searchParams.get("track");
    const requestedRow = rows.find((row) => row.track.id === requested);
    if (requestedRow) {
      requestedRow.scrollIntoView({ block: "center" });
      requestedRow.querySelector("button").focus({ preventScroll: true });
      status.textContent = `Ready to play ${requestedRow.track.title}.`;
    }
  } catch (error) {
    tracksHost.setAttribute("aria-busy", "false");
    summary.textContent = "The public catalogue could not be loaded.";
    status.textContent = `Catalogue unavailable: ${error.message}`;
    playResults.disabled = true;
  }
}

search.addEventListener("input", refresh);
collection.addEventListener("change", refresh);
order.addEventListener("change", () => {
  queue = [];
});
repeat.addEventListener("change", () => {
  queue = [];
});
stylesAll.addEventListener('click', () => {
  for (const input of styleChecks.values()) input.checked = true;
  refresh();
});
stylesNone.addEventListener('click', () => {
  for (const input of styleChecks.values()) input.checked = false;
  refresh();
});
playResults.addEventListener("click", () => {
  queue = buildPlaybackQueue(visible(), { order: order.value, current: null });
  next();
});
playFoundation.addEventListener("click", () => {
  showOnlyCollection(FOUNDATION_COLLECTION);
  queue = buildPlaybackQueue(visible(), { order: order.value, current: null });
  next();
});
browseFoundation.addEventListener("click", () => {
  showOnlyCollection(FOUNDATION_COLLECTION);
  document.querySelector("#recordings").scrollIntoView({ block: "start" });
  collection.focus({ preventScroll: true });
});
nextButton.addEventListener("click", next);
pause.addEventListener("click", () => {
  if (!audio.paused) audio.pause();
  else
    void audio.play().catch(() => {
      status.textContent = "Playback could not resume. Choose the song again.";
    });
});
audio.addEventListener("play", () => {
  pause.textContent = "Pause";
  status.textContent = "";
});
audio.addEventListener("pause", () => {
  pause.textContent = "Resume";
});
audio.addEventListener("ended", () => next({ natural: true }));
audio.addEventListener("error", () => {
  status.textContent =
    "This recording could not load. Try Next or choose another song.";
});
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", () => void audio.play());
  navigator.mediaSession.setActionHandler("pause", () => audio.pause());
  navigator.mediaSession.setActionHandler("nexttrack", next);
}

void loadCatalogue();
