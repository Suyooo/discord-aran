const log = require("../../logger");
const config = require("../../config");
const auth = require("../../auth");

module.exports = (bot) => ({
    async textCommand(message, args) {
        if (args[0] === "restart") {
            if (await auth.checkStaff(bot, message.author.id)) {
                log.info("RESTART", "Restart requested");
                await message.reply("Restarting...");
                process.exit(0);
            }
        }
    }
});