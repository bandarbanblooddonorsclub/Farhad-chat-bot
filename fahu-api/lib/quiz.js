/**
 * Fahu API — Quiz service
 * Contract used by Script/commands/quiz.js :
 *   GET  /quiz                     -> { question, A, B, C, D, sessionID }
 *   POST /quiz/answer {sessionID, answer} -> { correct, answer }
 */
const path = require("path");
const { read } = require("./store");

const BANK_FILE = path.join(__dirname, "..", "data", "quiz.json");

/* sessionID -> { answer, letter, expires } */
const sessions = new Map();
const SESSION_TTL = 10 * 60 * 1000; // 10 min

function randomId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 12)
  ).toUpperCase();
}

function pickQuestion() {
  const bank = read(BANK_FILE, []);
  if (!Array.isArray(bank) || !bank.length) return null;
  return bank[Math.floor(Math.random() * bank.length)];
}

function newQuiz() {
  const q = pickQuestion();
  if (!q) return null;

  const options = q.options.slice(0, 4);
  const correctIndex = Number.isInteger(q.answer) ? q.answer : 0;
  const letters = ["A", "B", "C", "D"];
  const correctLetter = letters[correctIndex];

  const sessionID = randomId();
  sessions.set(sessionID, {
    answer: correctLetter,
    text: options[correctIndex],
    expires: Date.now() + SESSION_TTL,
  });

  // sweep expired
  for (const [k, v] of sessions) if (v.expires < Date.now()) sessions.delete(k);

  return {
    question: q.q,
    A: options[0],
    B: options[1],
    C: options[2],
    D: options[3],
    category: q.category || "general",
    sessionID,
  };
}

function answerQuiz(sessionID, answer) {
  const s = sessions.get(String(sessionID || "").trim());
  if (!s) return null;

  const given = String(answer || "").trim().toUpperCase();
  const correct = given === s.answer;

  // one shot: consume the session
  sessions.delete(sessionID);

  return {
    correct,
    answer: s.answer,
    answerText: s.text,
    given: given || null,
  };
}

module.exports = { newQuiz, answerQuiz, sessions };
