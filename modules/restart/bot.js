const log = require("../../logger");
const config = require("../../config");

module.exports = (bot, db) => ({
    async textCommand(message, args) {
        if (await bot.auth.checkStaff(message.author.id)) {
            log.info("RESTART", "Restart requested");
            await message.reply("Restarting...");
            process.exit(0);
        }
    }
});