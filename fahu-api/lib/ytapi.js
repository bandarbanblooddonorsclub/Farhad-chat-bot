/**
 * Fahu API — YouTube search + download service
 *
 * Contract used by Script/commands/{song,sing,youtube}.js :
 *   GET  /api/search?q=<text>&limit=15  -> { results: [ { videoId|id, title, author, duration, url, thumbnail } ] }
 *   POST /api/download { url, format:"mp3"|"mp4" } -> { job_id }
 *   GET  /api/jobs/:id  -> { status:"pending"|"completed"|"failed", file_url, ... }
 */
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const ytdlp = require("./ytdlp");

const PLAYWRIGHT = path.join(__dirname, "..", "node_modules", "playwright-core");
const CACHE_TTL = 45 * 60 * 1000; // 45 min

const jobs = new Map();
const searchCache = new Map();
const MAX_JOBS = 60;

function newJob() {
  return (
    "job_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  ).toLowerCase();
}

function sweep() {
  if (jobs.size > MAX_JOBS) {
    for (const [id, j] of jobs) {
      if (j.status !== "pending") jobs.delete(id);
      if (jobs.size <= MAX_JOBS) break;
    }
  }
}

/* --------------------------- cookie helpers -------------------------- */
function loadCookies() {
  const raw = process.env.YT_COOKIES;
  if (!raw) return null;
  try {
    const cookies = JSON.parse(raw);
    return Array.isArray(cookies) && cookies.length ? cookies : null;
  } catch (e) {
    return null;
  }
}

/* ------------------------------ searching ---------------------------- */
function decodeEntities(s) {
  return String(s || "")
    .replace(/\\u0026/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\(.)/g, "$1");
}

function toSeconds(text) {
  if (!text) return 0;
  const parts = String(text).split(":").map((n) => parseInt(n, 10) || 0);
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Search via Playwright (headless Chromium) hitting YouTube results page. */
async function browserSearch(query, limit = 15) {
  let chromium;
  try {
    ({ chromium } = require(PLAYWRIGHT));
  } catch (e) {
    throw new Error("playwright-core is not installed (npm i playwright-core)");
  }
  if (!chromium) throw new Error("playwright-core is not available");

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"]
  });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      locale: "en-US"
    });

    const cookies = loadCookies();
    if (cookies) await context.addCookies(cookies);

    const page = await context.newPage();
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    const url =
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(query);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    try {
      await page.waitForSelector("#contents ytd-video-renderer", {
        timeout: 20000
      });
    } catch (e) {
      /* no results or consent wall — fall through to empty */
    }
    await page
      .waitForTimeout(1200)
      .catch(() => {});

    const items = await page.evaluate(() => {
      const out = [];
      document
        .querySelectorAll("ytd-video-renderer, ytd-rich-item-renderer")
        .forEach((el) => {
          const a = el.querySelector('a#thumbnail[href*="watch?v="], a[href*="/watch?v="]');
          const titleEl =
            el.querySelector("#video-title") ||
            el.querySelector("h3 a") ||
            el.querySelector("#video-title-link");
          const chEl = el.querySelector(
            "ytd-channel-name #text, .ytd-channel-name a"
          );
          const lenEl = el.querySelector(
            "span#text.ytd-thumbnail-overlay-time-status-renderer, badge-shape span"
          );
          if (!a || !titleEl) return;
          const href = a.getAttribute("href") || "";
          const m = href.match(/[?&]v=([\w-]{6,})/);
          if (!m) return;
          const thumb =
            "https://i.ytimg.com/vi/" + m[1] + "/hqdefault.jpg";
          out.push({
            id: m[1],
            title: titleEl.getAttribute("title") || titleEl.textContent.trim(),
            author: chEl ? chEl.textContent.trim() : "",
            duration: lenEl ? lenEl.textContent.trim() : "",
            thumbnail: thumb
          });
        });
      return out;
    });

    return items
      .filter((it) => !/live| premiere/i.test(it.duration || ""))
      .slice(0, limit)
      .map((it) => ({
      videoId: it.id,
      id: it.id,
      title: decodeEntities(it.title),
      author: decodeEntities(it.author),
      duration: it.duration || "N/A",
      duration_seconds: toSeconds(it.duration),
      url: "https://www.youtube.com/watch?v=" + it.id,
      thumbnail: it.thumbnail
    }));
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Fallback: scrape the YouTube search HTML with plain HTTPS. */
async function httpSearch(query, limit = 15) {
  const https = require("https");
  const url =
    "https://www.youtube.com/results?search_query=" +
    encodeURIComponent(query) +
    "&hl=en&gl=US";

  const html = await new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9"
        },
        timeout: 30000
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve(body));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
  });

  const idx = html.indexOf("ytInitialData");
  if (idx === -1) throw new Error("no ytInitialData");

  const start = html.indexOf("{", idx);
  let depth = 0,
    end = -1;
  for (let i = start; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) throw new Error("unterminated ytInitialData");
  const data = JSON.parse(html.slice(start, end));

  const sections =
    (data.contents &&
      data.contents.twoColumnSearchResultsRenderer &&
      data.contents.twoColumnSearchResultsRenderer.primaryContents &&
      data.contents.twoColumnSearchResultsRenderer.primaryContents
        .sectionListRenderer &&
      data.contents.twoColumnSearchResultsRenderer.primaryContents
        .sectionListRenderer.contents) ||
    [];

  const out = [];
  for (const sec of sections) {
    const items = (sec.itemSectionRenderer && sec.itemSectionRenderer.contents) || [];
    for (const it of items) {
      const v = it.videoRenderer;
      if (!v || !v.videoId) continue;
      // skip livestreams & premieres — they are HLS-only and cannot be downloaded
      const badges = (v.badges || []).map((b) =>
        b.metadataBadgeRenderer ? b.metadataBadgeRenderer.style : ""
      ).join(" ");
      const lenTxt = (v.lengthText && v.lengthText.simpleText) || "";
      if (/LIVE|liveNow|BADGE_STYLE_TYPE_LIVE_NOW/i.test(badges + " " + lenTxt)) continue;
      out.push({
        videoId: v.videoId,
        id: v.videoId,
        title:
          (v.title && (v.title.runs[0] && v.title.runs[0].text)) ||
          (v.title && v.title.simpleText) ||
          "",
        author:
          (v.ownerText && v.ownerText.runs[0] && v.ownerText.runs[0].text) || "",
        duration:
          (v.lengthText && v.lengthText.simpleText) ||
          (v.lengthText && v.lengthText.runs && v.lengthText.runs[0].text) ||
          "N/A",
        duration_seconds:
          (v.lengthText && v.lengthText.simpleText
            ? toSeconds(v.lengthText.simpleText)
            : 0),
        url: "https://www.youtube.com/watch?v=" + v.videoId,
        thumbnail:
          "https://i.ytimg.com/vi/" + v.videoId + "/hqdefault.jpg"
      });
      if (out.length >= limit) break;
    }
    if (out.length >= limit) break;
  }
  return out;
}

