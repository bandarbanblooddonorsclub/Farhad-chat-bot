#!/usr/bin/env node
/*
 * render-setup.js — generate config.json (and optionally appstate.json)
 * from environment variables. Used on Render (and anywhere else where the
 * real config.json cannot be committed to git).
 *
 * Environment variables (set in the Render dashboard):
 *   FB_EMAIL        Facebook login email          (required if no APPSTATE_JSON)
 *   FB_PASSWORD     Facebook login password       (required if no APPSTATE_JSON)
 *   FB_OTPKEY       2FA secret key                (optional)
 *   FB_UID          your Facebook UID             (for DEVELOPER / ADMINBOT)
 *   BOT_PREFIX      command prefix                (optional, default "/")
 *   APPSTATE_JSON   full appstate.json content    (optional — skips email login)
 *   PORT            Render assigns this automatically
 *
 * If config.json already exists AND no FB_* variables are set, it is kept
 * untouched (local development behaviour).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4040);

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  } catch {
    return null;
  }
}

/* ---------- appstate.json (cookie) ---------- */
if (process.env.APPSTATE_JSON) {
  const raw = process.env.APPSTATE_JSON.trim();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      fs.writeFileSync(path.join(ROOT, "appstate.json"), JSON.stringify(parsed));
      console.log(`[render-setup] appstate.json written (${parsed.length} cookies)`);
    } else {
      console.log("[render-setup] APPSTATE_JSON ignored (not a non-empty array)");
    }
  } catch (e) {
    console.log("[render-setup] APPSTATE_JSON invalid JSON:", e.message);
  }
}

/* ---------- config.json ---------- */
const existing = readJSON("config.json");
const hasEnvConfig =
  process.env.FB_EMAIL || process.env.FB_PASSWORD || process.env.FB_UID;

if (!existing || hasEnvConfig) {
  const cfg = existing || readJSON("config.example.json");
  if (!cfg) {
    console.error("[render-setup] neither config.json nor config.example.json found");
    process.exit(1);
  }

  if (process.env.FB_EMAIL) cfg.EMAIL = process.env.FB_EMAIL;
  if (process.env.FB_PASSWORD) cfg.PASSWORD = process.env.FB_PASSWORD;
  if (process.env.FB_OTPKEY) cfg.OTPKEY = process.env.FB_OTPKEY;
  if (process.env.BOT_PREFIX) cfg.PREFIX = process.env.BOT_PREFIX;

  const uid = process.env.FB_UID;
  if (uid) {
    cfg.DEVELOPER = [uid];
    cfg.ADMINBOT = [uid];
  }

  // The bot talks to the Fahu API over localhost inside the same container.
  cfg.FAHU_API = `http://127.0.0.1:${PORT}`;

  fs.writeFileSync(
    path.join(ROOT, "config.json"),
    JSON.stringify(cfg, null, 2) + "\n"
  );
  console.log("[render-setup] config.json generated from environment");
} else {
  console.log("[render-setup] existing config.json kept");
}

console.log(`[render-setup] API will listen on port ${PORT}`);
