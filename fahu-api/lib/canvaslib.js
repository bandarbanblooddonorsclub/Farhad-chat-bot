/**
 * Canvas backend resolver.
 *
 * `@napi-rs/canvas` ships prebuilt binaries and needs no system libraries,
 * so it is tried first. The classic `canvas` package (cairo/pango) is the
 * fallback for platforms without a prebuilt binary. Both expose
 * createCanvas / loadImage / registerFont, so every fahu-api module can use
 * them interchangeably.
 *
 * A candidate is only accepted after a real render test — a package that is
 * installed but broken (missing native deps) is skipped.
 */
const CANDIDATES = ["@napi-rs/canvas", "canvas"];

function usable(mod) {
  try {
    if (!mod || typeof mod.createCanvas !== "function") return false;
    const cv = mod.createCanvas(8, 8);
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 8, 8);
    const buf = cv.toBuffer("image/png");
    return !!(buf && buf.length > 8);
  } catch (e) {
    return false;
  }
}

let impl = null;
let using = null;
const tried = [];

for (const name of CANDIDATES) {
  let mod = null;
  try {
    mod = require(name);
  } catch (e) {
    tried.push(`${name}: not installed`);
    continue;
  }
  if (usable(mod)) {
    impl = mod;
    using = name;
    tried.push(`${name}: OK`);
    break;
  }
  tried.push(`${name}: installed but not usable`);
}

if (!impl) {
  throw new Error(
    "No working canvas backend found (tried: " + CANDIDATES.join(", ") + ").\n" +
    "Details: " + tried.join(" | ") + "\n\n" +
    "Install one of:\n" +
    "  npm install @napi-rs/canvas     (recommended — prebuilt binaries)\n" +
    "  npm install canvas              (needs cairo/pango system libs)\n" +
    "On Debian/Ubuntu the latter needs: sudo apt install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev"
  );
}

const { createCanvas, loadImage } = impl;
const registerFont =
  typeof impl.registerFont === "function" ? impl.registerFont.bind(impl) : () => {};

module.exports = { createCanvas, loadImage, registerFont, backend: using, tried };
