const configsecret = require("./config.secret.json");
const configlocal = require("./config.local.json");

module.exports = {
    SIFCORD: "207972536393138177",
    ...configsecret, ...configlocal
};