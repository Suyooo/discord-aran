const {ChannelType} = require("discord.js");
let lastCrys = {};

module.exports = (bot) => {
    bot.on("messageCreate", async message => {
        if (message.author.bot) return;
        const content = message.content.toLowerCase();
        if (message.channel.type === ChannelType.DM || message.channel.type === ChannelType.GroupDM ||
            !lastCrys.hasOwnProperty(message.channel.id) || Date.now() > lastCrys[message.channel.id] + 300000) { // 5 minutes
            if (content.indexOf("kasukasu") !== -1 || content.indexOf("ksks") !== -1 || content.indexOf("かすかす") !== -1 || content.indexOf("カスカス") !== -1) {
                message.react("715458505150038066").then(() => {
                    if (message.channel.type !== ChannelType.DM && message.channel.type !== ChannelType.GroupDM) {
                        lastCrys[message.channel.id] = Date.now();
                    }
                }).catch(() => {
                });
            }
        }
    });
    return {};
};