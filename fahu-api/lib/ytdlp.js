/**
 * Resolves the yt-dlp executable used for YouTube downloads.
 *
 * Order:
 *   1. $YTDLP_PATH
 *   2. bundled binary inside youtube-dl-exec  (npm-provided, works offline)
 *   3. node_modules lookup walking up from this file
 *   4. `yt-dlp` on PATH
 *   5. `youtube-dl` on PATH
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

let cached;

function findUp(name, from) {
  let dir = from;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "node_modules", name, "bin", "yt-dlp");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function resolve() {
  if (cached !== undefined) return cached;

  const candidates = [];

  if (process.env.YTDLP_PATH) candidates.push(process.env.YTDLP_PATH);

  // bundled with the youtube-dl-exec npm package
  try {
    const pkg = require.resolve("youtube-dl-exec/package.json");
    const bin = path.join(path.dirname(pkg), "bin", "yt-dlp");
    candidates.push(bin);
  } catch (e) {
    /* not resolvable as a package root */
  }

  const local = findUp("youtube-dl-exec", __dirname);
  if (local) candidates.push(local);

  candidates.push(path.join(__dirname, "..", "node_modules", "youtube-dl-exec", "bin", "yt-dlp"));

  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) {
        fs.accessSync(c, fs.constants.X_OK);
        cached = c;
        return cached;
      }
    } catch (e) {
      /* try next */
    }
  }

  // system-wide
  for (const bin of ["yt-dlp", "youtube-dl"]) {
    try {
      const p = execFileSync("which", [bin], { encoding: "utf8" }).trim();
      if (p && fs.existsSync(p)) {
        cached = p;
        return cached;
      }
    } catch (e) {
      /* try next */
    }
  }

  cached = null;
  return null;
}

function version() {
  const bin = resolve();
  if (!bin) return null;
  try {
    return execFileSync(bin, ["--version"], { encoding: "utf8", timeout: 20000 }).trim();
  } catch (e) {
    return null;
  }
}

/* ------------------------------ ffmpeg ------------------------------- */
let ffCached;

/** Absolute path to ffmpeg, or null when it is not installed. */
function ffmpeg() {
  if (ffCached !== undefined) return ffCached;

  if (process.env.FFMPEG_PATH) {
    try {
      fs.accessSync(process.env.FFMPEG_PATH, fs.constants.X_OK);
      ffCached = process.env.FFMPEG_PATH;
      return ffCached;
    } catch (e) {
      /* fall through */
    }
  }

  for (const bin of ["ffmpeg", "ffmpeg.exe"]) {
    try {
      const p = execFileSync("which", [bin], { encoding: "utf8" }).trim();
      if (p && fs.existsSync(p)) {
        ffCached = p;
        return ffCached;
      }
    } catch (e) {
      /* try next */
    }
  }

  ffCached = null;
  return null;
}

/** Folder containing ffmpeg, for yt-dlp's --ffmpeg-location. */
function ffmpegDir() {
  const f = ffmpeg();
  return f ? path.dirname(f) : null;
}

const FFMPEG_HELP =
  "ffmpeg is not installed. YouTube audio/video extraction needs it.\n" +
  "  Debian/Ubuntu : sudo apt install -y ffmpeg\n" +
  "  RHEL/CentOS   : sudo dnf install -y ffmpeg\n" +
  "  macOS         : brew install ffmpeg\n" +
  "  Windows       : choco install ffmpeg   (or winget install ffmpeg)\n" +
  "  Termux        : pkg install ffmpeg";

module.exports = { resolve, version, ffmpeg, ffmpegDir, FFMPEG_HELP };
