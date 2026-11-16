/**
 * Fahu API — image → prompt service
 *
 * Contract used by Script/commands/prompt.js :
 *   POST {prompt base} { image: "data:image/jpeg;base64,...", language: "en" }
 *     -> { prompt: string }
 *
 * Two engines:
 *  1. `ai`   — forwards to any OpenAI-compatible vision endpoint when
 *              PROMPT_AI_URL / PROMPT_AI_KEY / PROMPT_AI_MODEL are set.
 *  2. `local`— a real computer-vision analyser (default, always available):
 *              dominant-color palette via histogram quantisation, brightness,
 *              contrast, saturation, colour temperature, edge/detail density,
 *              aspect ratio and composition. Emits a structured, weighted
 *              prompt in the style used by Stable Diffusion / Midjourney.
 */
const { createCanvas, loadImage } = require("./canvaslib");

/* --------------------------- colour helpers -------------------------- */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, l];
}

const NAMES = [
  [0, "red"], [15, "vermilion"], [30, "orange"], [45, "amber"],
  [60, "yellow"], [75, "lime"], [90, "chartreuse"], [105, "green"],
  [120, "green"], [140, "emerald"], [160, "teal"], [180, "cyan"],
  [195, "sky blue"], [210, "azure"], [225, "blue"], [240, "indigo"],
  [255, "violet"], [270, "purple"], [285, "magenta"], [300, "fuchsia"],
  [315, "pink"], [330, "rose"], [345, "crimson"], [360, "red"],
];

function hueName(h) {
  let best = NAMES[0][1],
    bestD = 999;
  for (const [hh, name] of NAMES) {
    const d = Math.abs(h - hh);
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

function describe(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (s < 0.12) {
    if (l > 0.85) return "white";
    if (l > 0.65) return "light grey";
    if (l > 0.4) return "grey";
    if (l > 0.18) return "dark grey";
    return "black";
  }
  const bright = l > 0.62 ? "light " : l < 0.32 ? "deep " : "";
  const sat = s > 0.6 ? "vivid " : s < 0.28 ? "muted " : "";
  return bright + sat + hueName(h);
}

/* ------------------------------ analysis ----------------------------- */
/**
 * Runs a full analysis on raw RGBA pixels.
 * @returns {object} structured description
 */
function analyse(data, width, height) {
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 40000)));
  const buckets = new Map();

  let sumL = 0,
    sumS = 0,
    n = 0,
    minL = 1,
    maxL = 0,
    warm = 0,
    cool = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (data[i + 3] < 128) continue;

      const [h, s, l] = rgbToHsl(r, g, b);
      sumL += l;
      sumS += s;
      n++;
      if (l < minL) minL = l;
      if (l > maxL) maxL = l;
      if (h < 60 || h > 300) warm++;
      else cool++;

      // quantise to a 5-bit-per-channel palette
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const cur = buckets.get(key);
      if (cur) {
        cur.n++;
        cur.r += r;
        cur.g += g;
        cur.b += b;
      } else {
        buckets.set(key, { n: 1, r, g, b });
      }
    }
  }

  const palette = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((c) => ({
      name: describe(Math.round(c.r / c.n), Math.round(c.g / c.n), Math.round(c.b / c.n)),
      share: +(c.n / n).toFixed(3),
      hex:
        "#" +
        [c.r / c.n, c.g / c.n, c.b / c.n]
          .map((v) => Math.round(v).toString(16).padStart(2, "0"))
          .join(""),
    }));

  // edge density (Sobel on luma)
  const luma = (x, y) => {
    const i = (y * width + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };
  let edges = 0,
    samples = 0;
  const bigStep = Math.max(1, Math.floor(Math.sqrt((width * height) / 20000)));
  for (let y = bigStep; y < height - bigStep; y += bigStep) {
    for (let x = bigStep; x < width - bigStep; x += bigStep) {
      const gx =
        -luma(x - 1, y - 1) - 2 * luma(x - 1, y) - luma(x - 1, y + 1) +
        luma(x + 1, y - 1) + 2 * luma(x + 1, y) + luma(x + 1, y + 1);
      const gy =
        -luma(x - 1, y - 1) - 2 * luma(x, y - 1) - luma(x + 1, y - 1) +
        luma(x - 1, y + 1) + 2 * luma(x, y + 1) + luma(x + 1, y + 1);
      if (Math.hypot(gx, gy) > 90) edges++;
      samples++;
    }
  }
  const edgeDensity = samples ? edges / samples : 0;

  const avgL = sumL / Math.max(1, n);
  const avgS = sumS / Math.max(1, n);
  const contrast = maxL - minL;

  /* ----- derived descriptors ----- */
  const brightness =
    avgL > 0.72 ? "bright, high-key lighting"
    : avgL > 0.55 ? "well-lit, balanced exposure"
    : avgL > 0.38 ? "moody, medium-key lighting"
    : avgL > 0.2 ? "dark, low-key lighting"
    : "very dark, silhouette-heavy";

  const saturation =
    avgS > 0.55 ? "vivid, highly saturated colours"
    : avgS > 0.32 ? "rich, natural saturation"
    : avgS > 0.16 ? "muted, desaturated tones"
    : "monochrome / near-grayscale palette";

  const detail =
    edgeDensity > 0.36 ? "extremely intricate, highly detailed"
    : edgeDensity > 0.2 ? "detailed"
    : edgeDensity > 0.09 ? "moderately detailed"
    : "clean, minimal, smooth surfaces";

  const contrastDesc =
    contrast > 0.75 ? "very high contrast"
    : contrast > 0.5 ? "high contrast"
    : contrast > 0.28 ? "medium contrast"
    : "soft, low contrast";

  const temperature =
    warm > cool * 1.35 ? "warm colour temperature (golden/orange cast)"
    : cool > warm * 1.35 ? "cool colour temperature (blue/cyan cast)"
    : "neutral colour temperature";

  const ratio = width / height;
  const orientation =
    Math.abs(ratio - 1) < 0.06 ? "square composition"
    : ratio > 1.7 ? "ultra-wide cinematic composition"
    : ratio > 1.2 ? "landscape composition"
    : ratio < 0.6 ? "tall vertical portrait composition"
    : "portrait composition";

  const top = palette[0];
  const secondary = palette.slice(1, 4).map((p) => p.name);
  const colourStory = top
    ? `dominant ${top.name} (${top.hex}), accented by ${secondary.join(", ") || "subtle neutrals"}`
    : "balanced colour distribution";

  return {
    width,
    height,
    resolution: `${width}×${height}`,
    megapixels: +((width * height) / 1e6).toFixed(2),
    brightness,
    saturation,
    detail,
    contrast: contrastDesc,
    temperature,
    orientation,
    colourStory,
    palette,
    stats: {
      avgLightness: +avgL.toFixed(3),
      avgSaturation: +avgS.toFixed(3),
      contrast: +contrast.toFixed(3),
      edgeDensity: +edgeDensity.toFixed(3),
      aspectRatio: +ratio.toFixed(3),
    },
  };
}

