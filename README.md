<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:001B44,50:0066CC,100:00D9FF&height=200&section=header&text=✦%20MESSENGER%20MIRAI%20CHATBOT%20FOEK%20✦&fontSize=42&fontColor=FFFFFF&fontAlignY=42&animation=fadeIn" width="100%" alt="MESSENGER MIRAI CHATBOT FOEK">

</div>


> ❖ **`আপনার মেসেঞ্জারকে নিয়ে যান আরও এক ধাপ উপরে!
আরও স্মার্ট, সহজ ও আধুনিক Messenger Experience-এর জন্য ব্যবহার করুন MD FARHAD UDDIN CHAT BOT — আপনার মেসেঞ্জারের জন্য একটি Powerful Multi-Device Bot!`**

</div>

<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=22&duration=3000&pause=1000&color=00A8FF&center=true&vCenter=true&width=500&lines=Assalamualaikum+Everyone!;Welcome+To+MD+FARHAD+UDDIN+Fork!" />
</p>

<p align="center">
  <img src="./assets/logo.svg" width="100%" alt="MD FARHAD UDDIN">
</p>

<p align="center" style="font-family: 'Segoe UI', sans-serif; font-weight: bold;">
  <span style="font-size: 32px; font-weight: 700; color:#00A8FF;">
    MD FARHAD UDDIN CHAT BOT
  </span>
  

  <span style="font-size: 22px; font-weight: 700; color:#FF8A00;">
    Developed By MD FARHAD UDDIN
  </span>
</p>

<div align="center">

  <img src="https://komarev.com/ghpvc/?username=bandarbanblooddonorsclub&label=Repo%20Views&color=blueviolet&style=for-the-badge" alt="Fork Views">
  <a href="https://github.com/bandarbanblooddonorsclub/Farhad-chat-bot">
    <img src="https://img.shields.io/badge/REPOSITORY-blueviolet?style=for-the-badge&logo=github&logoColor=white" alt="Repository">
  </a>

</div>



<div align="center">

  <img src="https://img.shields.io/badge/Node.js-20.x-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Messenger-Bot-0084FF?style=flat-square&logo=messenger&logoColor=white" alt="Messenger">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License">

</div>

---

## ❖ DEPLOY WORKFLOWS ❖

> 🚀 **GitHub Actions দিয়ে অটো ডিপ্লয় করার জন্য `.github/workflows/main.yml` ফাইলটি এই YML কোড দিয়ে পরিবর্তন করে নিন।**
```yaml
name: Node.js CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x]
        # See supported Node.js release schedule at https://nodejs.org/en/about/releases/

    steps:
    # Step to check out the repository code
    - uses: actions/checkout@v2

    # Step to set up the specified Node.js version
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v2
      with:
        node-version: ${{ matrix.node-version }}

    # Step to install dependencies
    - name: Install dependencies
      run: npm install

    # Step to run the bot with the correct port
    - name: Start the bot
      env:
        PORT: 8080
      run: npm start
```

---

## 🚀 এই প্রজেক্টটি কীভাবে ব্যবহার করবেন

<p align="center">
  <a href="https://youtu.be/blg0O7IgcrA?si=vpz42AK06uIblLN9">
    <img
      src="./assets/thumbnail.svg"
      width="100%"
      alt="MD FARHAD UDDIN CHAT BOT Full Tutorial"
    />
  </a>
</p>

<p align="center">
  🎬 <b>Thumbnail-এ ক্লিক করে সম্পূর্ণ ভিডিও টিউটোরিয়াল দেখুন</b>
</p>

### 🤖 বট চালানোর ধাপ

**Start Command**  
আপনার বট ফাইলগুলো যেখানে আছে সেই ফোল্ডারে যান:

```bash
node fahu.js
```

> 💡 `npm start` দিলেও একই কাজ হবে (`package.json`-এ `start` → `node fahu.js`)।
> Supervisor/Auto-restart wrapper দিয়ে চালাতে চাইলে: `node fahu-start.js` (বা `npm run supervised`)।

---

## ⚙️ Command System

> 💡 **Prefix ও Aliases দিয়ে আপনার Command System আরও Flexible করুন।**
>
> দুটি ফিচার — **`usePrefix`** (prefix নিয়ম) ও **`aliases`** (একাধিক নাম)।

### 1️⃣ usePrefix

