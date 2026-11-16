/**
 * Fahu API — tiny JSON file store
 * Thread-safe enough for a single-process bot helper API.
 */
const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function read(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function write(file, value) {
  ensureDir(path.dirname(file));
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
  return value;
}

/** mutate + persist */
function update(file, fallback, mutator) {
  const data = read(file, fallback);
  const out = mutator(data);
  write(file, out === undefined ? data : out);
  return out === undefined ? data : out;
}

module.exports = { ensureDir, read, write, update };
