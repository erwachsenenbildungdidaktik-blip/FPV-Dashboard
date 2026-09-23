// Playwright aus dem Projekt oder global installiert.
let pw;
try {
  pw = require("playwright");
} catch (e) {
  pw = require(require("child_process").execSync("npm root -g").toString().trim() + "/playwright");
}
module.exports = pw;
