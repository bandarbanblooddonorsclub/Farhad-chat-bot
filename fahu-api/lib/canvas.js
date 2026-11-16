/**
 * Fahu API — AvatarCanvas replacement (100% local, no external API)
 *
 * Contract used by 14 Script/commands/*.js :
 *   POST /api { cmd, senderID, targetID }  -> raw PNG bytes
 *
 * Every command wraps two Facebook avatars (or one, when targetID is absent)
 * into a themed image. Avatars are resolved from Facebook's public graph
 * endpoint; a generated gradient avatar is used when that fails.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const { createCanvas, loadImage, registerFont } = require("./canvaslib");

const FALLBACK_DIR = path.join(__dirname, "..", "public", "fallback");
const AVATAR = 512;

/* ------------------------------ themes ------------------------------- */
const THEMES = {
  pair: { bg: ["#ff9a9e", "#fad0c4"], text: "💞 PERFECT PAIR 💞", frame: "#ff5f6d" },
  pairing: { bg: ["#a18cd1", "#fbc2eb"], text: "💘 PAIRING 💘", frame: "#a18cd1" },
  gf: { bg: ["#ff9a9e", "#fecfef"], text: "🌸 MY GIRLFRIEND 🌸", frame: "#ff6f91" },
  bf: { bg: ["#a1c4fd", "#c2e9fb"], text: "🌊 MY BOYFRIEND 🌊", frame: "#5b86e5" },
  love: { bg: ["#ff758c", "#ff7eb3"], text: "❤️ TRUE LOVE ❤️", frame: "#ff3b5c" },
  love3: { bg: ["#f6d365", "#fda085"], text: "💍 MY WIFE 💍", frame: "#f09819" },
  married: { bg: ["#fbc2eb", "#a6c1ee"], text: "💒 MARRIED 💒", frame: "#c86dd7" },
  crush: { bg: ["#ffecd2", "#fcb69f"], text: "😍 MY CRUSH 😍", frame: "#ff9a76" },
  crush2: { bg: ["#fddb92", "#d1fdff"], text: "💑 COUPLE 💑", frame: "#f6d365" },
  hug: { bg: ["#e0c3fc", "#8ec5fc"], text: "🤗 WARM HUG 🤗", frame: "#9b6dff" },
  kiss: { bg: ["#f093fb", "#f5576c"], text: "💋 LOVELY KISS 💋", frame: "#f5576c" },
  bro: { bg: ["#2b5876", "#4e4376"], text: "🤝 BROTHERHOOD 🤝", frame: "#4e4376" },
  bestFriend: { bg: ["#43cea2", "#185a9d"], text: "🌟 BEST FRIEND 🌟", frame: "#185a9d" },
  wife: { bg: ["#f6d365", "#fda085"], text: "💍 MY WIFE 💍", frame: "#f09819" },
  chor: { bg: ["#232526", "#414345"], text: "🥷 WANTED: CHOR 🥷", frame: "#ffcc00" },
  rip: { bg: ["#232526", "#414345"], text: "🕊️ REST IN PEACE 🕊️", frame: "#c0c0c0" },
  arrest: { bg: ["#232526", "#414345"], text: "🚓 UNDER ARREST 🚓", frame: "#ff3b30" },
};

/* ----------------------------- utilities ----------------------------- */
function pickTheme(cmd) {
  const key = String(cmd || "pair").trim();
  return (
    THEMES[key] || {
      bg: ["#667eea", "#764ba2"],
      text: "✨ " + key.toUpperCase() + " ✨",
      frame: "#667eea",
    }
  );
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function mix(a, b, t) {
  const ca = hexToRgb(a),
    cb = hexToRgb(b);
  return `rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * t)},${Math.round(
    ca[1] + (cb[1] - ca[1]) * t
  )},${Math.round(ca[2] + (cb[2] - ca[2]) * t)})`;
}

function hashId(id) {
  let h = 0;
  const s = String(id || "0");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("too many redirects"));
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
        timeout: 20000,
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return get(res.headers.location, redirects + 1).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("HTTP " + res.statusCode));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
  });
}