#### 🤔 এটা আসলে কী করে?

বটকে কমান্ড পাঠানোর সময় prefix লাগবে কি না — সেটাই ঠিক করে `usePrefix`।

- **Prefix** = কমান্ডের আগে বসানো চিহ্ন, যেমন `/`। তাই `/help` = prefix সহ, আর `help` = prefix ছাড়া।
- `usePrefix: true` → prefix দিয়েও চলবে, না দিয়েও চলবে।
- `usePrefix: false` → শুধু prefix দিয়েই চলবে।

| সেটিং | `/help` | `help` |
| :--- | :---: | :---: |
| `true` | ✅ | ✅ |
| `false` | ✅ | ❌ |

> 📌 লক্ষ্য করুন: `false` মানে "prefix একদম বন্ধ" নয় — বরং "prefix বাধ্যতামূলক"। দুই ক্ষেত্রেই prefix দিয়ে কাজ করে, পার্থক্য শুধু prefix ছাড়া চলবে কি না।

#### 🌐 Global — config.json এ সেট করলে সব কমান্ডে

`config.json`-এ একবার সেট করলে **পুরো বটের সব কমান্ডে** একই নিয়ম কাজ করবে। প্রতিটি কমান্ড ফাইল আলাদা করে এডিট করতে হবে না।

```json
{
  "usePrefix": true
}
```

👉 এখন যা-ই পাঠান, দুইভাবেই কাজ করবে:

```
/help    ➜  help
/ping    ➜  ping
/song    ➜  song
```

#### 🧩 Per-command — শুধু একটা কমান্ডের জন্য

সব কমান্ডে একই নিয়ম না চাইলে, যে কমান্ডটার জন্য বদলাতে চান শুধু তার ফাইলে `usePrefix` লিখুন।

```js
// prefix + no prefix — দুভাবেই চলবে
module.exports.config = {
  name: "help",
  usePrefix: true
};

// শুধু prefix — prefix ছাড়া লিখলে কিছু হবে না
module.exports.config = {
  name: "restart",
  usePrefix: false
};
```

#### ⚖️ দুইটাই সেট করলে কোনটা মানবে? (Priority)

**কমান্ড ফাইলের সেটিং সবসময় জিতে যাবে।** গ্লোবাল শুধু তখনই কাজ করে, যখন কমান্ড ফাইলে `usePrefix` লেখা নেই।

```
কমান্ড ফাইলে usePrefix আছে?  →  হ্যাঁ ➜ ওটাই মানবে
                              →  না  ➜ config.json এর মান মানবে
```

| `config.json` | কমান্ড ফাইল | ফলাফল |
| :---: | :---: | :--- |
| `true` | লেখা নেই | prefix + no prefix |
| `true` | `false` | শুধু prefix |
| `false` | `true` | prefix + no prefix |
| `false` | লেখা নেই | শুধু prefix |

---

### 2️⃣ Aliases

একটা কমান্ডের অনেকগুলো নাম দিতে `aliases` ব্যবহার করুন:

```js
module.exports.config = {
  name: "help",
  aliases: ["h", "menu", "commands", "cmd"]
};
```

👉 এখন একই কমান্ড চালাবে:

```
/help   /h   /menu   /commands   /cmd
```

- যত খুশি নাম যোগ করা যাবে।
- ছোট alias রাখুন — `h`, `menu`, `cmd`।
- একই alias দুই কমান্ডে দিলে কনফ্লিক্ট হবে।
- `aliases` শুধু নাম বাড়ায় — prefix নিয়ম ঠিক করে `usePrefix`।

---

## 🔥 Features

| ✨ ফিচার | 📝 বিবরণ |
| :--- | :--- |
| 💬 **Auto Chat** | প্রাকৃতিক ভাষা প্রসেসিংয়ের মাধ্যমে স্বয়ংক্রিয় এবং নিরবচ্ছিন্ন কথোপকথন উপভোগ করুন। |
| 🖼️ **Photo Editing** | আমাদের অ্যাডভান্সড কমান্ড ব্যবহার করে পেশাদার মানের ছবি এডিট করুন, অতিরিক্ত অ্যাপের প্রয়োজন নেই। |
| 🎨 **Image Generation** | আমাদের অত্যাধুনিক টেক্সট-টু-ইমেজ প্রযুক্তি ব্যবহার করে অনন্য ছবি তৈরি করুন। |
| 📥 **Video Downloader** | YouTube, Facebook, TikTok এবং অন্যান্য প্ল্যাটফর্ম থেকে HD ভিডিও ডাউনলোড করুন। |
| 🎮 **Interactive Games** | মেসেঞ্জারে সরাসরি গেম এড করে মজার গেম খেলুন, ইনস্টলেশনের ঝামেলা ছাড়াই! |
| 🎉 **Fun Commands** | শত শত মজার কমান্ড দিয়ে আপনার বন্ধুদের চমকে দিন! |

