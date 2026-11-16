/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║                          F A H U   A P I                         ║
 * ║        Service backend for the MD FARHAD UDDIN chat bot          ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Endpoints
 * ---------
 *   GET  /                     dashboard
 *   GET  /health               health + feature report
 *   GET  /API.json             service registry consumed by the bot
 *   GET  /commands/4k.js       real source for the remote 4k command
 *
 *   simsimi (Bot.js / Autoreply.js)
 *   GET  /simsimi?text=&senderName=
 *   GET  /teach?ask=&ans=&senderID=&senderName=&groupID=&groupName=
 *   GET  /list
 *   GET  /delete?ask=&ans=
 *   GET  /edit?ask=&old=&new=
 *
 *   quize (quiz.js)
 *   GET  /quiz
 *   POST /quiz/answer
 *
 *   ytapi (song.js / sing.js / youtube.js)
 *   GET  /api/search?q=&limit=
 *   POST /api/download           { url, format }
 *   GET  /api/jobs/:id
 *
 *   AvatarCanvas (14 banner commands)
 *   POST /api                    { cmd, senderID, targetID } -> PNG
 *
 *   anime_video (anime.js)
 *   GET  /anime                  -> mp4 stream
 *
 *   prompt (prompt.js)
 *   POST /prompt                 { image, language } -> { prompt }
 *   POST /image-to-prompt        alias
 *
 *   4k (4k.js)
 *   POST /4k/upscale             { image, scale } | multipart -> JSON
 *
 *   GET  /files/:name            generated downloads
 */
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const simsimi = require("./lib/simsimi");
const quiz = require("./lib/quiz");
const yt = require("./lib/ytapi");
const canvas = require("./lib/canvas");
const video = require("./lib/video");
const promptLib = require("./lib/prompt");
const upscaleLib = require("./lib/upscale");

const PORT = Number(process.env.PORT || 4040);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");

const ROOT = __dirname;
const FILES_DIR = path.join(ROOT, "public", "files");
const FALLBACK_DIR = path.join(ROOT, "public", "fallback");

