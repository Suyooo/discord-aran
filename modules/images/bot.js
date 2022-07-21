const config = require("../../config")

module.exports = (bot) => ({
    async textCommand(message, args) {
        if (args[0] === "images") {
            let g = await bot.guilds.fetch(config.sifcordGuildId);
            await message.reply({
                content: "<" + g.iconURL({"format": "gif", "dynamic": true, "size": 256}) + ">",
                allowedMentions: {repliedUser: false}
            });
            await message.reply({
                content: "<" + g.bannerURL({"format": "png", "dynamic": true, "size": 1024}) + ">",
                allowedMentions: {repliedUser: false}
            });
        }
    }
});