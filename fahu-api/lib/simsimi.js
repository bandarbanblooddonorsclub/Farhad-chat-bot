/**
 * Fahu API — Simsimi (teach / learn chatbot) service
 *
 * Contract used by Script/commands/Bot.js and Autoreply.js :
 *   GET /simsimi?text=<q>&senderName=<name>   -> { response: string | string[] }
 *   GET /teach?ask=&ans=&senderID=&senderName=&groupID=&groupName= -> { message }
 *   GET /list                                 -> { code:200, totalQuestions, totalReplies, author, message }
 *   GET /delete?ask=&ans=                     -> { message }
 *   GET /edit?ask=&old=&new=                  -> { message }
 */
const path = require("path");
const { read, write } = require("./store");

const DATA_FILE = path.join(__dirname, "..", "data", "simsimi.json");
const AUTHOR = "MD FARHAD UDDIN";

function load() {
  const d = read(DATA_FILE, { pairs: [] });
  if (!d || !Array.isArray(d.pairs)) return { pairs: [] };
  return d;
}
function save(d) {
  write(DATA_FILE, d);
  return d;
}

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[\u09e6-\u09ef]/g, (c) =>
      String(c.charCodeAt(0) - 0x09e6)
    ) // bn digits -> ascii
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

function findPairs(ask) {
  const d = load();
  const key = norm(ask);
  if (!key) return [];
  const exact = d.pairs.filter((p) => norm(p.ask) === key);
  if (exact.length) return exact;
  return d.pairs.filter((p) => {
    const k = norm(p.ask);
    return k && (key.includes(k) || k.includes(key));
  });
}

/* ---------- fallback brain (used when nothing was taught) ---------- */
const GREET = /(hi|hello|hey|hola|salam|assalamualaikum|আসসালামু|হ্যালো|হাই|নমস্কার|kemon|কেমন)/i;
const HOW_ARE_YOU = /(how are you|kemon acho|কেমন আছো|কেমন আছ|তুমি কেমন)/i;
const WHO_ARE_YOU = /(who are you|tumake|তোমার নাম|তুমি কে|who r u|your name)/i;
const LOVE = /(i love you|love you|ভালোবাসি|ভালবাসি)/i;
const BYE = /(bye|goodbye|khoda hafez|বিদায়|চলি|জ্বাই)/i;
const THANKS = /(thanks|thank you|dhonnobad|ধন্যবাদ)/i;
const OWNER = /(owner|malik|বস|developer|who made you|কে বানালো|creator)/i;

function brain(text, senderName) {
  const t = String(text || "");
  const name = senderName || "তুমি";

  if (GREET.test(t))
    return `হ্যালো ${name}! 😊 কেমন আছো? আমি 𝐌𝐃 𝐅𝐀𝐑𝐇𝐀𝐃 𝐔𝐃𝐃𝐈𝐍 চ্যাট বট — কথা বলো!`;
  if (HOW_ARE_YOU.test(t))
    return `আমি অনেক ভালো আছি ${name} 😄 তুমি কেমন আছো?`;
  if (WHO_ARE_YOU.test(t))
    return `আমি 𝐌𝐃 𝐅𝐀𝐑𝐇𝐀𝐃 𝐔𝐃𝐃𝐈𝐍 𝐂𝐇𝐀𝐓 𝐁𝐎𝐓 🤖 — তৈরি করেছেন MD FARHAD UDDIN`;
  if (OWNER.test(t))
    return `আমার বস হলেন MD FARHAD UDDIN 👑`;
  if (LOVE.test(t))
    return `আহা ${name} 🥰 আমিও তোমাকে ভালোবাসি!`;
  if (THANKS.test(t)) return `ধন্যবাদ ${name} 🌸 যেকোনো সময়!`;
  if (BYE.test(t)) return `আচ্ছা ${name}, খোদা হাফেজ! 👋 আবার কথা হবে।`;
  if (t.endsWith("?")) return `ভালো প্রশ্ন ${name} 🤔 কিন্তু আমি এখনো শিখিনি — "teach ${t} - উত্তর" লিখে শিখিয়ে দাও!`;

  const bank = [
    `${name}, বুঝলাম! আরও বলো 😄`,
    `হুম্মম 🤔 এটা নিয়ে আমার এখনো কিছু শেখা হয়নি।`,
    `আমি এখনো শিখছি ${name} — "teach প্রশ্ন - উত্তর" দিয়ে আমাকে শিখিয়ে দাও! 💡`,
    `মজার কথা ${name}! 😉`
  ];
  return bank[Math.floor(Math.random() * bank.length)];
}

