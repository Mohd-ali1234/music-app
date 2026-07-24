// Converts the existing app icon (app/frontend/assets/images/icon.png) into
// the .ico electron-builder/NSIS needs, so the desktop app reuses existing
// branding instead of new art. Run via `node scripts/make-icon.js`.
const fs = require("fs");
const path = require("path");
const pngToIco = require("png-to-ico");

const source = path.join(
  __dirname,
  "..",
  "..",
  "frontend",
  "assets",
  "images",
  "icon.png",
);
const dest = path.join(__dirname, "..", "build", "icon.ico");

pngToIco(source)
  .then((buf) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    console.log("Wrote", dest);
  })
  .catch((err) => {
    console.error("Failed to generate icon.ico:", err);
    process.exit(1);
  });
