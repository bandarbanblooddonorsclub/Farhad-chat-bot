/**
 * 4K IMAGE ENHANCER  —  served by FAHU API
 * ------------------------------------------------------------------
 * This file is the *real* implementation that Script/commands/4k.js
 * downloads and compiles at runtime (remote-command loader pattern).
 *
 * Engine: FAHU API `/4k/upscale`  —  Lanczos3 resampling + unsharp
 * mask, 100% local. No third-party service, no watermark.
 *
 * Usage:
 *   /4k            (reply to an image)  -> 4x upscale
 *   /4k 2|3|4|8    (reply to an image)  -> custom factor
 *   /4k @mention                        -> upscale that person's avatar
 */
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

/* ------------------------------------------------------------------ */
/* FAHU API base — one config key controls every API-driven command.   */
/* ------------------------------------------------------------------ */
function fahuBase() {
  const fromConfig =
    (typeof global !== "undefined" &&
      global.config &&
      global.config.FAHU_API) ||
    null;
  return (
    fromConfig ||
    process.env.FAHU_API ||
    "https://gitlab.com/YOUR_GITLAB_USERNAME/fahu-api/-/raw/main"
  );
}

/**
 * This module is compiled from a URL, so `__dirname` is NOT a real folder.
 * Resolve the bot's command cache directory from the running bot instead.
 */
function cacheDir() {
  const candidates = [];

  if (global.client && global.client.mainPath)
    candidates.push(path.join(global.client.mainPath, "Script", "commands", "cache"));
  if (global.client && global.client.dirCommands)
    candidates.push(path.join(global.client.dirCommands, "cache"));

  candidates.push(path.join(process.cwd(), "Script", "commands", "cache"));

  for (const c of candidates) {
    try {
      fs.ensureDirSync(c);
      return c;
    } catch (e) {
      /* try next */
    }
  }

  return require("os").tmpdir();
}

const CACHE = cacheDir();

module.exports.config = {
  name: "4k",
  version: "3.0.0",
  hasPermssion: 0,
  credits: "MD FARHAD UDDIN",
  description: "Upscale an image to 4K using the Fahu API (Lanczos3 + sharpen)",
  commandCategory: "image",
  usePrefix: true,
  usages: "[reply image] or [scale 2-8]",
  cooldowns: 5,
  dependencies: {
    axios: "",
    "fs-extra": "",
    path: ""
  }
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const IMAGE_TYPES = ["photo", "animated_image", "sticker"];

function pickAttachment(event) {
  const sources = [
    event && event.messageReply && event.messageReply.attachments,
    event && event.attachments
  ];
  for (const list of sources) {
    if (!Array.isArray(list)) continue;
    const hit = list.find(
      (a) => a && IMAGE_TYPES.includes(a.type) && a.url
    );
    if (hit) return hit;
  }
  return null;
}

function pickTarget(event) {
  if (event && event.mentions && Object.keys(event.mentions).length)
    return Object.keys(event.mentions)[0];
  if (event && event.messageReply && event.messageReply.senderID)
    return event.messageReply.senderID;
  return null;
}

function parseScale(args) {
  if (!Array.isArray(args)) return null;
  for (const raw of args) {
    const m = String(raw).trim().match(/^(\d{1,2})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 2 && n <= 8) return n;
    }
    const x = String(raw).trim().toLowerCase().match(/^x(\d)$/);
    if (x) {
      const n = parseInt(x[1], 10);
      if (n >= 2 && n <= 8) return n;
    }
  }
  return null;
}

const AVATAR = id =>
  `https://graph.facebook.com/${encodeURIComponent(
    id
  )}/picture?width=1024&height=1024`;