fs.mkdirSync(FILES_DIR, { recursive: true });
fs.mkdirSync(FALLBACK_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: "256mb" }));
app.use(express.urlencoded({ extended: true, limit: "256mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024 },
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
function baseUrl(req) {
  if (PUBLIC_BASE) return PUBLIC_BASE;
  const proto =
    (req.headers["x-forwarded-proto"] && String(req.headers["x-forwarded-proto"]).split(",")[0]) ||
    req.protocol;
  const host =
    (req.headers["x-forwarded-host"] && String(req.headers["x-forwarded-host"]).split(",")[0]) ||
    req.get("host");
  return `${proto}://${host}`;
}

const ok = (res, data) => res.json(data);
const fail = (res, msg, code = 500) =>
  res.status(code).json({ error: String(msg) });

/** Wrap an async handler so a throw never kills the process. */
const wrap = (fn) => (req, res) =>
  Promise.resolve()
    .then(() => fn(req, res))
    .catch((e) => {
      console.error("[fahu-api]", req.method, req.originalUrl, e && e.message);
      if (!res.headersSent) fail(res, (e && e.message) || "internal error");
    });

const str = (v) => (v === undefined || v === null ? "" : String(v));

/* ------------------------------------------------------------------ */
/* registry                                                            */
/* ------------------------------------------------------------------ */
app.get(
  "/API.json",
  wrap((req, res) => {
    const b = baseUrl(req);
    // NOTE: key semantics must match how each command builds its request.
    //   simsimi       command does  `${simsimi}/simsimi`   -> base
    //   quize         command does  quizAPI + "/quiz"      -> base (trailing / stripped)
    //   AvatarCanvas  command does  `${AvatarCanvas}/api`  -> base
    //   ytapi         command does  `${ytapi}/api/download`-> base
    //   anime_video   used verbatim as the request URL     -> full url
    //   prompt        used verbatim as the request URL     -> full url
    ok(res, {
      // --- keys the commands actually read -------------------------
      simsimi: b,
      anime_video: `${b}/anime`,
      prompt: `${b}/prompt`,
      ai: "no api",
      ytapi: b,
      quize: b,
      AvatarCanvas: b,
      // --- extras supplied by Fahu API ------------------------------
      base: b,
      upscale: `${b}/4k/upscale`,
      command_4k: `${b}/commands/4k.js`,
      name: "Fahu API",
      owner: "MD FARHAD UDDIN",
      version: "1.0.0",
    });
  })
);

/* ------------------------------------------------------------------ */
/* meta                                                                */
/* ------------------------------------------------------------------ */
app.get("/health", (req, res) => {
  let canvasBackend = "unavailable";
  try {
    canvasBackend = require("./lib/canvaslib").backend;
  } catch (e) {
    /* ignore */
  }

  let ytDl = false;
  try {
    ytDl = !!require("./lib/ytdlp").resolve();
  } catch (e) {
    /* ignore */
  }

  let ffmpeg = null;
  try {
    ffmpeg = require("./lib/ytdlp").ffmpeg();
  } catch (e) {
    /* ignore */
  }

  let browser = false;
  try {
    browser = !!require(
      path.join(ROOT, "node_modules", "playwright-core")
    ).chromium;
  } catch (e) {
    /* ignore */
  }

  const sim = simsimi.list();

  ok(res, {
    ok: true,
    service: "Fahu API",
    owner: "MD FARHAD UDDIN",
    version: "1.0.0",
    uptime: Math.round(process.uptime()),
    node: process.version,
    features: {
      simsimi: { enabled: true, questions: sim.totalQuestions, replies: sim.totalReplies },
      quiz: { enabled: true, sessions: quiz.sessions.size },
      ytapi: {
        enabled: true,
        engine: ytDl ? "yt-dlp " + (require("./lib/ytdlp").version() || "") : "not installed",
        headlessBrowser: browser,
        ffmpeg: ffmpeg || "not installed",
        activeJobs: yt.jobs.size,
      },
      canvas: { enabled: canvasBackend !== "unavailable", backend: canvasBackend, themes: Object.keys(canvas.THEMES).length },
      anime: { enabled: true, cached: video.list().length },
      prompt: { enabled: canvasBackend !== "unavailable", engine: process.env.PROMPT_AI_URL ? "ai+local" : "local-cv" },
      upscale: { enabled: canvasBackend !== "unavailable", maxPixels: 36e6, algorithm: "Lanczos3 + unsharp mask" },
    },
  });
});

app.get("/", (req, res) => {
  res.type("html").send(dashboard(baseUrl(req)));
});

/* ------------------------------------------------------------------ */
/* simsimi                                                             */
/* ------------------------------------------------------------------ */
app.get(
  "/simsimi",
  wrap(async (req, res) => {
    const text = str(req.query.text);
    const senderName = str(req.query.senderName);
    if (!text) return fail(res, "missing ?text=", 400);
    const out = simsimi.chat(text, senderName);
    // Some clients expect a bare string, others an array — return array
    // (commands join arrays and also handle strings).
    ok(res, { response: out.response, source: out.source });
  })
);

app.get(
  "/teach",
  wrap((req, res) => {
    ok(
      res,
      simsimi.teach({
        ask: str(req.query.ask),
        ans: str(req.query.ans),
        senderID: str(req.query.senderID),
        senderName: str(req.query.senderName),
        groupID: str(req.query.groupID),
        groupName: str(req.query.groupName),
      })
    );
  })
);

app.get("/list", wrap((req, res) => ok(res, simsimi.list())));

app.get(
  "/delete",
  wrap((req, res) =>
    ok(res, simsimi.remove(str(req.query.ask), str(req.query.ans)))
  )
);

app.get(
  "/edit",
  wrap((req, res) =>
    ok(
      res,
      simsimi.edit(str(req.query.ask), str(req.query.old), str(req.query.new))
    )
  )
);

/* ------------------------------------------------------------------ */
/* quiz                                                                */
/* ------------------------------------------------------------------ */
app.get(
  "/quiz",
  wrap((req, res) => {
    const q = quiz.newQuiz();
    if (!q) return fail(res, "quiz bank is empty", 503);
    ok(res, q);
  })
);

app.post(
  "/quiz/answer",
  wrap((req, res) => {
    const sessionID = str((req.body && req.body.sessionID) || req.query.sessionID);
    const answer = str((req.body && req.body.answer) || req.query.answer);
    const out = quiz.answerQuiz(sessionID, answer);
    if (!out) return fail(res, "invalid or expired sessionID", 404);
    ok(res, out);
  })
);

/* ------------------------------------------------------------------ */
/* ytapi                                                               */
/* ------------------------------------------------------------------ */
app.get(
  "/api/search",
  wrap(async (req, res) => {
    const q = str(req.query.q);
    if (!q) return fail(res, "missing ?q=", 400);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
    const results = await yt.search(q, limit);
    ok(res, { query: q, count: results.length, results });
  })
);

app.post(
  "/api/download",
  wrap(async (req, res) => {
    const url = str(req.body && (req.body.url || req.body.link));
    if (!url) return fail(res, "missing { url }", 400);
    const format = str((req.body && req.body.format) || "mp3").toLowerCase();
    ok(res, yt.createDownloadJob(url, format));
  })
);

app.get(
  "/api/jobs/:id",
  wrap((req, res) => {
    const job = yt.getJob(req.params.id);
    if (!job) return fail(res, "unknown job id", 404);
    ok(res, job);
  })
);

/* ------------------------------------------------------------------ */
/* AvatarCanvas                                                        */
/* ------------------------------------------------------------------ */
const canvasHandler = wrap(async (req, res) => {
  const cmd = str((req.body && req.body.cmd) || req.query.cmd || "pair");
  const senderID = str((req.body && req.body.senderID) || req.query.senderID);
  const targetID = str((req.body && req.body.targetID) || req.query.targetID);

  if (!senderID) return fail(res, "missing { senderID }", 400);

  const png = await canvas.render(cmd, senderID, targetID || "");
  res.set("Content-Type", "image/png");
  res.set("Content-Length", String(png.length));
  res.set("Cache-Control", "public, max-age=86400");
  res.end(png);
});

app.post("/api", canvasHandler);
app.get("/api", canvasHandler);
app.post("/canvas", canvasHandler);
app.get("/canvas", canvasHandler);

/* ------------------------------------------------------------------ */
/* anime video                                                         */
/* ------------------------------------------------------------------ */
app.get(
  "/anime",
  wrap(async (req, res) => {
    const file = await video.random();
    if (!file || !fs.existsSync(file))
      return fail(res, "no anime video cached — add sources first", 503);

    const stat = fs.statSync(file);
    const range = req.headers.range;

    res.set("Content-Type", "video/mp4");
    res.set("Accept-Ranges", "bytes");
    res.set("Cache-Control", "public, max-age=3600");

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
      res.status(206);
      res.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      res.set("Content-Length", String(end - start + 1));
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }

    res.set("Content-Length", String(stat.size));
    fs.createReadStream(file).pipe(res);
  })
);

app.get("/videos", wrap((req, res) => ok(res, { sources: video.readSources(), cached: video.list() })));

app.post(
  "/videos/add",
  wrap(async (req, res) => {
    const url = str((req.body && req.body.url) || req.query.url);
    if (!url) return fail(res, "missing { url }", 400);
    const list = video.readSources();
    if (!list.includes(url)) list.push(url);
    video.writeSources(list);
    const got = await video.ensure(true);
    ok(res, { ok: true, sources: list.length, cached: !!got });
  })
);

/* ------------------------------------------------------------------ */
/* prompt (image -> text)                                              */
/* ------------------------------------------------------------------ */
const promptHandler = wrap(async (req, res) => {
  const body = req.body || {};
  const image = str(body.image || body.url || body.imageUrl);
  if (!image && !(req.file && req.file.buffer))
    return fail(res, "missing { image } (data URI, URL) or multipart file", 400);

  const src =
    image ||
    "data:" +
      (req.file.mimetype || "image/jpeg") +
      ";base64," +
      req.file.buffer.toString("base64");

  const out = await promptLib.imageToPrompt(src, str(body.language || "en"));
  ok(res, { prompt: out.prompt, engine: out.engine, analysis: out.analysis });
});

app.post("/prompt", upload.single("image"), promptHandler);
app.post("/image-to-prompt", upload.single("image"), promptHandler);
app.post("/prompt/", upload.single("image"), promptHandler);

/* ------------------------------------------------------------------ */
/* 4K upscale                                                          */
/* ------------------------------------------------------------------ */
const upscaleHandler = wrap(async (req, res) => {
  const body = req.body || {};
  const src =
    str(body.image || body.url || body.imageUrl) ||
    (req.file
      ? "data:" + (req.file.mimetype || "image/jpeg") + ";base64," + req.file.buffer.toString("base64")
      : "");

  if (!src) return fail(res, "missing { image } (data URI, URL) or multipart file", 400);

  const scale = Math.min(8, Math.max(1, Number(body.scale || 4)));
  const result = await upscaleLib.upscale(src, {
    scale,
    target: body.target ? Number(body.target) : null,
    sharpness: body.sharpness !== undefined ? Number(body.sharpness) : undefined,
    format: str(body.format || "png"),
  });

  const name = `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${result.format === "jpeg" ? "jpg" : "png"}`;
  const file = path.join(FILES_DIR, name);
  fs.writeFileSync(file, result.buffer);

  ok(res, {
    ok: true,
    file_url: "/files/" + name,
    url: `${baseUrl(req)}/files/${name}`,
    width: result.width,
    height: result.height,
    srcWidth: result.srcWidth,
    srcHeight: result.srcHeight,
    scale: result.scale,
    bytes: result.buffer.length,
    ms: result.ms,
  });
});

app.post("/4k/upscale", upload.single("image"), upscaleHandler);
app.post("/upscale", upload.single("image"), upscaleHandler);

/* ------------------------------------------------------------------ */
/* static generated files                                              */
/* ------------------------------------------------------------------ */
app.use("/files", express.static(FILES_DIR, { maxAge: "6h", index: false }));
app.use("/fallback", express.static(FALLBACK_DIR, { maxAge: "24h", index: false }));

/* ------------------------------------------------------------------ */
/* remote command source: 4k                                           */
/* ------------------------------------------------------------------ */
app.get("/commands/4k.js", (req, res) => {
  const file = path.join(ROOT, "commands", "4k.js");
  if (!fs.existsSync(file)) return fail(res, "command source missing", 404);
  res.type("application/javascript; charset=utf-8");
  res.send(fs.readFileSync(file, "utf8"));
});

/* ------------------------------------------------------------------ */
/* 404 + error                                                         */
/* ------------------------------------------------------------------ */
app.use((req, res) => fail(res, `unknown endpoint ${req.method} ${req.originalUrl}`, 404));

app.use((err, req, res, next) => {
  console.error("[fahu-api fatal]", err && err.message);
  if (!res.headersSent) fail(res, (err && err.message) || "internal error");
});

/* ------------------------------------------------------------------ */
/* dashboard                                                           */
/* ------------------------------------------------------------------ */
function dashboard(base) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fahu API — MD FARHAD UDDIN</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#0b1020;color:#e7ecff;font:15px/1.55 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
a{color:#8ab4ff}
.wrap{max-width:960px;margin:0 auto;padding:40px 20px 70px}
h1{font-size:34px;margin:0 0 4px;letter-spacing:.5px}
h1 span{background:linear-gradient(90deg,#7aa2ff,#c58bff);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:#93a0c8;margin-bottom:28px}
.card{background:#141a30;border:1px solid #26304f;border-radius:14px;padding:18px 20px;margin-bottom:16px}
.card h2{margin:0 0 12px;font-size:17px;color:#cfe0ff}
table{width:100%;border-collapse:collapse}
td{padding:6px 4px;border-bottom:1px solid #222c49;vertical-align:top}
td:first-child{width:250px;color:#9fb0dd;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
.pill{display:inline-block;background:#1d2540;color:#8ab4ff;border:1px solid #2c375d;border-radius:999px;padding:2px 10px;font-size:12px;margin-left:8px}
code{background:#0e1426;border:1px solid #26304f;border-radius:6px;padding:1px 6px;font-size:13px}
.foot{color:#6f7da6;font-size:13px;margin-top:26px}
</style></head><body><div class="wrap">
<h1><span>Fahu API</span></h1>
<div class="sub">Service backend for the <b>MD FARHAD UDDIN</b> chat bot • v1.0.0</div>

<div class="card"><h2>Registry</h2>
<table>
<tr><td>GET /API.json</td><td>Service registry the bot reads</td></tr>
<tr><td>GET /health</td><td>Health + feature report</td></tr>
</table></div>

<div class="card"><h2>Simsimi <span class="pill">Bot.js · Autoreply.js</span></h2>
<table>
<tr><td>GET /simsimi?text=&amp;senderName=</td><td>Chat reply — <code>{response:[...]}</code></td></tr>
<tr><td>GET /teach?ask=&amp;ans=</td><td>Teach a question/reply pair</td></tr>
<tr><td>GET /list</td><td>Stats</td></tr>
<tr><td>GET /delete?ask=&amp;ans=</td><td>Delete a pair</td></tr>
<tr><td>GET /edit?ask=&amp;old=&amp;new=</td><td>Edit a reply</td></tr>
</table></div>

<div class="card"><h2>Quiz <span class="pill">quiz.js</span></h2>
<table>
<tr><td>GET /quiz</td><td><code>{question,A,B,C,D,sessionID}</code></td></tr>
<tr><td>POST /quiz/answer</td><td><code>{sessionID,answer}</code> → <code>{correct,answer}</code></td></tr>
</table></div>

<div class="card"><h2>YouTube <span class="pill">song.js · sing.js · youtube.js</span></h2>
<table>
<tr><td>GET /api/search?q=&amp;limit=</td><td>Search results</td></tr>
<tr><td>POST /api/download</td><td><code>{url,format:"mp3"|"mp4"}</code> → <code>{job_id}</code></td></tr>
<tr><td>GET /api/jobs/:id</td><td>Poll → <code>{status,file_url}</code></td></tr>
</table></div>

<div class="card"><h2>Avatar Canvas <span class="pill">14 banner commands</span></h2>
<table>
<tr><td>POST /canvas</td><td><code>{cmd,senderID,targetID}</code> → PNG</td></tr>
<tr><td>POST /api</td><td>same (legacy path)</td></tr>
</table></div>

<div class="card"><h2>Anime video <span class="pill">anime.js</span></h2>
<table>
<tr><td>GET /anime</td><td>Random mp4 stream</td></tr>
<tr><td>POST /videos/add</td><td>Add a source URL</td></tr>
</table></div>

<div class="card"><h2>Prompt &amp; 4K <span class="pill">prompt.js · 4k.js</span></h2>
<table>
<tr><td>POST /prompt</td><td><code>{image, language}</code> → <code>{prompt}</code></td></tr>
<tr><td>POST /4k/upscale</td><td><code>{image, scale}</code> → <code>{file_url,width,height}</code></td></tr>
<tr><td>GET /commands/4k.js</td><td>Source served to the 4k loader</td></tr>
</table></div>

<div class="foot">Base: <code>${base}</code> — put this value in <code>config.json → FAHU_API</code>.</div>
</div></body></html>`;
}

/* ------------------------------------------------------------------ */
/* never let one bad request take the whole API down                   */
/* ------------------------------------------------------------------ */
process.on("uncaughtException", (err) => {
  console.error("[fahu-api] uncaughtException:", err && err.stack);
});
process.on("unhandledRejection", (reason) => {
  console.error("[fahu-api] unhandledRejection:", reason);
});

/* ------------------------------------------------------------------ */
app.listen(PORT, HOST, () => {
  const line = "─".repeat(58);
  console.log(
    [
      "",
      `  ╭${line}╮`,
      "  │                    F A H U   A P I                      │",
      `  ╰${line}╯`,
      "",
      `  listening   http://${HOST}:${PORT}`,
      `  registry    http://localhost:${PORT}/API.json`,
      `  health      http://localhost:${PORT}/health`,
      `  dashboard   http://localhost:${PORT}/`,
      "",
      `  MD FARHAD UDDIN  •  ${new Date().toISOString()}`,
      "",
    ].join("\n")
  );
});