/* Playwright's browser may not be downloaded. Check the executable path
 * once (cheaply) instead of attempting a doomed launch on every query. */
let browserUsable = null;
let browserCheckedAt = 0;
const BROWSER_CHECK_TTL = 10 * 60 * 1000;

function canUseBrowser() {
  const now = Date.now();
  if (browserUsable !== null && now - browserCheckedAt < BROWSER_CHECK_TTL)
    return browserUsable;

  browserCheckedAt = now;
  try {
    const { chromium } = require(PLAYWRIGHT);
    if (!chromium) throw new Error("no chromium export");
    const exe =
      typeof chromium.executablePath === "function"
        ? chromium.executablePath()
        : null;
    browserUsable = !!exe && fs.existsSync(exe);
  } catch (e) {
    browserUsable = false;
  }
  return browserUsable;
}

async function search(query, limit = 15) {
  const key = query.toLowerCase().trim();
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.items;

  // prefer the headless browser when present (richer results), else plain HTTP
  const engines = canUseBrowser()
    ? [browserSearch, httpSearch, httpSearch]
    : [httpSearch, httpSearch];

  let items = [];
  let lastErr;
  for (const fn of engines) {
    try {
      items = await fn(query, limit);
      if (items && items.length) break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!items.length && lastErr) throw lastErr;

  searchCache.set(key, { at: Date.now(), items });
  if (searchCache.size > 100) {
    for (const [k, v] of searchCache) {
      if (Date.now() - v.at > CACHE_TTL) searchCache.delete(k);
    }
  }
  return items;
}

/* ------------------------------ download ---------------------------- */
function dl() {
  return require("./ytdlp").resolve();
}

function fmtTime(sec) {
  if (!sec) return "N/A";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function extractVideoId(input) {
  if (!input) return null;
  const m = String(input).match(
    /(?:v=|\/shorts\/|youtu\.be\/|\/embed\/|\/v\/)([\w-]{6,})/
  );
  return m ? m[1] : null;
}

async function probeMeta(url) {
  const id = extractVideoId(url);
  if (!id) return {};
  try {
    const items = await httpSearch(id, 1);
    const hit = items.find((i) => i.videoId === id);
    if (hit) return hit;
  } catch (e) {
    /* ignore */
  }
  return { videoId: id, id, title: "YouTube Video", author: "YouTube", thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
}

function createDownloadJob(url, format = "mp3") {
  const job_id = newJob();
  const job = {
    job_id,
    status: "pending",
    stage: "queued",
    url,
    format: format === "mp4" ? "mp4" : "mp3",
    file_url: null,
    title: null,
    author: null,
    duration: null,
    thumbnail: null,
    error: null,
    created: Date.now()
  };
  jobs.set(job_id, job);
  sweep();
  startDownload(job);
  return { job_id };
}

async function startDownload(job) {
  const raw = dl();
  const outDir = path.join(__dirname, "..", "public", "files");
  fs.mkdirSync(outDir, { recursive: true });

  const isMp3 = job.format === "mp3";
  const videoId = extractVideoId(job.url) || Date.now().toString(36);
  const ext = isMp3 ? "mp3" : "mp4";

  // metadata (best effort, never fatal)
  try {
    const meta = await probeMeta(job.url);
    if (meta) {
      job.title = meta.title || null;
      job.author = meta.author || null;
      job.duration = meta.duration || (meta.duration_seconds ? fmtTime(meta.duration_seconds) : null);
      job.thumbnail = meta.thumbnail || null;
    }
  } catch (e) {
    /* ignore */
  }

  if (!raw) {
    job.status = "failed";
    job.stage = "error";
    job.error =
      "yt-dlp binary not found. Reinstall deps: cd fahu-api && npm install " +
      "(or set YTDLP_PATH=/path/to/yt-dlp)";
    return;
  }

  const hasFfmpeg = !!(ytdlp.ffmpeg() || ytdlp.ffmpegDir());

  const args = [
    job.url,
    "--no-warnings",
    "--no-playlist",
    "--no-part",
    "--no-continue",        // never resume a partial file (avoids HTTP 416 loops)
    "--retries", "5",
    "--fragment-retries", "5",
    "--extractor-retries", "3",
  ];

  if (ytdlp.ffmpegDir()) args.push("--ffmpeg-location", ytdlp.ffmpegDir());

  if (process.env.YT_COOKIES_BROWSER) {
    args.push("--cookies-from-browser", process.env.YT_COOKIES_BROWSER);
  } else if (process.env.YT_COOKIES_FILE) {
    args.push("--cookies", process.env.YT_COOKIES_FILE);
  } else if (process.env.YT_COOKIES) {
    const f = path.join(__dirname, "..", "cookies.json");
    fs.writeFileSync(f, process.env.YT_COOKIES, "utf8");
    args.push("--cookies", f);
  }

  if (isMp3) {
    if (hasFfmpeg) {
      args.push(
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "--embed-thumbnail",
        "--add-metadata"
      );
    } else {
      // No ffmpeg available: grab the audio track in its native container
      // (m4a/opus) so the command still returns a playable file.
      // NOTE: --add-metadata / --embed-thumbnail are skipped because both
      // require ffmpeg post-processing.
      job.warning = ytdlp.FFMPEG_HELP;
      args.push("-f", "bestaudio[ext=m4a]/bestaudio/bestaudio*");
    }
  } else {
    if (!hasFfmpeg) {
      // Modern YouTube serves video+audio as separate DASH streams; muxing
      // them into one mp4 is impossible without ffmpeg, so fail fast with
      // actionable guidance instead of a confusing format error.
      job.status = "failed";
      job.stage = "error";
      job.error = ytdlp.FFMPEG_HELP;
      return;
    }
    args.push(
      "-f",
      "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/b",
      "--merge-output-format",
      "mp4"
    );
  }

  if (!hasFfmpeg && isMp3) job.nativeContainer = true;

  const fileName = `${videoId}.%(ext)s`;
  const outPath = path.join(outDir, fileName);
  args.push("-o", outPath);

  job.stage = "downloading";

  execFile(
    raw,
    args,
    { windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout: 10 * 60 * 1000 },
    (err, stdout, stderr) => {
      if (err) {
        job.status = "failed";
        job.stage = "error";
        job.error =
          (stderr && String(stderr).split("\n").filter(Boolean).slice(-3).join("\n")) ||
          err.message ||
          "download failed";
        return;
      }

      // yt-dlp picks the final extension — resolve whatever it produced
      const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|opus|webm|flac|wav)$/i;
      const VIDEO_EXT = /\.(mp4|mkv|webm|mov|m4v|flv|3gp)$/i;

      let file = null;
      try {
        file = fs
          .readdirSync(outDir)
          .filter((f) => f.startsWith(videoId + "."))
          .filter((f) => !f.endsWith(".part") && !f.endsWith(".ytdl"))
          .sort((a, b) => {
            const ta = fs.statSync(path.join(outDir, a)).mtimeMs;
            const tb = fs.statSync(path.join(outDir, b)).mtimeMs;
            return tb - ta;
          })
          .find((f) =>
            job.nativeContainer
              ? (isMp3 ? AUDIO_EXT : VIDEO_EXT).test(f)
              : isMp3
              ? f.endsWith(".mp3")
              : VIDEO_EXT.test(f)
          );
      } catch (e) {
        file = null;
      }

      if (!file) {
        job.status = "failed";
        job.stage = "error";
        job.error = "output file not found";
        return;
      }

      const realExt = path.extname(file).replace(".", "").toLowerCase() || ext;
      const finalName = `${videoId}_${isMp3 ? "audio" : "video"}.${realExt}`;
      const finalPath = path.join(outDir, finalName);
      try {
        if (finalPath !== path.join(outDir, file)) {
          fs.copyFileSync(path.join(outDir, file), finalPath);
        }
        const stat = fs.statSync(finalPath);
        job.size = stat.size;
      } catch (e) {
        job.error = "post-processing failed: " + e.message;
        job.status = "failed";
        job.stage = "error";
        return;
      }

      job.status = "completed";
      job.stage = "done";
      job.file_url = "/files/" + finalName;
    }
  );
}

function getJob(id) {
  const j = jobs.get(String(id || "").trim());
  if (!j) return null;
  const { job_id, status, stage, file_url, title, author, duration, thumbnail,
          size, error, url, format, warning, nativeContainer } = j;
  return { job_id, status, stage, file_url, title, author, duration, thumbnail,
           size, error, url, format, warning, nativeContainer };
}

module.exports = { search, createDownloadJob, getJob, jobs };
