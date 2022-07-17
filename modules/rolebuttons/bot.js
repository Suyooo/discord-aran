const log = require("../../logger");
const db = require('./db');
const emoji = require("emoji-name-map");
const {MessageActionRow, MessageButton, MessageEmbed} = require("discord.js");

module.exports = (bot) => ({
    async button(interaction) {
        let bid = interaction.customId.split("-")[1];
        let button = db.buttons_get(bid);
        let message = db.messages_get(button.message_id);
        let group = db.groups_get(message.group_id);
        if (group.require_role_ids) {
            let allowed = false;
            for (const reqid of group.require_role_ids.split(",")) {
                if (interaction.member.roles.cache.has(reqid.trim())) {
                    allowed = true;
                    break;
                }
            }
            if (!allowed) {
                await interaction.reply({content: "You are not allowed to use these role buttons.", ephemeral: true});
                return;
            }
        }

        let rid = button.role_id;
        let has = interaction.member.roles.cache.has(rid);
        if (has) {
            log.info("ROLEBUTTONS", interaction.member.user.tag + " removing role " + rid);
            await interaction.member.roles.remove(rid, "Remove requested via Role Buttons");
            await interaction.reply({content: "You removed the <@&" + rid + "> role!", ephemeral: true});
        } else {
            log.info("ROLEBUTTONS", interaction.member.user.tag + " adding role " + rid);
            await interaction.member.roles.add(rid, "Add requested via Role Buttons");
            await interaction.reply({content: "You added the <@&" + rid + "> role!", ephemeral: true});
        }
    },
    async deleteAllMessages(group_id) {
        let group = db.groups_get(group_id);
        await bot.guilds.fetch(group.guild_id).then(guild => guild.channels.fetch(group.channel_id)).then(channel => {
            const p = []
            for (let message of db.messages_list(group_id)) {
                if (message.posted_msg_id) {
                    p.push(channel.messages.fetch(message.posted_msg_id).then(postMsg => postMsg ? postMsg.delete() : 0));
                }
            }
            return Promise.all(p);
        }).catch(() => null);
    },
    async postGroup(group_id, deleteMessages) {
        let group = db.groups_get(group_id);
        bot.guilds.fetch(group.guild_id).then(guild => {
            guild.channels.fetch(group.channel_id).then(async function (channel) {
                for (let message of db.messages_list(group.id)) {
                    let postMsg = undefined;
                    let msgFunc = channel.send.bind(channel);
                    if (message.posted_msg_id) {
                        postMsg = await channel.messages.fetch(message.posted_msg_id).catch(() => undefined);
                        if (postMsg) {
                            if (deleteMessages) {
                                postMsg.delete().catch(() => {
                                });
                            } else {
                                msgFunc = postMsg.edit.bind(postMsg);
                            }
                        }
                    }
                    if (!deleteMessages && postMsg === undefined) {
                        // Only updating messages, but this message was deleted or was never posted
                        return;
                    }

                    let rows = [];
                    db.buttons_list(message.id).forEach(button => {
                        while (rows.length <= button.display_row) {
                            rows.push(new MessageActionRow());
                        }
                        let b = new MessageButton()
                            .setCustomId("vendor-" + button.id)
                            .setStyle('SECONDARY');
                        if (button.label) b.setLabel(button.label);
                        if (button.emoji) b.setEmoji(button.emoji.indexOf(":") === -1 ? emoji.get(button.emoji) : button.emoji);
                        rows[button.display_row].addComponents(b);
                    });

                    let embed = new MessageEmbed();
                    if (message.title) {
                        embed.setTitle(message.title);
                        if (message.description) embed.setDescription(message.description);
                        if (message.color) embed.setColor("#" + message.color);
                    } else {
                        embed.setTitle("Temp Embed");
                    }

                    await msgFunc({
                        embeds: [embed],
                        components: rows
                    }).then(msg => {
                        msg.suppressEmbeds(message.title === null);
                        message.posted_msg_id = msg.id;
                        db.messages_update(message);
                    });
                }
            });
        });
    }
});