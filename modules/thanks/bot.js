const {ChannelType} = require("discord.js");
const log = require("../../logger");

const TEXT = ["You're welcome", "No problem", "No, thank YOU"];
const EMOJI = ["<:Yousoro:715479194888437811>", "<:ChikaThumbsUp:823272752277356595>", "<:AyuLanzhuGlomp:915207268629352481>"];

module.exports = (bot, db) => {
    bot.on("messageCreate", async message => {
        if (message.author.bot) return;
        const c = message.content.toLowerCase();
        if (!(c.startsWith("thanks aran") || c.startsWith("thank you aran"))) return;
        const a = Math.floor(Math.random() * 3);
        const b = Math.floor(Math.random() * 3);
        message.reply({
            content: TEXT[a] + " " + message.author.toString() + " " + EMOJI[b],
            allowedMentions: {parse: [], repliedUser: false}
        });
    });
    return {};
};