---

## 📦 Installation

```bash
# 1. প্রজেক্ট ডাউনলোড / ক্লোন করুন
git clone -b fahu-api https://github.com/bandarbanblooddonorsclub/Farhad-chat-bot.git
cd Farhad-chat-bot

# 2. Dependencies ইনস্টল করুন
npm install

# 3. Fahu API-এর dependencies ইনস্টল করুন
cd fahu-api && npm install && cd ..

# 4. config তৈরি করুন (টেমপ্লেট থেকে কপি)
cp config.example.json config.json
cp appstate.example.json appstate.json

# 5. config.json ও appstate.json-এ আপনার তথ্য বসান
#    config.json  → DEVELOPER / ADMINBOT-এ আপনার Facebook UID
#    appstate.json → আপনার Facebook cookie (C3C FbState extension দিয়ে পাবেন)

# 6. বট + API একসাথে চালু করুন
./start-fahu.sh
```

> `config.json` ও `appstate.json` `.gitignore`-এ আছে — কখনোই GitHub-এ যাবে না।
> তাই ক্লোন করার পর অবশ্যই উপরের **ধাপ ৪** চালাতে হবে, নাহলে বট চলবে না।

**রান করার ৩টি উপায়:**

```bash
node fahu.js          # ✅ Main entry (recommended)
npm start             # package.json → node fahu.js
node fahu-start.js    # supervisor wrapper (fahu.js-কে spawn করে)
```

> ⚠️ **Node.js:** `package.json`-এ `engines.node = 22.x` দেওয়া আছে। Node 18/20/22 তে চলবে, তবে **Node 20+** রেকমেন্ডেড।

### 📁 Entry Files

| ফাইল | কাজ |
| :--- | :--- |
| `fahu.js` | **Main entry file** — বটের core (loader, commands, events, listen, web server) |
| `fahu-start.js` | Optional supervisor — `fahu.js`-কে child process হিসেবে চালায় ও বন্ধ হয়ে গেলে রিপোর্ট করে |

---

## 👨‍💻 Developer

<div align="center">

| তথ্য | বিবরণ |
| :--- | :--- |
| **Name** | **MD FARHAD UDDIN** |
| **Age** | 18+ |
| **Location** | BANGLADESH |
| **Role** | STUDENT • DEVELOPER |

</div>

**About:**

> 💻 আমি কোনো প্রফেশনাল প্রোগ্রামার নই।  
> আমি প্রোগ্রামিং করতে ভালো লাগে, তাই বন্ধুদের কাছ থেকে হেল্প নিয়ে এবং AI Tools-এর সহায়তায়  
> বিভিন্ন রকমের Project, Chatbot ও নতুন নতুন Technology Develop করতে পছন্দ করি।

**Interests:**

- 🤖 Chatbot Development
- 💻 Programming
- 🌐 Web Development
- 🧠 AI & Technology
- 🛠️ Open Source Projects

**📞 Contact**

<p>
  <b>Facebook</b>    
  <a href="https://facebook.com/61595699687916">
    <img src="https://img.shields.io/badge/CLICK%20NOW-1877F2?style=for-the-badge&logo=facebook&logoColor=white" width="150" alt="Facebook">
  </a>
</p>

<p>
  <b>Messenger</b>  
  <a href="https://m.me/61595699687916">
    <img src="https://img.shields.io/badge/MESSAGE%20ME-0084FF?style=for-the-badge&logo=messenger&logoColor=white" width="150" alt="Messenger">
  </a>
</p>

<p>
  <b>WhatsApp</b>    
  <a href="https://wa.me/8801621451063">
    <img src="https://img.shields.io/badge/CHAT%20NOW-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" width="150" alt="WhatsApp">
  </a>
</p>