/** Build a deterministic gradient avatar with initials — always works. */
function fallbackAvatar(id) {
  const size = AVATAR;
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");
  const h = hashId(id);
  const palette = [
    ["#667eea", "#764ba2"],
    ["#f093fb", "#f5576c"],
    ["#4facfe", "#00f2fe"],
    ["#43e97b", "#38f9d7"],
    ["#fa709a", "#fee140"],
    ["#30cfd0", "#330867"],
    ["#a8edea", "#fed6e3"],
    ["#ff9a9e", "#fad0c4"],
  ];
  const [a, b] = palette[h % palette.length];

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const initial = String(id || "?").trim().slice(-1).toUpperCase() || "?";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `bold ${Math.floor(size * 0.42)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initial, size / 2, size / 2 + size * 0.02);

  return c.toBuffer("image/png");
}

async function avatarFor(id) {
  const safe = String(id || "").replace(/[^\w\-.]/g, "").slice(0, 40) || "unknown";
  const file = path.join(FALLBACK_DIR, safe + ".png");

  // cached?
  try {
    if (fs.existsSync(file)) return fs.readFileSync(file);
  } catch (e) {
    /* ignore */
  }

  const urls = [
    `https://graph.facebook.com/${encodeURIComponent(id)}/picture?width=${AVATAR}&height=${AVATAR}&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
    `https://graph.facebook.com/${encodeURIComponent(id)}/picture?type=large`,
  ];

  for (const u of urls) {
    try {
      const buf = await get(u);
      if (buf && buf.length > 500) {
        try {
          fs.mkdirSync(FALLBACK_DIR, { recursive: true });
          fs.writeFileSync(file, buf);
        } catch (e) {
          /* ignore cache write errors */
        }
        return buf;
      }
    } catch (e) {
      /* try next */
    }
  }

  const gen = fallbackAvatar(id);
  try {
    fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    fs.writeFileSync(file, gen);
  } catch (e) {
    /* ignore */
  }
  return gen;
}

/* ------------------------------ drawing ------------------------------ */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circleImage(ctx, img, cx, cy, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
  try {
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
  } catch (e) {
    /* ignore */
  }
  ctx.restore();
}

function fitText(ctx, text, maxWidth, startPx, family = "sans-serif") {
  let px = startPx;
  do {
    ctx.font = `bold ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 2;
  } while (px > 12);
  return px;
}

/**
 * @param {string} cmd     theme key
 * @param {string} senderID
 * @param {string} targetID
 * @returns {Promise<Buffer>} PNG
 */
async function render(cmd, senderID, targetID) {
  const theme = pickTheme(cmd);
  const W = 1280;
  const H = 720;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  /* background gradient */
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, theme.bg[0]);
  bg.addColorStop(1, theme.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  /* soft decorative blobs */
  for (let i = 0; i < 14; i++) {
    const h = hashId(cmd + ":" + i);
    const r = 40 + (h % 160);
    const x = (h % W);
    const y = ((h >> 5) % H);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* avatars */
  const single = !targetID || String(targetID) === String(senderID);
  const R = 190;
  const cy = 330;

  const aBuf = await avatarFor(senderID);
  const aImg = await loadImage(aBuf);

  let bImg = null;
  if (!single) {
    const bBuf = await avatarFor(targetID);
    bImg = await loadImage(bBuf);
  }

  if (single) {
    const cx = W / 2;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 40;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, R + 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    circleImage(ctx, aImg, cx, cy, R);
  } else {
    const cx1 = W / 2 - 230;
    const cx2 = W / 2 + 230;

    // connector heart/link
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 30;
    for (const cx of [cx1, cx2]) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, R + 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    circleImage(ctx, aImg, cx1, cy, R);
    circleImage(ctx, bImg, cx2, cy, R);

    // center emblem
    ctx.save();
    ctx.translate(W / 2, cy);
    ctx.fillStyle = theme.frame;
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 20;
    ctx.font = "bold 92px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const emblem =
      { hug: "🤗", kiss: "💋", bro: "🤝", bestFriend: "🌟", chor: "🥷", rip: "🕊️", arrest: "🚓" }[cmd] ||
      (/wife|married|love3/.test(cmd) ? "💍" : "❤️");
    ctx.fillText(emblem, 0, 0);
    ctx.restore();
  }

  /* frame border */
  ctx.save();
  ctx.strokeStyle = theme.frame;
  ctx.lineWidth = 16;
  roundRect(ctx, 24, 24, W - 48, H - 48, 36);
  ctx.stroke();
  ctx.restore();

  /* title banner */
  const title = theme.text;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const px = fitText(ctx, title, W - 200, 74);
  ctx.font = `bold ${px}px sans-serif`;

  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title, W / 2, 610);
  ctx.restore();

  /* watermark */
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 26px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("𝐌𝐃 𝐅𝐀𝐑𝐇𝐀𝐃 𝐔𝐃𝐃𝐈𝐍  •  𝐅𝐀𝐇𝐔 𝐀𝐏𝐈", W / 2, 672);
  ctx.restore();

  return canvas.toBuffer("image/png");
}

module.exports = { render, THEMES };
