const db = require("./db");
const bot = require("./bot")(db);
require("./dashboard")(bot, db);