> ✅ **সেট:** Facebook `61595699687916` · WhatsApp `+8801621451063` — নিজের তথ্য বদলাতে চাইলে উপরের লিংকগুলো এডিট করুন।

---

## ❖ সাপোর্ট

আপনার কোনো সাহায্যের প্রয়োজন হলে, আপনি অ্যাডমিনের সাথে যোগাযোগ করতে পারেন।  
বিশেষ প্রয়োজন ছাড়া অনুগ্রহ করে অ্যাডমিনকে ডিস্টার্ব করবেন না। ধন্যবাদ!

<p align="center">
  <a href="https://wa.me/8801621451063?text=Assalamualaikum%20Admin%20MD%20FARHAD%20UDDIN%20Need%20Help%20Please%20Brother%20🫶">
    <img alt="WhatsApp" src="https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white">
  </a>
  <a href="https://m.me/61595699687916">
    <img alt="Messenger" src="https://img.shields.io/badge/Messenger-00B2FF?style=for-the-badge&logo=messenger&logoColor=white">
  </a>
</p>

### 🤝 Support Community

আপনার সাধারণ সাহায্য, আলোচনা ও আপডেটের জন্য আমাদের Support Box-গুলোতে Join করুন।

<p align="center">
  <a href="https://t.me/YOUR_TELEGRAM_GROUP">
    <img alt="Telegram Support" src="https://img.shields.io/badge/Telegram%20Support-Join%20Now-26A5E4?style=for-the-badge&logo=telegram&logoColor=white">
  </a>
  


  <a href="https://m.me/j/AbZDGjBnHV0-K5sD/?send_source=gc%3Acopy_invite_link_t">
    <img alt="Messenger Support" src="https://img.shields.io/badge/Messenger%20Support-Join%20Now-0084FF?style=for-the-badge&logo=messenger&logoColor=white">
  </a>
</p>

> 💡 যেকোনো সাধারণ সমস্যা বা সাহায্যের জন্য আগে Support Box-গুলোতে Join করে প্রশ্ন করতে পারেন।

---

### ✨🌟 Special Thanks 🌟✨

- 🚀 **Cyber Bot Team**
- 🧙‍♂️ **Ullash** — Owner, Cyber Bot Team
- 🛡️ **Sujon** — Admin, Cyber Bot Team
- 🎓 **Grandpa EJ** — Owner, Grandpa Academy

### 🙏 Credits

এই প্রজেক্টটি একটি open-source Mirai-based Messenger Chat Bot-এর Rebranded Fork।  
মূল প্রকল্পের MIT লাইসেন্স (`LICENSE` ফাইল) অপরিবর্তিত রেখে শুধুমাত্র নাম, ব্র্যান্ডিং ও Entry File পরিবর্তন করা হয়েছে।
---

<div align="center">

💖 **𝗠𝗗 𝗙𝗔𝗥𝗛𝗔𝗗 𝗨𝗗𝗗𝗜𝗡 𝗖𝗛𝗔𝗧 𝗕𝗢𝗧** বেছে নেওয়ার জন্য ধন্যবাদ!

🗓️ **Original Release Date: 11/08/2025 at 02:00**  
🗓️ **Rebranded: 16/11/2026**

⭐ ফর্ক করার পর একটি স্টার দিতে ভুলবেন না! এটি সত্যিই সাহায্য করে!



<p align="center">
  <a href="https://github.com/bandarbanblooddonorsclub">
    <img src="https://cdn.simpleicons.org/github/181717" width="48" alt="GitHub">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;

  <a href="https://t.me/YOUR_TELEGRAM_USERNAME">
    <img src="https://cdn.simpleicons.org/telegram/26A5E4" width="48" alt="Telegram">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;

  <a href="https://m.me/j/AbZDGjBnHV0-K5sD/?send_source=gc%3Acopy_invite_link_t">
    <img src="https://cdn.simpleicons.org/messenger/0084FF" width="48" alt="Messenger Group">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;

  <a href="https://youtube.com/@YOUR_YOUTUBE_HANDLE">
    <img src="https://cdn.simpleicons.org/youtube/FF0000" width="48" alt="YouTube">
  </a>
</p>



*আমি আশা করি আপনি আমার ফর্কটি উপভোগ করবেন! CHAT BOT কমিউনিটি সমর্থন করার জন্য আপনাকে অসংখ্য ধন্যবাদ!*

</div>
