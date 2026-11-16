/**
 * Fahu API registry URL.
 * Configure the base in config.json -> "FAHU_API"
 * (GitLab raw URL, or http://<your-server>:4040 when self-hosting).
 */
function FAHU_API_JSON() {
  var base = (global.config && global.config.FAHU_API) ||
    "http://127.0.0.1:4040";
  return String(base).replace(/\/+$/, "") + "/API.json";
}

const axios = require("axios");

module.exports.config = {
  name: "prompt",
  version: "2.0.0",
  hasPermssion: 0,
  credits: "MD FARHAD UDDIN",
  description: "Generate precise prompt from replied image",
  commandCategory: "AI",
  usages: "[reply image] [language]",
  cooldowns: 5,
  usePrefix: true
};

const API_HUB =
  FAHU_API_JSON();

const LANGS = ["en","bn","hi","id","fr","de","ja","ru","pt","ar","ko","it","nl","tr","pl","vi","th"];

async function translate(text, lang) {
  if (lang === "en") return text;
  const url = "https://translate.googleapis.com/translate_a/single";
  const { data } = await axios.get(url, {
    params: { client: "gtx", sl: "en", tl: lang, dt: "t", q: text }
  });
  return data[0].map(e => e[0]).join("");
}

module.exports.run = async function ({ api, event, args }) {
  try {
    if (!event.messageReply?.attachments?.length) {
      return api.sendMessage("Please reply to a photo.....", event.threadID, event.messageID);
    }

    const attachment = event.messageReply.attachments[0];
    if (attachment.type !== "photo") {
      return api.sendMessage("Please reply to a photo.....", event.threadID, event.messageID);
    }

    const language = LANGS.includes(args[0]) ? args[0] : "en";

    const hub = await axios.get(API_HUB);
    const promptURL = hub.data.prompt;
    if (!promptURL) {
      return api.sendMessage("Prompt API missing......", event.threadID, event.messageID);
    }

    const waitMsg = await api.sendMessage("⏳ Generating prompt...", event.threadID);

    const img = await axios.get(attachment.url, { responseType: "arraybuffer" });
    const base64 = Buffer.from(img.data).toString("base64");

    const res = await axios.post(
      promptURL,
      {
        image: "data:image/jpeg;base64," + base64,
        language: "en"
      },
      { timeout: 20000 }
    );

    let output = res.data?.prompt || "No prompt generated.";

    if (language !== "en") {
      output = await translate(output, language);
    }

    if (waitMsg?.messageID) {
      api.unsendMessage(waitMsg.messageID);
    }

    return api.sendMessage(output, event.threadID, event.messageID);

  } catch (err) {
    return api.sendMessage(
      "API Error call Boss MD FARHAD UDDIN 😣: " + err.message,
      event.threadID,
      event.messageID
    );
  }
};