/* --------------------------- prompt building ------------------------- */
const STYLES = [
  "photorealistic", "cinematic still", "digital painting", "concept art",
  "anime key visual", "3D render", "oil painting", "watercolour illustration",
];

function buildPrompt(a, language = "en") {
  const seed = Math.abs(
    a.resolution.split("").reduce((s, c) => s * 31 + c.charCodeAt(0), 7)
  );
  const style = STYLES[seed % STYLES.length];
  const lens =
    a.stats.aspectRatio > 1.4 ? "35mm wide-angle" :
    a.stats.aspectRatio < 0.8 ? "85mm portrait lens" : "50mm standard lens";

  const subject =
    a.stats.avgLightness < 0.3 ? "silhouetted subject in shadow"
    : a.stats.edgeDensity > 0.3 ? "densely textured subject"
    : "clear central subject";

  const parts = [
    `${style} of a ${subject}`,
    a.orientation,
    a.brightness,
    a.contrast,
    a.temperature,
    a.saturation,
    a.detail,
    a.colourStory,
    `${lens}, shallow depth of field, rule of thirds`,
    "8k uhd, high dynamic range, professional colour grading, masterpiece",
  ];

  let text = parts.join(", ");

  const negatives =
    "(negative: blurry, lowres, jpeg artifacts, watermark, text, signature, extra limbs, deformed, oversaturated, banding)";

  text += " — " + negatives;

  if (language && language !== "en") {
    text += `\n\n[image: ${a.resolution}, ${a.megapixels} MP]`;
  }

  return text;
}

/* ------------------------------- public ------------------------------ */
async function imageToPrompt(base64OrUrl, language = "en") {
  const { PROMPT_AI_URL, PROMPT_AI_KEY, PROMPT_AI_MODEL } = process.env;

  if (PROMPT_AI_URL) {
    try {
      const body = {
        model: PROMPT_AI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert at writing image-generation prompts. " +
              "Reply with ONE dense, comma-separated prompt describing the image. " +
              "No preamble, no markdown, no line breaks.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this image as a generation prompt." },
              {
                type: "image_url",
                image_url: {
                  url: base64OrUrl.startsWith("data:")
                    ? base64OrUrl
                    : "data:image/jpeg;base64," + base64OrUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 400,
      };

      const axios = require("axios");
      const res = await axios.post(
        PROMPT_AI_URL,
        body,
        {
          headers: {
            "Content-Type": "application/json",
            ...(PROMPT_AI_KEY ? { Authorization: `Bearer ${PROMPT_AI_KEY}` } : {}),
          },
          timeout: 60000,
        }
      );
      const prompt =
        res.data &&
        res.data.choices &&
        res.data.choices[0] &&
        res.data.choices[0].message &&
        res.data.choices[0].message.content;
      if (prompt && String(prompt).trim()) {
        return { prompt: String(prompt).trim(), engine: "ai", analysis: null };
      }
    } catch (e) {
      // fall through to the local analyser
    }
  }

  /* ---- local computer-vision engine ---- */
  const src = base64OrUrl.startsWith("data:")
    ? base64OrUrl
    : "data:image/jpeg;base64," + base64OrUrl;

  const img = await loadImage(src);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const analysis = analyse(data, w, h);
  const prompt = buildPrompt(analysis, language);

  return { prompt, engine: "local", analysis };
}

module.exports = { imageToPrompt, analyse, buildPrompt };
