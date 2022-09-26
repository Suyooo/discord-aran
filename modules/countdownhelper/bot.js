const {ChannelType} = require("discord.js");
const log = require("../../logger");

const lastCryTimeByChannel = {};
const lastCryTimeByUser = {};
const CHANNEL_COOLDOWN = 3600000; // 1 hour
const USER_COOLDOWN = 21600000; // 6 hours

module.exports = (bot, db) => {
    bot.on("messageCreate", async message => {
        if (message.author.bot) return;
        if (message.reference) return;
        if (message.channelId !== "690089810685198437") return;
        if (!message.content.startsWith("$countdown ")) return;
        if (message.content.indexOf("237457651250757632") !== -1) return;
        message.channel.send(message.content + " <@237457651250757632>").catch(e => {
            log.error("COUNTDOWNHELPER", "Unable to send countdown message in reply to" + message.id + ": " + e + "\n" + e.stack);
        });
    });
    return {};
};