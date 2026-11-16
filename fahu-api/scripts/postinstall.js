#!/usr/bin/env node
/**
 * fahu-api postinstall — prints setup guidance and verifies optional tools.
 * Never fails the install.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dirs = [
  "data/videos",
  "public/files",
  "public/fallback",
];

for (const d of dirs) {
  try {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  } catch (e) {
    /* ignore */
  }
}

// make sure data files exist
const seeds = {
  "data/simsimi.json": { pairs: [] },
  "data/video_sources.json": [
    "https://www.youtube.com/hashtag/anime",
  ],
};
for (const [file, def] of Object.entries(seeds)) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(def, null, 2), "utf8");
  }
}

const lines = [];
lines.push("");
lines.push("  ╭──────────────────────────────────────────────╮");
lines.push("  │   FAHU API  —  installed                     │");
lines.push("  ╰──────────────────────────────────────────────╯");
lines.push("");
lines.push("  Start it:    cd fahu-api && npm start");
lines.push("  Health:      http://localhost:4040/health");
lines.push("  Registry:    http://localhost:4040/API.json");
lines.push("");
lines.push("  Optional (unlocks extra features):");
lines.push("   • PLAYWRIGHT_BROWSERS_PATH / npx playwright install chromium");
lines.push("       -> better YouTube search (headless browser)");
lines.push("   • YT_COOKIES (JSON array) or YT_COOKIES_FILE=path");
lines.push("       -> age-restricted / bot-checked YouTube downloads");
lines.push("   • PROMPT_AI_URL + PROMPT_AI_KEY + PROMPT_AI_MODEL");
lines.push("       -> AI vision image-to-prompt (local CV engine is the default)");
lines.push("");
console.log(lines.join("\n"));
