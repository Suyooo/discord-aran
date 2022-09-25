const {ChannelType, EmbedBuilder} = require("discord.js");
const config = require("../../config");
const log = require("../../logger");
const diff = new (require("text-diff"))();

const REPORT_CHANNEL_ID = "208474259583008768";

// https://stackoverflow.com/a/39543625
function escapeMarkdown(text) {
    return text.replace(/\\([*_|`~\\])/g, '$1').replace(/([*_|`~\\])/g, '\\$1');
}

module.exports = (bot, db) => {
    bot.on("messageDelete", async message => {
        if (message.author.bot) return;
        if (message.guildId !== config.sifcordGuildId) return;

        const e = new EmbedBuilder()
            .setColor("#FF0000")
            .setTitle("Deleted")
            .setURL((await message.channel.messages.fetch({before: message.id, limit: 1}))?.first()?.url)
            .setDescription(message.content)
            .addFields(
                {
                    name: "Author",
                    value: message.author.tag + " " + message.author.toString(),
                    inline: true
                },
                {
                    name: "Channel",
                    value: message.channel.toString(),
                    inline: true
                },
                {
                    name: "Posted at",
                    value: "<t:" + Math.floor(message.createdTimestamp / 1000) + ":f>",
                    inline: true
                }
            );
        if (message.attachments.some(a => !a.contentType.startsWith("image/"))) {
            e.addFields({
                name: "Unrecoverable Attachments",
                value: message.attachments.filter(a => !a.contentType.startsWith("image/"))
                    .map((a, i) => a.name || "(unnamed " + a.contentType + " attachment)").join(", "),
                inline: false
            });
        }

        const ch = bot.channels.resolve(REPORT_CHANNEL_ID);
        ch.send({
            embeds: [e],
            files: message.attachments ? message.attachments.filter(a => a.contentType.startsWith("image/")).map((a, i) => ({
                attachment: a.proxyURL,
                name: a.name || ("attachment" + i)
            })) : undefined,
            allowedMentions: {parse: [], repliedUser: false}
        }).catch(e => {
            ch.send({
                embeds: [e],
                allowedMentions: {parse: [], repliedUser: false}
            }).then(() => {
                if (message.attachments) {
                    ch.send("Failed to upload the following images from the deleted message:\n"
                        + message.attachments.filter(a => a.contentType.startsWith("image/")).map((a, i) => a.proxyURL).join("\n"))
                        .catch(e => {
                            log.error("MESSAGEWATCH", "Failed to send images message for message #" + message.id + ": " + e + "\n" + e.stack);
                        });
                }
            }).catch(e => {
                log.error("MESSAGEWATCH", "Failed to send deletion message for message #" + message.id + ": " + e + "\n" + e.stack);
            });
        });
    });
    bot.on("messageUpdate", async (oldMessage, newMessage) => {
        if (oldMessage.author.bot) return;
        if (oldMessage.guildId !== config.sifcordGuildId) return;
        if (oldMessage.content === newMessage.content) return;

        const d = diff.main(escapeMarkdown(oldMessage.content), escapeMarkdown(newMessage.content));
        let diffedMessage = "";
        diff.cleanupSemantic(d);
        for (const dd of d) {
            const format = dd[0] === -1 ? "~~" : (dd[0] === 1 ? "__" : "");
            diffedMessage += format + dd[1] + format;
        }
        // For some reason ~~a~~__b__ will only display the underline but break the strikethrough
        // So insert a zero width space (the other way around it's perfectly fine without the zero width space???)
        diffedMessage = diffedMessage.replace(/~_/g, "~​_");

        bot.channels.resolve(REPORT_CHANNEL_ID).send({
            embeds: [
                new EmbedBuilder()
                    .setColor("#FFFF00")
                    .setTitle("Edited")
                    .setURL(newMessage.url)
                    .setDescription(diffedMessage.length > 4096 ? diffedMessage.substring(0, 4093) + "..." : diffedMessage)
                    .addFields(
                        {
                            name: "Author",
                            value: oldMessage.author.tag + " " + oldMessage.author.toString(),
                            inline: true
                        },
                        {
                            name: "Channel",
                            value: oldMessage.channel.toString(),
                            inline: true
                        },
                        {
                            name: "Posted at",
                            value: "<t:" + Math.floor(oldMessage.createdTimestamp / 1000) + ":f>",
                            inline: true
                        }
                    )
            ],
            allowedMentions: {parse: [], repliedUser: false}
        }).catch(e => {
            log.error("MESSAGEWATCH", "Failed to send editing message for message #" + newMessage.id + ": " + e + "\n" + e.stack);
        });
    });
    return {};
};