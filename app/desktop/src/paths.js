const path = require("path");
const { app } = require("electron");

/**
 * Resolves bundled-resource and user-data paths for both the packaged app
 * (where extraResources land under process.resourcesPath) and a local
 * `electron .` dev run (where they live in ../resources relative to this
 * file, populated by the build scripts before packaging).
 */

function resourcesRoot() {
  return app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, "..", "resources");
}

function backendDir() {
  return path.join(resourcesRoot(), "backend");
}

function backendExe() {
  return path.join(backendDir(), "desktop_main.exe");
}

function frontendDir() {
  return path.join(resourcesRoot(), "frontend");
}

/** MONGODB_URL/MONGODB_DB for your existing MongoDB Atlas cluster, written
 * at build time (see scripts/prepare-backend-env.ps1) from app/backend/.env
 * so the packaged app doesn't need any local database. */
function backendEnvFile() {
  return path.join(resourcesRoot(), "backend-env.json");
}

function userDataDir() {
  return app.getPath("userData");
}

function configFile() {
  return path.join(userDataDir(), "desktop-config.json");
}

function logFile() {
  return path.join(userDataDir(), "desktop.log");
}

module.exports = {
  resourcesRoot,
  backendDir,
  backendExe,
  frontendDir,
  userDataDir,
  backendEnvFile,
  configFile,
  logFile,
};
