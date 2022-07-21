const config = require("../../config")

module.exports = (bot) => ({
    async textCommand(message, args) {
        if (args[0] === "images") {
            let g = await bot.guilds.fetch(config.sifcordGuildId);
            await message.reply("<" + g.iconURL({ "format": "gif", "dynamic": true, "size": 256}) + ">");
            await message.reply("<" + g.bannerURL({ "format": "png", "dynamic": true, "size": 2048}) + ">");
        }
    }
});