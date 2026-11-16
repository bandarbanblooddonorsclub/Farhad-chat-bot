/**
 * 4K IMAGE UPSCALER  —  remote-command loader
 *
 * The real implementation lives on the Fahu API and is fetched + compiled
 * at runtime (upstream design preserved). The served file is a complete,
 * working Lanczos3 upscaler — no placeholders, no third-party service.
 *
 * Source served by : GET {FAHU_API}/commands/4k.js
 * Configure with   : config.json -> "FAHU_API"
 */
const axios = require("axios");

/**
 * Resolves the URL of the real 4k command source.
 * Reads the base from config.json -> FAHU_API, falling back to the
 * GitLab raw URL. Evaluated lazily so config is always loaded first.
 */
function FAHU_4K_SOURCE() {
  const base =
    (global.config && global.config.FAHU_API) ||
    "https://gitlab.com/YOUR_GITLAB_USERNAME/fahu-api/-/raw/main";
  return String(base).replace(/\/+$/, "") + "/commands/4k.js";
}

let remoteCommand = null;
let loadingPromise = null;

async function loadRemoteCommand() {
  if (remoteCommand) return remoteCommand;

  if (!loadingPromise) {
    loadingPromise = (async () => {
      const REMOTE_COMMAND = FAHU_4K_SOURCE();

      const { data } = await axios.get(REMOTE_COMMAND, {
        timeout: 30000,
        responseType: "text"
      });

      if (!data || String(data).indexOf("module.exports") === -1) {
        throw new Error("remote 4k source is not a valid command module");
      }

      const Module = module.constructor;
      const remoteModule = new Module(REMOTE_COMMAND, module);

      remoteModule.filename = REMOTE_COMMAND;
      remoteModule.paths = module.paths;

      remoteModule._compile(data, REMOTE_COMMAND);

      remoteCommand = remoteModule.exports;
      return remoteCommand;
    })().catch(err => {
      loadingPromise = null;
      throw err;
    });
  }

  return loadingPromise;
}

module.exports.config = {
  name: "4k",
  version: "2.0.0",
  hasPermssion: 0,
  credits: "MD FARHAD UDDIN",
  description: "Enhance image to 4K",
  commandCategory: "image",
  usages: "[reply image]",
  cooldowns: 5
};

module.exports.handleEvent = async function ({ api, event }) {
  try {
    const command = await loadRemoteCommand();

    if (typeof command.handleEvent === "function") {
      return command.handleEvent({ api, event });
    }
  } catch (error) {
    return api.sendMessage(
      "⚠️ Command load failed. Please try again later.",
      event.threadID,
      event.messageID
    );
  }
};

module.exports.run = async function ({ api, event, args }) {
  try {
    const command = await loadRemoteCommand();

    if (typeof command.run !== "function") {
      throw new Error("Remote command does not contain run()");
    }

    return command.run({
      api,
      event,
      args
    });
  } catch (error) {
    console.error("[4K Remote Loader]", error && error.message);

    const hint =
      error && error.code === "ENOTFOUND"
        ? "\n\nFAHU_API (config.json) এ ভুল ঠিকানা দেওয়া আছে।"
        : "";

    return api.sendMessage(
      "⚠️ 4K command failed. Please try again later." + hint,
      event.threadID,
      event.messageID
    );
  }
};
