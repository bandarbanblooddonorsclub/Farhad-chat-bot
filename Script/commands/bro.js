/**
 * Fahu API registry URL.
 * Configure the base in config.json -> "FAHU_API"
 * (GitLab raw URL, or http://<your-server>:4040 when self-hosting).
 */
function FAHU_API_JSON() {
  var base = (global.config && global.config.FAHU_API) ||
    "https://gitlab.com/YOUR_GITLAB_USERNAME/fahu-api/-/raw/main";
  return String(base).replace(/\/+$/, "") + "/API.json";
}

module.exports.config = {
  name: "bro",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "MD FARHAD UDDIN",
  description: "Generate a couple banner image using sender and target Facebook UID via Avatar Canvas API",
  commandCategory: "banner",
  usePrefix: true,
  usages: "[@mention | reply]",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": "",
    "path": ""
  }
};

module.exports.run = async function ({ event, api }) {
  const axios = require("axios");
  const fs = require("fs-extra");
  const path = require("path");

  const { threadID, messageID, senderID, mentions, messageReply } = event;

  let targetID = null;

  if (mentions && Object.keys(mentions).length > 0) {
    targetID = Object.keys(mentions)[0];
  } else if (messageReply && messageReply.senderID) {
    targetID = messageReply.senderID;
  }

  if (!targetID) {
    return api.sendMessage(
      "Please reply or mention someone......",
      threadID,
      messageID
    );
  }

  try {
    const apiList = await axios.get(
      FAHU_API_JSON()
    );

    const AVATAR_CANVAS_API = apiList.data.AvatarCanvas;

    const res = await axios.post(
      `${AVATAR_CANVAS_API}/api`,
      {
        cmd: "bro",
        senderID,
        targetID
      },
      { responseType: "arraybuffer", timeout: 30000 }
    );

    const imgPath = path.join(
      __dirname,
      "cache",
      `bro_${senderID}_${targetID}.png`
    );

    fs.writeFileSync(imgPath, res.data);

    return api.sendMessage(
      {
        body: `🌸 𝐓𝐞𝐫𝐚 𝐁𝐚𝐢 🌸
        
🤝 ভাই–ব্রাদারের বন্ধন চিরকাল অটুট থাকুক 💖
🫱এই নে, রাখ তোর ভাইরে ❤️  

👑 𝐁𝐑𝐎𝐓𝐇𝐄𝐑 𝐅𝐎𝐑𝐄𝐕𝐄𝐑 🩷🌸`,
        attachment: fs.createReadStream(imgPath)
      },
      threadID,
      () => fs.unlinkSync(imgPath),
      messageID
    );

  } catch (e) {
    return api.sendMessage(
      "API Error Call Boss MD FARHAD UDDIN",
      threadID,
      messageID
    );
  }
};
