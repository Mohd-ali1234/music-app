const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { log } = require("./log");
const pm = require("./processManager");

let mainWindow = null;
let quitting = false;

async function boot() {
  try {
    await pm.startBackend();
    await pm.startStaticServer();
  } catch (err) {
    log("Startup failed:", err.message);
    dialog.showErrorBox(
      "Music Player failed to start",
      `A background service didn't start in time:\n\n${err.message}\n\n` +
        "Check desktop.log next to your app data folder for details.",
    );
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#090909",
    icon: path.join(__dirname, "..", "build", "icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(`http://127.0.0.1:${pm.STATIC_PORT}`);
}

app.whenReady().then(boot);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (quitting) return;
  quitting = true;
  pm.stopAll();
});
