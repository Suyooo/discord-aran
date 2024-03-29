const log = require("../../logger");
const emoji = require("emoji-name-map");
const {ButtonStyle, ButtonBuilder, EmbedBuilder, ActionRowBuilder} = require("discord.js");

module.exports = (bot, db) => ({
    async button(interaction, args) {
        log.debug("ROLEBUTTONS", "Got interaction for button " + parseInt(args[1]));
        let button;
        try {
            button = await db.modules.rolebuttons.Button.findByPk(parseInt(args[1]), {
                attributes: ["role_id", "messageId"],
                include: {
                    model: db.modules.rolebuttons.Message,
                    as: "message",
                    attributes: ["groupId"],
                    include: {
                        model: db.modules.rolebuttons.Group,
                        as: "group",
                        attributes: ["require_role_ids", "send_reply"]
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
        log.debug("ROLEBUTTONS", "Got info from DB (for role " + button.role_id + ")");

        if (button.message.group.require_role_ids) {
            log.debug("ROLEBUTTONS", "Checking for requirement role");
            let allowed = false;
            const splitreq = button.message.group.require_role_ids.split(",").map(r => r.trim());
            for (const reqid of splitreq) {
                if (interaction.member.roles.cache.has(reqid)) {
                    allowed = true;
                    break;
                }
            }
            if (!allowed) {
                log.debug("ROLEBUTTONS", "Aborted for missing requirement role");
                await interaction.reply({
                    content: splitreq.length === 1
                        ? "You must have the <@&" + splitreq[0] + "> role to use these buttons."
                        : "You must have one of these roles to use these buttons: " + splitreq.map(r => "<@&" + r + ">").join(", "),
                    ephemeral: true
                })
                    .catch(error => {
                        log.error("ROLEBUTTONS", "Failed to tell user they can't use a role button: " + error + "\n" + error.stack);
                    });
                return;
            }
        }

        let rid = button.role_id;
        log.debug("ROLEBUTTONS", "Now updating role " + interaction.guild.roles.resolve(rid).name);
        let has = (await interaction.member.fetch(true)).roles.cache.has(rid);
        log.debug("ROLEBUTTONS", "User does" + (has ? "" : "n't") + " have the role");
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

        if (button.message.group.send_reply === true) {
            await interaction.reply({content: action + " the <@&" + rid + "> role!", ephemeral: true})
                .catch(error => {
                    log.error("ROLEBUTTONS", "Failed to tell user about role change: " + error + "\n" + error.stack);
                });
        } else {
            await Promise.all([
                interaction.user.send({content: action + " the **" + (await interaction.guild.roles.resolve(rid)).name + "** role!"})
                    .catch(error => {
                        log.error("ROLEBUTTONS", "Failed to tell user about role change: " + error + "\n" + error.stack);
                    }),
                interaction.update({})
                    .catch(error => {
                        log.error("ROLEBUTTONS", "Failed to acknowledge interaction: " + error + "\n" + error.stack);
                    })
            ]);
        }
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
                    attributes: ["id", "title", "description", "color", "posted_msg_id"],
                    include: {
                        model: db.modules.rolebuttons.Button,
                        as: "buttons",
                        attributes: ["id", "label", "emoji", "display_row"]
                    }
                },
                order: [
                    [
                        {model: db.modules.rolebuttons.Message, as: "messages"},
                        'display_order'
                    ],
                    [
                        {model: db.modules.rolebuttons.Message, as: "messages"},
                        {model: db.modules.rolebuttons.Button, as: "buttons"},
                        'display_order'
                    ]
                ]
            })
        } catch (error) {
            log.error("ROLEBUTTONS", "Failed to get group info: " + error + "\n" + error.stack);
            throw error;
        }

        const channel = await bot.channels.fetch(group.channel_id);
        for (const message of group.messages) {
            let postMsg;

            if (message.posted_msg_id) {
                postMsg = await channel.messages.fetch(message.posted_msg_id).catch(() => undefined);
                if (postMsg && deleteMessages) {
                    postMsg.delete().catch(() => {
                    });
                    postMsg = undefined;
                }
            }

            if (!deleteMessages && !postMsg) {
                // An update was requested, but this message was deleted or was never posted. Nothing to do.
                continue;
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
                })
                    .then(msg => {
                        msg.suppressEmbeds(message.title === null);
                    })
                    .catch(error => {
                        log.error("ROLEBUTTONS", "Failed to update button message: " + error + "\n" + error.stack);
                        throw error;
                    });
            } else {
                await channel.send({
                    embeds: [embed],
                    components: rows
                })
                    .then(msg => {
                        msg.suppressEmbeds(message.title === null);
                        message.posted_msg_id = msg.id;
                        return message.save();
                    })
                    .catch(error => {
                        log.error("ROLEBUTTONS", "Failed to post button message: " + error + "\n" + error.stack);
                        throw error;
                    });
            }
        }
    }
});