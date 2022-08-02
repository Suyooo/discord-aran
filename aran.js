const fs = require("fs");
const config = require("./config");
const log = require("./logger");

const moduleList = [];
for (const moduleName of fs.readdirSync("./modules")) {
    if (config.hasOwnProperty("moduleWhitelist") && config.moduleWhitelist.indexOf(moduleName) === -1) {
        log.info("ARAN", "Module " + moduleName + " not whitelisted, skipping");
        continue;
    }
    const moduleInfo = require("./modules/" + moduleName + "/info");
    moduleList.push({
        "name": moduleName,
        "info": moduleInfo,
        "has_db": fs.existsSync("./modules/" + moduleName + "/db.js"),
        "has_bot": fs.existsSync("./modules/" + moduleName + "/bot.js"),
        "has_dashboard": fs.existsSync("./modules/" + moduleName + "/dashboard.js")
    });
}

const db = require("./db")(moduleList.filter(m => m.has_db));
const bot = require("./bot")(moduleList.filter(m => m.has_bot), db);
require("./dashboard")(moduleList.filter(m => m.has_dashboard), bot, db);