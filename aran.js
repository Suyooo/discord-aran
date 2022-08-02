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
        "hasDb": fs.existsSync("./modules/" + moduleName + "/db.js"),
        "hasBot": fs.existsSync("./modules/" + moduleName + "/bot.js"),
        "hasDashboard": fs.existsSync("./modules/" + moduleName + "/dashboard.js")
    });
}

require("./db")(moduleList.filter(m => m.hasDb)).then((db) => {
    require("./bot")(moduleList.filter(m => m.hasBot), db).then((bot) => {
        require("./dashboard")(moduleList, bot, db);
    });
});