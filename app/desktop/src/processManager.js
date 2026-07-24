const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const treeKill = require("tree-kill");
const paths = require("./paths");
const { log } = require("./log");
const { getOrCreateJwtSecret } = require("./config");

const BACKEND_PORT = 8000;
const STATIC_PORT = 43110;

const children = [];

/** Some tools (notably Windows PowerShell 5.1's `-Encoding utf8`) always
 * write a UTF-8 BOM, which JSON.parse doesn't tolerate. */
function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function trackChild(proc, name) {
  children.push({ proc, name });
  proc.stdout?.on("data", (d) => log(`[${name}]`, d.toString().trim()));
  proc.stderr?.on("data", (d) => log(`[${name}]`, d.toString().trim()));
  proc.on("exit", (code) => log(`[${name}] exited with code`, String(code)));
  return proc;
}

function waitForPort(port, host, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host, port, path: "/", timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
        } else {
          setTimeout(attempt, 500);
        }
      });
      req.on("timeout", () => req.destroy());
    };
    attempt();
  });
}

/** Reads the MongoDB Atlas connection info written at build time (see
 * scripts/prepare-backend-env.ps1) from your local app/backend/.env. */
function readBackendEnv() {
  const file = paths.backendEnvFile();
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing ${file}. Run scripts/prepare-backend-env.ps1 (part of ` +
        "build-all.ps1) before packaging so the app knows which MongoDB " +
        "Atlas cluster to use.",
    );
  }
  const data = JSON.parse(stripBom(fs.readFileSync(file, "utf8")));
  if (!data.MONGODB_URL) {
    throw new Error(`${file} is missing MONGODB_URL.`);
  }
  return data;
}

function startBackend() {
  const jwtSecret = getOrCreateJwtSecret();
  const { MONGODB_URL, MONGODB_DB } = readBackendEnv();
  log("Starting backend on port", String(BACKEND_PORT));
  const proc = spawn(paths.backendExe(), [], {
    cwd: paths.backendDir(),
    env: {
      ...process.env,
      APP_ENV: "production",
      MONGODB_URL,
      MONGODB_DB: MONGODB_DB || "music_player",
      JWT_SECRET: jwtSecret,
      CORS_ORIGINS: `http://127.0.0.1:${STATIC_PORT}`,
      AI_PROVIDER: "gemini",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  trackChild(proc, "backend");
  return waitForPort(BACKEND_PORT, "127.0.0.1", 30000);
}

function startStaticServer() {
  const serveHandler = require("serve-handler");
  const frontendDir = paths.frontendDir();
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // Expo Router's static export is a client-side-routed SPA: unknown
      // paths must fall back to index.html rather than 404.
      serveHandler(req, res, {
        public: frontendDir,
        rewrites: [{ source: "**", destination: "/index.html" }],
      });
    });
    server.listen(STATIC_PORT, "127.0.0.1", () => {
      log("Static frontend server listening on", String(STATIC_PORT));
      resolve(server);
    });
    server.on("error", reject);
  });
}

function stopAll() {
  for (const { proc, name } of children) {
    if (proc.pid) {
      log("Stopping", name);
      treeKill(proc.pid);
    }
  }
}

module.exports = {
  BACKEND_PORT,
  STATIC_PORT,
  startBackend,
  startStaticServer,
  stopAll,
};
