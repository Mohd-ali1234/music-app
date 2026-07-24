const fs = require("fs");
const paths = require("./paths");

/** Append-only log file under userData, for diagnosing launch failures on a
 * non-technical user's machine (the packaged app has no visible console). */
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}`;
  console.log(line);
  try {
    fs.appendFileSync(paths.logFile(), line + "\n");
  } catch {
    // best-effort only
  }
}

module.exports = { log };
