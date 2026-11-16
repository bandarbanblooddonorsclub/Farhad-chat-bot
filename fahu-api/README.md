# 🔌 Fahu API

The service backend for the **MD FARHAD UDDIN** chat bot.

Every API-driven command in the bot (`/4k`, `/pair`, `/kiss`, `/quiz`, `/song`, `/sing`,
`/youtube`, `/anime`, `/prompt`, `/bot` …) talks to **this** server. It replaces the
original dead third-party endpoints with a self-hosted, dependency-light implementation.

Everything runs locally — no API keys, no third-party service, no rate limits.

---

## ⚡ Quick start

```bash
cd fahu-api
npm install
npm start
```

```
  listening   http://0.0.0.0:4040
  registry    http://localhost:4040/API.json
  health      http://localhost:4040/health
  dashboard   http://localhost:4040/
```

Then point the bot at it — edit `config.json` in the project root:

```json
"FAHU_API": "http://127.0.0.1:4040"
```

That single key controls **all** API-driven commands. No other file needs editing.

---

## 📋 Requirements

| Requirement | Required? | Needed for |
|---|---|---|
| **Node.js 18+** | ✅ yes | everything |
| **`@napi-rs/canvas`** | ✅ yes (installed automatically) | avatar banners, 4K upscale, image→prompt |
| **`youtube-dl-exec`** | ✅ yes (installed automatically, bundles yt-dlp) | YouTube search + download, anime clips |
| **`playwright-core`** | ⭕ optional | *better* YouTube search (HTTP scraper is the fallback) |
| **ffmpeg** | ⚠️ strongly recommended | true MP3 audio + merged MP4 video |

### ffmpeg

```bash
# Debian / Ubuntu
sudo apt install -y ffmpeg
# RHEL / Fedora
sudo dnf install -y ffmpeg
# macOS
brew install ffmpeg
# Windows
choco install ffmpeg
# Termux
pkg install ffmpeg
```

> **Without ffmpeg** the API still works, with two limits:
> * audio is delivered in its **native container** (`.m4a`) instead of `.mp3`
> * video downloads and anime clips fall back to a low-res progressive stream
>
> `GET /health` tells you whether ffmpeg is present.

### Optional: YouTube cookies

YouTube throttles datacenter IPs. If downloads fail with "Sign in to confirm you're
not a bot", supply cookies — **pick one**:

```bash
# 1. raw JSON array of cookies (recommended)
export YT_COOKIES='[{"name":"...","value":"...","domain":".youtube.com","path":"/"}]'

# 2. a Netscape-format cookies.txt file
export YT_COOKIES_FILE=/path/to/cookies.txt

# 3. pull straight from your browser
export YT_COOKIES_BROWSER=chrome
```

---

## 🧩 Services & endpoints

Base URL below is written as `$B` (`http://127.0.0.1:4040`).

### Registry

| Method | Path | Returns |
|---|---|---|
| `GET` | `/API.json` | Service registry the bot reads on every command |
| `GET` | `/health` | Health + feature report |
| `GET` | `/` | Web dashboard |

### 💬 Simsimi — `Bot.js`, `Autoreply.js`

| Method | Path | Notes |
|---|---|---|
| `GET` | `/simsimi?text=&senderName=` | → `{response:[…]}`; falls back to a built-in Bengali/English personality |
| `GET` | `/teach?ask=&ans=&senderID=&senderName=&groupID=&groupName=` | learn a reply |
| `GET` | `/list` | → `{code, totalQuestions, totalReplies, author, message}` |
| `GET` | `/delete?ask=&ans=` | remove a pair |
| `GET` | `/edit?ask=&old=&new=` | edit a reply |

Learned data persists in `data/simsimi.json`.

### 🎮 Quiz — `quiz.js`

| Method | Path | Notes |
|---|---|---|
| `GET` | `/quiz` | → `{question,A,B,C,D,sessionID}` |
| `POST` | `/quiz/answer` `{sessionID,answer}` | → `{correct,answer,answerText}` |

70 questions across 12 categories in `data/quiz.json` — edit freely.

### ▶️ YouTube — `song.js`, `sing.js`, `youtube.js`

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/search?q=&limit=` | → `{results:[{videoId,title,author,duration,url,thumbnail}]}` |
| `POST` | `/api/download` `{url, format:"mp3"\|"mp4"}` | → `{job_id}` |
| `GET` | `/api/jobs/:id` | poll → `{status, file_url, title, author, duration}` |

### 🖼️ Avatar Canvas — 16 banner commands

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api` `{cmd, senderID, targetID}` | → raw **PNG** |

Themes: `pair`, `pairing`, `bf`, `gf`, `love`, `love3`, `wife`, `married`, `crush`,
`crush2`, `couple`, `kiss`, `hug`, `bro`, `bestFriend`, `chor`, `rip`, `arrest`.

Avatars are fetched from Facebook's graph endpoint; if unreachable, a deterministic
gradient avatar with initials is generated. Avatars are cached in `public/fallback/`.

### 🎬 Anime video — `anime.js`

| Method | Path | Notes |
|---|---|---|
| `GET` | `/anime` | random cached clip (mp4, supports Range requests) |
| `GET` | `/videos` | list sources + cache |
| `POST` | `/videos/add` `{url}` | add a source and warm the cache |

