/**
 * Fahu API — anime video service
 *
 * Contract used by Script/commands/anime.js :
 *   GET {anime_video base}   (responseType: "stream")  -> mp4 bytes
 *
 * Videos are served from data/videos/ (cached on disk). If the cache is empty
 * the service pulls clips from the sources listed in data/video_sources.json
 * using youtube-dl-exec, then streams them. Sources are fully editable.
 */
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const VIDEO_DIR = path.join(__dirname, "..", "data", "videos");
const SOURCES_FILE = path.join(__dirname, "..", "data", "video_sources.json");

function dl() {
  return require("./ytdlp").resolve();
}

function list() {
  try {
    fs.mkdirSync(VIDEO_DIR, { recursive: true });
    return fs
      .readdirSync(VIDEO_DIR)
      .filter((f) => /\.(mp4|webm|mkv|mov)$/i.test(f))
      .filter((f) => !f.endsWith(".part"))
      .map((f) => {
        const st = fs.statSync(path.join(VIDEO_DIR, f));
        return { name: f, size: st.size };
      })
      .filter((v) => v.size > 20 * 1024); // skip broken stubs
  } catch (e) {
    return [];
  }
}

function readSources() {
  try {
    const j = JSON.parse(fs.readFileSync(SOURCES_FILE, "utf8"));
    return Array.isArray(j) ? j : j.sources || [];
  } catch (e) {
    return [];
  }
}

function writeSources(list) {
  fs.mkdirSync(path.dirname(SOURCES_FILE), { recursive: true });
  fs.writeFileSync(SOURCES_FILE, JSON.stringify(list, null, 2), "utf8");
  return list;
}

async function fetchOne(url) {
  const raw = dl();
  if (!raw) return null;

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const out = path.join(VIDEO_DIR, id + ".%(ext)s");
  const ytdlp = require("./ytdlp");
  const hasFfmpeg = !!ytdlp.ffmpeg();

  const args = [
    url,
    "--no-warnings",
    "--no-playlist",
    "--no-part",
    "--no-continue",
    "--retries", "5",
    "--fragment-retries", "5",
    "--extractor-retries", "3",
    "-f",
    hasFfmpeg
      ? "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/b"
      // No ffmpeg: prefer an already-muxed progressive mp4 (itag 18/22 has
      // audio baked in); fall back to a small video-only mp4 so the command
      // still returns something playable.
      : "18/22/best[ext=mp4][acodec!=none][vcodec!=none][height<=360]/bv[ext=mp4][height<=360]/bv[ext=mp4]/bv",
    "--merge-output-format",
    "mp4",
    "-o",
    out,
  ];

  if (ytdlp.ffmpegDir()) args.push("--ffmpeg-location", ytdlp.ffmpegDir());

  return new Promise((resolve) => {
    execFile(raw, args, { windowsHide: true, timeout: 5 * 60 * 1000 }, () => {
      // resolve regardless — the caller re-lists the folder
      const found = list().find((v) => v.name.startsWith(id));
      resolve(found || null);
    });
  });
}

/** Ensure at least one usable clip exists. Returns a file path or null. */
async function ensure(force = false) {
  let videos = list();
  if (videos.length && !force) return path.join(VIDEO_DIR, videos[0].name);

  const sources = readSources();
  for (const url of sources) {
    const got = await fetchOne(url);
    if (got) return path.join(VIDEO_DIR, got.name);
  }
  return null;
}

/** Random clip path — warms the cache when empty. */
async function random() {
  let videos = list();
  if (!videos.length) {
    await ensure(true);
    videos = list();
  }
  if (!videos.length) return null;
  const pick = videos[Math.floor(Math.random() * videos.length)];
  return path.join(VIDEO_DIR, pick.name);
}

/** Pick the largest clip (used by /anime "best" mode). */
async function best() {
  let videos = list();
  if (!videos.length) {
    await ensure(true);
    videos = list();
  }
  if (!videos.length) return null;
  const pick = videos.slice().sort((a, b) => b.size - a.size)[0];
  return path.join(VIDEO_DIR, pick.name);
}

module.exports = { list, ensure, random, best, readSources, writeSources, VIDEO_DIR };
