const log = require("../../logger");
const emoji = require("emoji-name-map");
const {ButtonStyle, ButtonBuilder, EmbedBuilder, ActionRowBuilder} = require("discord.js");

module.exports = (bot, db) => ({
    async button(interaction, args) {
        let button;
        try {
            button = await db.modules.rolebuttons.Button.findByPk(parseInt(args[1]), {
                attributes: ["role_id","messageId"],
                include: {
                    model: db.modules.rolebuttons.Message,
                    as: "message",
                    attributes: ["groupId"],
                    include: {
                        model: db.modules.rolebuttons.Group,
                        as: "group",
                        attributes: ["require_role_ids"]
                    }
                }
            });
        } catch (error) {
            log.error("ROLEBUTTONS", "Failed to get role info from button interaction: " + error + "\n" + error.stack);
            await interaction.reply({
                content: "This seems to be an invalid role button. Please let Staff know!",
                ephemeral: true
            })
                .catch(error2 => {
                    log.error("ROLEBUTTONS", "Also failed to send a failure notice to the user: " + error2 + "\n" + error2.stack);
                });
            return;
        }

        if (button.message.group.require_role_ids) {
            let allowed = false;
            for (const reqid of button.message.group.require_role_ids.split(",")) {
                if (interaction.member.roles.cache.has(reqid.trim())) {
                    allowed = true;
                    break;
                }
            }
            if (!allowed) {
                await interaction.reply({
                    content: "You are not allowed to use these role buttons.",
                    ephemeral: true
                })
                    .catch(error => {
                        log.error("ROLEBUTTONS", "Failed to tell user they can't use a role button: " + error + "\n" + error.stack);
                    });
                return;
            }
        }

        let rid = button.role_id;
        let has = interaction.member.roles.cache.has(rid);
        let roleChangePromise, action;
        try {
            if (has) {
                log.info("ROLEBUTTONS", interaction.member.user.tag + " removing role " + rid);
                await interaction.member.roles.remove(rid, "Remove requested via Role Buttons");
                action = "Removed";
            } else {
                log.info("ROLEBUTTONS", interaction.member.user.tag + " adding role " + rid);
                await interaction.member.roles.add(rid, "Add requested via Role Buttons");
                action = "Added";
            }
        } catch (error) {
            log.error("ROLEBUTTONS", "Failed to get role info from button interaction: " + error + "\n" + error.stack);
            await interaction.reply({
                content: "Something went wrong while updating your roles. Please let Staff know!",
                ephemeral: true
            })
                .catch(error2 => {
                    log.error("ROLEBUTTONS", "Also failed to send a failure notice to the user: " + error2 + "\n" + error2.stack);
                });
            return;
        }

        await interaction.reply({content: action + " the <@&" + rid + "> role!", ephemeral: true})
            .catch(error => {
                log.error("ROLEBUTTONS", "Failed to tell user about role change: " + error + "\n" + error.stack);
            });
    },
    async deleteAllMessages(group_id) {
        log.debug("ROLEBUTTONS", "Deleting all posts for group " + group_id);
        let group;
        try {
            group = await db.modules.rolebuttons.Group.findByPk(group_id, {
                attributes: ["channel_id"],
                include: {
                    model: db.modules.rolebuttons.Message,
                    as: "messages",
                    attributes: ["posted_msg_id"]
                }
            })
        } catch (error) {
            log.error("ROLEBUTTONS", "Failed to get group info: " + error + "\n" + error.stack);
            return;
        }

        const channel = await bot.channels.fetch(group.channel_id);
        await Promise.all(group.messages.map(message =>
            (message.posted_msg_id)
                ? channel.messages.fetch(message.posted_msg_id)
                    .then(postMsg => postMsg.delete())
                    .catch(() => null) // ignore - might already have been deleted manually
                : null));
    },
    async postGroup(group_id, deleteMessages) {
        let group;
        try {
            group = await db.modules.rolebuttons.Group.findByPk(group_id, {
                attributes: ["channel_id"],
                include: {
                    model: db.modules.rolebuttons.Message,
                    as: "messages",
                    attributes: ["title", "description", "color", "posted_msg_id"],
                    include: {
                        model: db.modules.rolebuttons.Button,
                        as: "buttons",
                        attributes: ["id", "label", "emoji", "display_row"]
                    }
                }
            })
        } catch (error) {
            log.error("ROLEBUTTONS", "Failed to get group info: " + error + "\n" + error.stack);
            return;
        }

        const channel = await bot.channels.fetch(group.channel_id);
        for (const message of group.messages) {
            let postMsg;

            if (message.posted_msg_id) {
                postMsg = await channel.messages.fetch(message.posted_msg_id).catch(() => undefined);
                if (postMsg && deleteMessages) {
                    postMsg.delete().catch(() => { });
                    postMsg = undefined;
                }
            }

            if (!deleteMessages && !postMsg) {
                // An update was requested, but this message was deleted or was never posted. Nothing to do.
                return;
            }

            let rows = [];
            for (const button of message.buttons) {
                while (rows.length <= button.display_row) {
                    rows.push(new ActionRowBuilder());
                }
                let b = new ButtonBuilder()
                    .setCustomId("rolebuttons-" + button.id)
                    .setStyle(ButtonStyle.Secondary);
                if (button.label) b.setLabel(button.label);
                if (button.emoji) b.setEmoji(button.emoji.indexOf(":") === -1 ? emoji.get(button.emoji) : button.emoji);
                rows[button.display_row].addComponents(b);
            }

            let embed = new EmbedBuilder();
            if (message.title) {
                embed.setTitle(message.title);
                if (message.description) embed.setDescription(message.description);
                if (message.color) embed.setColor("#" + message.color);
            } else {
                embed.setTitle("temp embed, will be removed momentarily");
            }

            if (postMsg) {
                await postMsg.edit({
                    embeds: [embed],
                    components: rows
                }).then(msg => {
                    msg.suppressEmbeds(message.title === null);
                });
            } else {
                await channel.send({
                    embeds: [embed],
                    components: rows
                }).then(msg => {
                    msg.suppressEmbeds(message.title === null);
                    message.posted_msg_id = msg.id;
                    message.save();
                });
            }
        }
    }
});