Sources live in `data/video_sources.json`.

### ✍️ Image → Prompt — `prompt.js`

| Method | Path | Notes |
|---|---|---|
| `POST` | `/prompt` `{image:"data:image/jpeg;base64,…", language:"en"}` | → `{prompt, engine, analysis}` |
| `POST` | `/image-to-prompt` | alias; also accepts a multipart `image` file |

Default **local CV engine** analyses dominant palette, brightness, contrast,
saturation, colour temperature, edge density and composition, then emits a
weighted generation prompt.

To use an AI vision model instead, set:

```bash
PROMPT_AI_URL=https://api.openai.com/v1/chat/completions
PROMPT_AI_KEY=sk-...
PROMPT_AI_MODEL=gpt-4o-mini
```

Any OpenAI-compatible endpoint works. It falls back to the local engine on error.

### 🔍 4K Upscale — `4k.js`

| Method | Path | Notes |
|---|---|---|
| `POST` | `/4k/upscale` `{image, scale}` | → `{file_url,width,height,srcWidth,srcHeight,scale,ms}` |
| `POST` | `/upscale` | alias; also accepts a multipart `image` file |
| `GET` | `/commands/4k.js` | the real command source the bot downloads |

**Real** upscaling: separable **Lanczos3** resampling + unsharp-mask detail recovery.
`scale` 1–8 (default 4). Input capped at 36 MP; output capped at 16384 px.

Verified: `1280×720 → 5120×2880` in ~3.4 s, and the resampler matches a direct-form
Lanczos3 reference to within rounding.

---

## ⚙️ Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4040` | HTTP port |
| `HOST` | `0.0.0.0` | bind address |
| `PUBLIC_BASE_URL` | *(auto from request)* | public base used in `API.json` (set when behind a proxy) |
| `UPSCALE_SCALE` | `4` | default upscale factor |
| `UPSCALE_SHARPNESS` | `0.6` | unsharp amount (0–2) |
| `UPSCALE_FORMAT` | `png` | `png` or `jpeg` |
| `YT_COOKIES` | — | YouTube cookies (JSON array) |
| `YT_COOKIES_FILE` | — | path to Netscape `cookies.txt` |
| `YT_COOKIES_BROWSER` | — | `chrome`, `firefox`, … |
| `YTDLP_PATH` | *(bundled)* | path to a custom yt-dlp binary |
| `FFMPEG_PATH` | *(auto-detect)* | path to ffmpeg |
| `PROMPT_AI_URL` / `PROMPT_AI_KEY` / `PROMPT_AI_MODEL` | — | AI vision prompt engine |

---

## 🚀 Deploying next to the bot

`start-fahu.sh` (project root) boots the API, waits for `/health`, then starts the bot:

```bash
chmod +x start-fahu.sh
./start-fahu.sh
```

With **PM2**:

```bash
pm2 start fahu-api/server.js --name fahu-api
pm2 start fahu.js           --name fahu-bot
pm2 save && pm2 startup
```

Behind **nginx** (`/` proxy for the bot host):

```nginx
location /fahu/ {
    proxy_pass http://127.0.0.1:4040/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 600s;
    client_max_body_size 100m;
}
```

Then set `"FAHU_API": "https://your-domain.com/fahu"` — the API builds `API.json`
from the request host, so no other change is needed.

---

## 🧪 Testing

```bash
# registry
curl http://127.0.0.1:4040/API.json

# health
curl http://127.0.0.1:4040/health

# simsimi
curl "http://127.0.0.1:4040/simsimi?text=hello&senderName=Rahim"

# quiz
curl http://127.0.0.1:4040/quiz

# youtube search
curl "http://127.0.0.1:4040/api/search?q=lofi&limit=5"

# avatar banner
curl -X POST http://127.0.0.1:4040/api \
     -H 'Content-Type: application/json' \
     -d '{"cmd":"kiss","senderID":"100001","targetID":"100002"}' -o kiss.png
```

---

## 📁 Layout

```
fahu-api/
├─ server.js            HTTP server + routes
├─ package.json
├─ commands/4k.js       real 4K command source served to the bot
├─ lib/
│  ├─ canvaslib.js      canvas backend resolver
│  ├─ canvas.js         avatar banner renderer (18 themes)
│  ├─ quiz.js           quiz engine + sessions
│  ├─ simsimi.js        teachable chat engine
│  ├─ ytapi.js          YouTube search + download jobs
│  ├─ video.js          anime clip cache
│  ├─ prompt.js         image → prompt (AI or local CV)
│  ├─ upscale.js        Lanczos3 4K upscaler
│  ├─ ytdlp.js          yt-dlp / ffmpeg resolver
│  └─ store.js          tiny JSON persistence
├─ data/
│  ├─ quiz.json         70 questions
│  ├─ simsimi.json      learned replies
│  └─ video_sources.json
├─ public/files/        generated downloads (auto-cleaned)
└─ public/fallback/     cached avatars
```

---

**𝐌𝐃 𝐅𝐀𝐑𝐇𝐀𝐃 𝐔𝐃𝐃𝐈𝐍 • 𝐅𝐀𝐇𝐔 𝐀𝐏𝐈**
