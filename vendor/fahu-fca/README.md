# 🚀 FAHU-FCA: Unofficial Facebook Chat API

[![npm](https://img.shields.io/npm/v/fahu-fca)](https://www.npmjs.com/package/fahu-fca) [![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE) [![GitLab](https://img.shields.io/badge/GitLab-fahu--fca-FC6D26?logo=gitlab)](https://gitlab.com/md-farhad-uddin/fahu-fca)

**A lightweight, fast, and unofficial API to interact with Facebook Chat programmatically — ideal for building bots, automation systems, and custom messaging tools.**

**This project is customized and enhanced for improved performance and stability.**

**Customized by [MD FARHAD UDDIN](https://gitlab.com/md-farhad-uddin)**  
**FCA Enhanced by [NeoKEX](https://github.com/lazyneoaz)**

## ✨ Features

- Real-time MQTT message listening and sending
- Automatic MQTT reconnection + resume (session-stable)
- Text, reply, attachments, stickers, mentions, and locations
- Thread, user, reaction, typing, and read-state operations
- **Auto typing indicator** (via `config.json` **or** login/setOptions option)
- **FAHU-FCA connect banner** output
- Session recovery, auto-re-login, adaptive rate-limiting, and request validation
- Clean **Domain architecture** (`messages`, `threads`, `users`, `account`, `realtime`, `http`, `scheduler`)
- CommonJS + TypeScript consumers (built-in `.d.ts` types)
- `OldMessage` fallback for resilient sends

## 📦 Installation

```bash
npm install fahu-fca@latest
```

🚀 Basic Usage

const { login } = require("fahu-fca");

const api = await login({
  appState: require("./appstate.json"),
  listenEvents: true,
  autoReconnect: true,
  autoReLogin: false,
});

console.log("Logged in:", api.getCurrentUserID?.());

api.listenMqtt(async (error, event) => {
  if (error) return console.error(error);
  if (event?.type !== "message" || !event.body) return;

  await api.sendMessage(`Echo: ${event.body}`, event.threadID);
});

«⚠️ Keep "appstate.json" outside your repository.»

📤 Send Message

await api.sendMessage("Hello!", threadID);

// Reply
await api.sendMessage("Replying…", threadID, replyToMessageID);

// Attachment
const fs = require("fs");

await api.sendMessage(
  { body: "Photo", attachment: fs.createReadStream("./photo.jpg") },
  threadID
);

⌨️ Typing Indicator

config.json

{
  "enableTypingIndicator": true,
  "typingDuration": 2500
}

Or during login:

const api = await login({
  appState: require("./appstate.json"),
  enableTypingIndicator: true,
  typingDuration: 2500,
  simulateTyping: false
});

Runtime:

api.setOptions({
  enableTypingIndicator: true,
  typingDuration: 2000
});

Config Priority

"config.json" → "login({...})" / "api.setOptions()"

After editing "config.json":

api.refreshFcaConfig();

«⚠️ Typing indicators require a live MQTT client with event listening active.»

## 🔗 Links

- [npm](https://www.npmjs.com/package/fahu-fca)
- [GitLab](https://gitlab.com/md-farhad-uddin/fahu-fca)
- [Issues](https://gitlab.com/md-farhad-uddin/fahu-fca/-/issues)

## 📄 License

MIT — original source credits are preserved in the source files and license.

## ⚠️ Disclaimer

> Note: This is an unofficial Facebook API. Use at your own risk. This project is not affiliated with or endorsed by Meta / Facebook in any way.

## 🚀 DEVELOPMENT APPROACH

- 💻 **Copy-paste techniques with customizations**
- 🤝 **Collaborative development with friends**
- 🤖 **AI-powered using AI and other advanced tools**

## Thanks for using FCA