/* ------------------------------------------------------------------ */
/* main                                                               */
/* ------------------------------------------------------------------ */
module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  const scale = parseScale(args) || 4;

  /* ---- locate the source image ---- */
  const attachment = pickAttachment(event);
  const target = pickTarget(event);

  let imageUrl = null;

  if (attachment) imageUrl = attachment.url;
  else if (target) imageUrl = AVATAR(target);
  else imageUrl = AVATAR(event.senderID);

  if (!imageUrl) {
    return api.sendMessage(
      "⚠️ কোনো ছবি পাওয়া যায়নি!\n\nএকটি ছবিতে reply দিয়ে `4k` লিখুন।",
      threadID,
      messageID
    );
  }

  /* ---- progress notice ---- */
  let wait = null;
  try {
    wait = await api.sendMessage(
      `⏳ ${scale}x — 4K এ উন্নীত করা হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।`,
      threadID,
      messageID
    );
  } catch (e) {
    /* ignore */
  }

  const unsend = () => {
    if (wait && wait.messageID)
      api.unsendMessage(wait.messageID).catch(() => {});
  };

  let outPath = null;

  try {
    const BASE = fahuBase();

    const { data: up } = await axios.post(
      `${BASE}/4k/upscale`,
      { image: imageUrl, scale, format: "png" },
      { timeout: 300000, maxBodyLength: Infinity, maxContentLength: Infinity }
    );

    if (!up || !up.ok || !up.file_url) {
      throw new Error((up && up.error) || "upscale failed");
    }

    const fileUrl = up.file_url.startsWith("http")
      ? up.file_url
      : `${BASE}${up.file_url.startsWith("/") ? "" : "/"}${up.file_url}`;

    fs.ensureDirSync(CACHE);
    outPath = path.join(
      CACHE,
      `4k_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`
    );

    const bin = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      timeout: 300000,
      maxContentLength: Infinity
    });

    fs.writeFileSync(outPath, Buffer.from(bin.data));

    const meta = [
      `✅ 4K UPSCALE COMPLETE`,
      ``,
      `📐 ${up.srcWidth}×${up.srcHeight}  ➜  ${up.width}×${up.height}`,
      `🔎 Scale: ${up.scale}x   ⏱️ ${up.ms ? (up.ms / 1000).toFixed(1) + "s" : "—"}`,
      ``,
      `𝐌𝐃 𝐅𝐀𝐑𝐇𝐀𝐃 𝐔𝐃𝐃𝐈𝐍  •  𝐅𝐀𝐇𝐔 𝐀𝐏𝐈`
    ].join("\n");

    unsend();

    return api.sendMessage(
      { body: meta, attachment: fs.createReadStream(outPath) },
      threadID,
      () => {
        try {
          if (outPath && fs.existsSync(outPath)) fs.unlinkSync(outPath);
        } catch (e) {
          /* ignore */
        }
      },
      messageID
    );
  } catch (err) {
    unsend();

    const reason =
      (err.response && err.response.data && err.response.data.error) ||
      err.message ||
      "unknown error";

    return api.sendMessage(
      `❌ 4K উন্নয়ন ব্যর্থ হয়েছে!\n\nকারণ: ${reason}\n\n` +
        `Fahu API চালু আছে কিনা ও config.json এ FAHU_API ঠিক আছে কিনা দেখুন।`,
      threadID,
      messageID
    );
  }
};

/* ------------------------------------------------------------------ */
/* event hook — the loader delegates here for every incoming event.    */
/* Kept intentionally light: it only reacts when a message is a bare   */
/* "4k" with an image attached and no prefix, so nothing is spammed.   */
/* ------------------------------------------------------------------ */
module.exports.handleEvent = async function ({ api, event }) {
  try {
    if (!event || event.type !== "message") return;
    if (event.isGroup === false) return;

    const body = String(event.body || "").trim().toLowerCase();
    if (body !== "4k" && body !== "/4k" && body !== ".4k") return;

    // only when an actual image is attached to the message
    if (!pickAttachment(event)) return;

    return module.exports.run({ api, event, args: [] });
  } catch (e) {
    /* never crash the event loop */
  }
};
