const configsecret = require("./config.secret.json");
const configlocal = require("./config.local.json");

if (!configlocal.dashboardRootPath) {
    configlocal.dashboardRootPath = "";
}
if (!configlocal.dashboardFullPath) {
    configlocal.dashboardFullPath = "";
}

module.exports = {
    SIFCORD: "207972536393138177",
    ...configsecret, ...configlocal
};