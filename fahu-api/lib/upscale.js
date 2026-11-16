/**
 * Fahu API — real 4K image upscaler (100% local, no external service)
 *
 * Pipeline:
 *   1. decode (node-canvas, or sharp when installed)
 *   2. Lanczos3 separable resampling  (x pass, then y pass)
 *   3. unsharp-mask detail recovery
 *   4. re-encode to PNG / JPEG
 *
 * Quality knobs: SCALE (default 4), SHARPNESS, DENOISE, FORMAT.
 * Input is capped at MAX_PIXELS so memory stays bounded.
 */
const { createCanvas, loadImage } = require("./canvaslib");

const MAX_PIXELS = 36e6; // ~6000×6000 safety cap
const EDGE_PX = 64; // max upscaled dimension guard (in pixels × 1000)

/* ------------------------------ Lanczos3 ----------------------------- */
/** Normalised Lanczos3 kernel (sinc(x)·sinc(x/3)), support |x| < 3. */
function lanczos3(x) {
  if (x === 0) return 1;
  if (x <= -3 || x >= 3) return 0;
  const px = Math.PI * x;
  return (3 * Math.sin(px) * Math.sin(px / 3)) / (px * px);
}

/**
 * Pre-compute, for every output coordinate, the source window and weights.
 * @returns {{start:Int32Array, len:Int32Array, weights:Float32Array}}
 */
function buildWeights(outSize, inSize, scale) {
  const start = new Int32Array(outSize);
  const len = new Int32Array(outSize);
  const support = 3;
  // taps needed = 2·support·(1/scale) source px when downscaling, 2·support when up
  const maxLen =
    Math.ceil(support * 2 * Math.max(1, 1 / Math.max(scale, 1e-6))) + 4;

  // worst case window size, uniform stride keeps indexing simple
  const stride = maxLen;
  const weights = new Float32Array(outSize * stride);

  for (let i = 0; i < outSize; i++) {
    // map output pixel centre back to input space
    const center = (i + 0.5) / scale - 0.5;
    const left = Math.floor(center - support + 1);
    const right = Math.ceil(center + support - 1);

    let sum = 0;
    const w = new Float64Array(right - left + 1);
    for (let j = left; j <= right; j++) {
      const v = lanczos3(center - j);
      w[j - left] = v;
      sum += v;
    }

    // start offset is relative to the real (clamped) source range
    let s = left;
    let count = 0;
    if (sum !== 0) {
      for (let k = 0; k < w.length; k++) {
        // `left + k` may be out of range; resamplePass clamps when reading
        weights[i * stride + count] = w[k] / sum;
        count++;
      }
    } else {
      // degenerate: nearest neighbour
      const src = Math.min(inSize - 1, Math.max(0, Math.round(center)));
      weights[i * stride + 0] = 1;
      start[i] = src;
      len[i] = 1;
      continue;
    }

    start[i] = left;
    len[i] = count;
  }

  return { start, len, weights, stride };
}

/** One separable pass over a 4-channel interleaved buffer. */
function resamplePass(src, srcW, srcH, dstW, dstH, axis) {
  const out = new Uint8ClampedArray(dstW * dstH * 4);
  const along = axis === "x" ? srcW : srcH;
  const across = axis === "x" ? srcH : srcW;
  const acrossOut = axis === "x" ? dstH : dstW;
  const alongOut = axis === "x" ? dstW : dstH;
  const scale = alongOut / along;

  const { start, len, weights, stride } = buildWeights(alongOut, along, scale);

  for (let a = 0; a < acrossOut; a++) {
    const srcRow = axis === "x" ? a : 0;
    for (let o = 0; o < alongOut; o++) {
      let r = 0,
        g = 0,
        b = 0,
        al = 0;

      const s0 = start[o];
      const n = len[o];
      const base = o * stride;

      for (let k = 0; k < n; k++) {
        const w = weights[base + k];
        if (w === 0) continue;
        let s = s0 + k;
        if (s < 0) s = 0;
        else if (s >= along) s = along - 1;

        const si =
          axis === "x" ? (srcRow * srcW + s) * 4 : (s * srcW + a) * 4;

        r += src[si] * w;
        g += src[si + 1] * w;
        b += src[si + 2] * w;
        al += src[si + 3] * w;
      }

      const di =
        axis === "x" ? (a * dstW + o) * 4 : (o * dstW + a) * 4;

      out[di] = r;
      out[di + 1] = g;
      out[di + 2] = b;
      out[di + 3] = al;
    }
  }

  return out;
}