/* ------------------------------- API ------------------------------- */
function chat(text, senderName) {
  const pairs = findPairs(text);
  if (pairs.length) {
    const p = pairs[Math.floor(Math.random() * pairs.length)];
    const reply = String(p.ans || "").replace(/\{name\}/gi, senderName || "তুমি");
    return { response: [reply], source: "taught" };
  }
  return { response: [brain(text, senderName)], source: "brain" };
}

function teach({ ask, ans, senderID, senderName, groupID, groupName }) {
  if (!ask || !ans) return { message: "⚠️ Use: teach [Question] - [Reply]" };
  const d = load();
  const exists = d.pairs.some(
    (p) => norm(p.ask) === norm(ask) && norm(p.ans) === norm(ans)
  );
  if (exists) return { message: "ℹ️ এই প্রশ্ন-উত্তর আগেই শিখেছি! 😊" };

  d.pairs.push({
    ask: String(ask),
    ans: String(ans),
    senderID: senderID || "",
    senderName: senderName || "",
    groupID: groupID || "",
    groupName: groupName || "",
    ts: Date.now()
  });
  save(d);
  return { message: `✅ শিখে নিলাম!\n❓ ${ask}\n💬 ${ans}\n\n— 𝐌𝐃 𝐅𝐀𝐑𝐇𝐀𝐃 𝐔𝐃𝐃𝐈𝐍 𝐂𝐇𝐀𝐓 𝐁𝐎𝐓` };
}

function list() {
  const d = load();
  const questions = new Set(d.pairs.map((p) => norm(p.ask))).size;
  return {
    code: 200,
    totalQuestions: questions,
    totalReplies: d.pairs.length,
    author: AUTHOR,
    message: `♾ Total Questions Learned: ${questions}\n★ Total Replies Stored: ${d.pairs.length}\nDeveloper: ${AUTHOR}`
  };
}

function remove(ask, ans) {
  if (!ask || !ans) return { message: "⚠️ Use: remove [Question] - [Reply]" };
  const d = load();
  const before = d.pairs.length;
  d.pairs = d.pairs.filter(
    (p) => !(norm(p.ask) === norm(ask) && norm(p.ans) === norm(ans))
  );
  save(d);
  if (d.pairs.length === before)
    return { message: "❌ এই প্রশ্ন-উত্তর খুঁজে পাইনি!" };
  return { message: "🗑️ মুছে ফেলেছি!" };
}

function edit(ask, oldReply, newReply) {
  if (!ask || !oldReply || !newReply)
    return { message: "⚠️ Use: edit [Question] - [Old] - [New]" };
  const d = load();
  let hit = false;
  d.pairs = d.pairs.map((p) => {
    if (norm(p.ask) === norm(ask) && norm(p.ans) === norm(oldReply)) {
      hit = true;
      return { ...p, ans: String(newReply), ts: Date.now() };
    }
    return p;
  });
  save(d);
  if (!hit) return { message: "❌ এই প্রশ্ন-উত্তর খুঁজে পাইনি!" };
  return { message: "✏️ আপডেট করা হয়েছে!" };
}

module.exports = { chat, teach, list, remove, edit };
