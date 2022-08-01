const {ChannelType} = require("discord.js");

const lastCryTimeByChannel = {};
const lastCryTimeByUser = {};
const CHANNEL_COOLDOWN = 3600000; // 1 hour
const USER_COOLDOWN = 21600000; // 6 hours

module.exports = (bot, db) => {
    bot.on("messageCreate", async message => {
        if (message.author.bot) return;
        const content = message.content.toLowerCase();
        if (message.channel.type === ChannelType.DM || message.channel.type === ChannelType.GroupDM ||
            ((!lastCryTimeByChannel.hasOwnProperty(message.channel.id) || Date.now() > lastCryTimeByChannel[message.channel.id] + CHANNEL_COOLDOWN) &&
                (!lastCryTimeByUser.hasOwnProperty(message.author.id) || Date.now() > lastCryTimeByUser[message.author.id] + USER_COOLDOWN))) {
            if (content.indexOf("kasukasu") !== -1 || content.indexOf("ksks") !== -1 || content.indexOf("かすかす") !== -1 || content.indexOf("カスカス") !== -1) {
                message.react("715458505150038066").then(() => {
                    if (message.channel.type !== ChannelType.DM && message.channel.type !== ChannelType.GroupDM) {
                        lastCryTimeByChannel[message.channel.id] = lastCryTimeByUser[message.author.id] = Date.now();
                    }
                }).catch(() => {
                });
            }
        }
    });
    return {};
};