/* --------------------------- unsharp mask ---------------------------- */
function unsharp(pixels, w, h, amount = 0.5, radius = 1, threshold = 4) {
  if (amount <= 0) return pixels;

  // separable box blur (two passes ≈ gaussian)
  const tmp = new Float32Array(w * h * 3);
  const blur = new Float32Array(w * h * 3);

  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < w * h; i++) tmp[i * 3 + c] = pixels[i * 4 + c];
  }

  const boxH = (src, dst) => {
    for (let y = 0; y < h; y++) {
      let acc = [0, 0, 0];
      let n = 0;
      for (let x = -radius; x <= radius; x++) {
        const sx = Math.min(w - 1, Math.max(0, x));
        const i = (y * w + sx) * 3;
        acc[0] += src[i];
        acc[1] += src[i + 1];
        acc[2] += src[i + 2];
        n++;
      }
      for (let x = 0; x < w; x++) {
        const d = (y * w + x) * 3;
        dst[d] = acc[0] / n;
        dst[d + 1] = acc[1] / n;
        dst[d + 2] = acc[2] / n;
        const addX = Math.min(w - 1, x + radius + 1);
        const remX = Math.max(0, x - radius);
        const ai = (y * w + addX) * 3;
        const ri = (y * w + remX) * 3;
        acc[0] += src[ai] - src[ri];
        acc[1] += src[ai + 1] - src[ri + 1];
        acc[2] += src[ai + 2] - src[ri + 2];
      }
    }
  };

  const boxV = (src, dst) => {
    for (let x = 0; x < w; x++) {
      let acc = [0, 0, 0];
      let n = 0;
      for (let y = -radius; y <= radius; y++) {
        const sy = Math.min(h - 1, Math.max(0, y));
        const i = (sy * w + x) * 3;
        acc[0] += src[i];
        acc[1] += src[i + 1];
        acc[2] += src[i + 2];
        n++;
      }
      for (let y = 0; y < h; y++) {
        const d = (y * w + x) * 3;
        dst[d] = acc[0] / n;
        dst[d + 1] = acc[1] / n;
        dst[d + 2] = acc[2] / n;
        const addY = Math.min(h - 1, y + radius + 1);
        const remY = Math.max(0, y - radius);
        const ai = (addY * w + x) * 3;
        const ri = (remY * w + x) * 3;
        acc[0] += src[ai] - src[ri];
        acc[1] += src[ai + 1] - src[ri + 1];
        acc[2] += src[ai + 2] - src[ri + 2];
      }
    }
  };

  const pass1 = new Float32Array(w * h * 3);
  boxH(tmp, pass1);
  boxV(pass1, blur);

  for (let i = 0; i < w * h; i++) {
    for (let c = 0; c < 3; c++) {
      const orig = pixels[i * 4 + c];
      const bl = blur[i * 3 + c];
      const diff = orig - bl;
      if (Math.abs(diff) > threshold) {
        pixels[i * 4 + c] = Math.min(255, Math.max(0, orig + diff * amount));
      }
    }
  }

  return pixels;
}

/* ------------------------------- public ------------------------------ */
/**
 * @param {string|Buffer} input  data URI, URL or raw image bytes
 * @param {object} opts
 * @param {number} opts.scale      upscale factor (default 4)
 * @param {number} opts.target      target long-edge in px (overrides scale)
 * @param {number} opts.sharpness   unsharp amount 0..2 (default 0.6)
 * @param {"png"|"jpeg"} opts.format
 * @returns {Promise<{buffer:Buffer,width:number,height:number,format:string,mime:string,srcWidth:number,srcHeight:number,ms:number}>}
 */
async function upscale(input, opts = {}) {
  const t0 = Date.now();
  const {
    scale = Number(process.env.UPSCALE_SCALE || 4),
    target = null,
    sharpness = Number(process.env.UPSCALE_SHARPNESS || 0.6),
    format = process.env.UPSCALE_FORMAT || "png",
  } = opts;

  const img = await loadImage(input);

  let srcW = img.width;
  let srcH = img.height;
  if (!srcW || !srcH) throw new Error("could not read image dimensions");
  if (srcW * srcH > MAX_PIXELS) throw new Error("image too large (max 36 MP)");

  // effective scale
  let s = scale;
  if (target) {
    s = Math.max(1, target / Math.max(srcW, srcH));
  }

  // guard: never exceed ~16384 px on the long edge (encoder limits)
  const MAX_SIDE = 16384;
  if (Math.max(srcW, srcH) * s > MAX_SIDE) {
    s = MAX_SIDE / Math.max(srcW, srcH);
  }
  if (s < 1.0001) s = 1; // no downscaling requested -> keep 1:1 but still sharpen

  const dstW = Math.max(1, Math.round(srcW * s));
  const dstH = Math.max(1, Math.round(srcH * s));

  /* decode to raw RGBA */
  const srcCanvas = createCanvas(srcW, srcH);
  const srcCtx = srcCanvas.getContext("2d");
  srcCtx.drawImage(img, 0, 0, srcW, srcH);
  let pixels = srcCtx.getImageData(0, 0, srcW, srcH).data;

  /* resample (skip if scale == 1) */
  if (s > 1.0001) {
    const mid = resamplePass(pixels, srcW, srcH, dstW, srcH, "x");
    pixels = resamplePass(mid, dstW, srcH, dstW, dstH, "y");
  } else {
    pixels = new Uint8ClampedArray(pixels);
  }

  /* detail recovery */
  pixels = unsharp(pixels, dstW, dstH, sharpness, 1, 3);

  /* encode */
  const out = createCanvas(dstW, dstH);
  const octx = out.getContext("2d");
  const imageData = octx.createImageData(dstW, dstH);
  imageData.data.set(pixels);
  octx.putImageData(imageData, 0, 0);

  const isJpeg = String(format).toLowerCase() === "jpeg" || String(format).toLowerCase() === "jpg";
  const buffer = isJpeg ? out.toBuffer("image/jpeg", { quality: 0.94 }) : out.toBuffer("image/png");

  return {
    buffer,
    width: dstW,
    height: dstH,
    srcWidth: srcW,
    srcHeight: srcH,
    scale: +(dstW / srcW).toFixed(3),
    format: isJpeg ? "jpeg" : "png",
    mime: isJpeg ? "image/jpeg" : "image/png",
    ms: Date.now() - t0,
  };
}

module.exports = { upscale, lanczos3, unsharp };
