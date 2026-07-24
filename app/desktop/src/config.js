const fs = require("fs");
const crypto = require("crypto");
const paths = require("./paths");

/**
 * A signing secret for backend JWTs, generated once on first launch and
 * reused on every subsequent launch so user sessions survive app restarts.
 * Not a user-facing credential (that's the Gemini key, owned entirely by the
 * backend via the OS keyring) — just an internal token-signing key, so a
 * plain per-user file under userData is adequate.
 */
function getOrCreateJwtSecret() {
  const file = paths.configFile();
  if (fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      const data = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
      if (data.jwtSecret) return data.jwtSecret;
    } catch {
      // fall through and regenerate
    }
  }
  const jwtSecret = crypto.randomBytes(48).toString("hex");
  fs.mkdirSync(paths.userDataDir(), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ jwtSecret }, null, 2));
  return jwtSecret;
}

module.exports = { getOrCreateJwtSecret };
