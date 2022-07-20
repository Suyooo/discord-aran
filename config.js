const configsecret = require("./config.secret.json");
const configglobal = require("./config.global.json");
const configlocal = require("./config.local.json");

if (!configlocal.dashboardRootPath) {
    configlocal.dashboardRootPath = "";
}
if (!configlocal.dashboardDomain) {
    configlocal.dashboardDomain = "";
}

module.exports = {
    ...configsecret, ...configglobal, ...configlocal
};