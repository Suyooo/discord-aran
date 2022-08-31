const config = require("../../config")

module.exports = (bot, db) => ({
    async textCommand(message, args) {
        let g = await bot.guilds.fetch(config.sifcordGuildId);
        await message.reply("<" + g.iconURL({"format": "gif", "dynamic": true, "size": 256}) + ">");
        await message.reply("<" + g.bannerURL({"format": "png", "dynamic": true, "size": 1024}) + ">");
    }
});