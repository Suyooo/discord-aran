const config = require("../../config");
const log = require("../../logger");
const {ButtonBuilder, ButtonStyle, ActionRowBuilder} = require("discord.js");

const SIF_MAIN_CHANNEL_ID = "207972536393138177";
const SIF_GACHA_CHANNEL_ID = "624502369757167637";
const SIF_MAIN_CATEGORY_ID = "360566929448108032";
const SIF_STORAGE_CATEGORY_ID = "629503261392502815";

const SIFAS_MAIN_CHANNEL_ID = "314758598628605963";
const SIFAS_GACHA_CHANNEL_ID = "686500086192013368";
const SIFAS_MAIN_CATEGORY_ID = "626637197562347521";
const SIFAS_STORAGE_CATEGORY_ID = "691255798973857832";

function sortChannelInto(channel, category, reason) {
    return channel.setParent(category, {
        reason, "lockPermissions": false
    });
}

function moveChannelBelow(channel, mainChannel, reason) {
    return channel.setPosition(mainChannel.position + (channel.position > mainChannel.position ? 1 : 0), {reason});
}

function setChannelPermissions(channel, roleId, permissionValue, reason) {
    return channel.permissionOverwrites.edit(roleId, {
        "ViewChannel": permissionValue,
        "SendMessages": permissionValue,
        "SendMessagesInThreads": permissionValue
    }, {
        reason, "type": 0 // 0 = role override
    });
}

async function handleGeneric(channel, belowChannel, mainCategory, storageCategory, open, name, user = undefined) {
    if ((channel.parentId === mainCategory) === open) return;

    let reason;
    if (user === undefined) {
        reason = (open ? "Opening " : "Closing ") + name + " channel (scheduled)";
    } else {
        reason = (open ? "Opening " : "Closing ") + name + " channel (requested by " + user.tag + ")";
    }
    log.info("CHANNELOPEN", reason);

    if (open) {
        await sortChannelInto(channel, mainCategory, reason);
        await moveChannelBelow(channel, belowChannel, reason);
        await setChannelPermissions(channel, channel.guild.roles.everyone, null, reason);
    } else {
        await setChannelPermissions(channel, channel.guild.roles.everyone, false, reason);
        await sortChannelInto(channel, storageCategory, reason);
    }
}

const SIF_RC_CHANNEL_ID = "591254845621665793";

// For future reference? Cron schedule for 5x EXP Periods - 0 12,17,22 * * 6,7

async function handleRC(bot, open, user = undefined) {
    const guild = await bot.guilds.fetch(config.sifcordGuildId);
    await handleGeneric(await guild.channels.fetch(SIF_RC_CHANNEL_ID), await guild.channels.fetch(SIF_MAIN_CHANNEL_ID),
        SIF_MAIN_CATEGORY_ID, SIF_STORAGE_CATEGORY_ID, open, "SIF RC", user);
}

const SIF_SM_CHANNEL_ID = "718744730241990757";

async function handleSM(bot, open, user) {
    const guild = await bot.guilds.fetch(config.sifcordGuildId);
    await handleGeneric(await guild.channels.fetch(SIF_SM_CHANNEL_ID), await guild.channels.fetch(SIF_MAIN_CHANNEL_ID),
        SIF_MAIN_CATEGORY_ID, SIF_STORAGE_CATEGORY_ID, open, "SIF Score Match", user);
}

const SIF_CM_CHANNEL_ID = "337112055410589696";
const SIF_CM8_CHANNEL_ID = "446984819977486337";
const SIF_CM9_CHANNEL_ID = "710458657376043068";
const SIF_CM8_ROLE_ID = "446985857707016194";
const SIF_CM9_ROLE_ID = "710457871598616646";

async function handleCM(bot, open, user) {
    const guild = await bot.guilds.fetch(config.sifcordGuildId);
    const cm = await guild.channels.fetch(SIF_CM_CHANNEL_ID);
    if ((cm.parentId === SIF_MAIN_CATEGORY_ID) === open) return;

    const reason = (open ? "Opening " : "Closing ") + "SIF Companion Match channels (requested by " + user.tag + ")";
    log.info("CHANNELOPEN", reason);

    const main = await guild.channels.fetch(SIF_MAIN_CHANNEL_ID);
    const cm8 = await guild.channels.fetch(SIF_CM8_CHANNEL_ID);
    const cm9 = await guild.channels.fetch(SIF_CM9_CHANNEL_ID);

    if (open) {
        await sortChannelInto(cm, SIF_MAIN_CATEGORY_ID, reason);
        await moveChannelBelow(cm, main, reason);
        await sortChannelInto(cm8, SIF_MAIN_CATEGORY_ID, reason);
        await moveChannelBelow(cm8, cm, reason);
        await sortChannelInto(cm9, SIF_MAIN_CATEGORY_ID, reason);
        await moveChannelBelow(cm9, cm8, reason);

        await Promise.all([
            setChannelPermissions(cm, guild.roles.everyone, null, reason),
            setChannelPermissions(cm8, SIF_CM8_ROLE_ID, true, reason),
            setChannelPermissions(cm8, SIF_CM9_ROLE_ID, true, reason),
            setChannelPermissions(cm9, SIF_CM9_ROLE_ID, true, reason)
        ]);
    } else {
        await Promise.all([
            setChannelPermissions(cm, guild.roles.everyone, false, reason),
            setChannelPermissions(cm8, SIF_CM8_ROLE_ID, null, reason),
            setChannelPermissions(cm8, SIF_CM9_ROLE_ID, null, reason),
            setChannelPermissions(cm9, SIF_CM9_ROLE_ID, null, reason)
        ]);

        await sortChannelInto(cm9, SIF_STORAGE_CATEGORY_ID, reason);
        await sortChannelInto(cm8, SIF_STORAGE_CATEGORY_ID, reason);
        await sortChannelInto(cm, SIF_STORAGE_CATEGORY_ID, reason);
    }
}

const SIF_PARTY_CHANNEL_ID = "832628579728752680";

async function handleSIFParty(bot, open, user) {
    const guild = await bot.guilds.fetch(config.sifcordGuildId);
    const party = await guild.channels.fetch(SIF_PARTY_CHANNEL_ID);
    if ((party.parentId === SIF_MAIN_CATEGORY_ID) === open) return;

    const reason = (open ? "Opening " : "Closing ") + "SIF Party channel (requested by " + user.tag + ")";
    log.info("CHANNELOPEN", reason);

    const gacha = await guild.channels.fetch(SIF_GACHA_CHANNEL_ID);

    if (open) {
        await sortChannelInto(party, SIF_MAIN_CATEGORY_ID, reason);
        await moveChannelBelow(party, gacha, reason);
        await party.permissionOverwrites.edit(guild.roles.everyone, {
            "ViewChannel": null,
            "SendMessages": false,
            "SendMessagesInThreads": false
        }, {
            reason, "type": 0 // 0 = role override
        });
    } else {
        await setChannelPermissions(party, guild.roles.everyone, false, reason);
        await sortChannelInto(party, SIF_STORAGE_CATEGORY_ID, reason);
    }
}

async function unlockSIFParty(bot, user) {
    await handleSIFParty(bot, true, user);
    const guild = await bot.guilds.fetch(config.sifcordGuildId);
    const party = await guild.channels.fetch(SIF_PARTY_CHANNEL_ID);
    await setChannelPermissions(party, guild.roles.everyone, null, "Unlocking SIF Party channel (requested by " + user.tag + ")");
}

const SIFAS_SBL_CHANNEL_ID = "690089810685198437";

async function handleSBL(bot, open, user) {
    const guild = await bot.guilds.fetch(config.sifcordGuildId);
    await handleGeneric(await guild.channels.fetch(SIFAS_SBL_CHANNEL_ID), await guild.channels.fetch(SIFAS_MAIN_CHANNEL_ID),
        SIFAS_MAIN_CATEGORY_ID, SIFAS_STORAGE_CATEGORY_ID, open, "SIFAS SBL", user);
}

const SIFAS_DLP_CHANNEL_ID = "776477270181019648";

async function handleDLP(bot, open, user) {
    const guild = await bot.guilds.fetch(config.sifcordGuildId);
    await handleGeneric(await guild.channels.fetch(SIFAS_DLP_CHANNEL_ID), await guild.channels.fetch(SIFAS_MAIN_CHANNEL_ID),
        SIFAS_MAIN_CATEGORY_ID, SIFAS_STORAGE_CATEGORY_ID, open, "SIFAS DLP", user);
}

const SIFAS_PARTY_CHANNEL_ID = "827558022078267462";

async function handleSIFASParty(bot, open, user) {
    const guild = await bot.guilds.fetch(config.sifcordGuildId);
    const party = await guild.channels.fetch(SIFAS_PARTY_CHANNEL_ID);
    if ((party.parentId === SIFAS_MAIN_CATEGORY_ID) === open) return;

    const reason = (open ? "Opening " : "Closing ") + "SIFAS Party channel (requested by " + user.tag + ")";
    log.info("CHANNELOPEN", reason);

    const gacha = await guild.channels.fetch(SIFAS_GACHA_CHANNEL_ID);

    if (open) {
        await sortChannelInto(party, SIFAS_MAIN_CATEGORY_ID, reason);
        await moveChannelBelow(party, gacha, reason);
        await party.permissionOverwrites.edit(guild.roles.everyone, {
            "ViewChannel": null,
            "SendMessages": false,
            "SendMessagesInThreads": false
        }, {
            reason, "type": 0 // 0 = role override
        });
    } else {
        await setChannelPermissions(party, guild.roles.everyone, false, reason);
        await sortChannelInto(party, SIFAS_STORAGE_CATEGORY_ID, reason);
    }
}

async function unlockSIFASParty(bot, user) {
    await handleSIFASParty(bot, true, user);
    const guild = await bot.guilds.fetch(config.sifcordGuildId);
    const party = await guild.channels.fetch(SIFAS_PARTY_CHANNEL_ID);
    await setChannelPermissions(party, guild.roles.everyone, null, "Unlocking SIFAS Party channel (requested by " + user.tag + ")");
}

const SIFCORD_PARTY_CHANNEL_ID = "878288301335920710";
const SIFCORD_PARTY_CATEGORY_ID = "878288224173326408";
const VC_CATEGORY_ID = "358186125073842176";

async function handleSIFcordParty(bot, open, user) {
    const reason = (open ? "Opening " : "Closing ") + "SIFcord Party category (requested by " + user.tag + ")";
    log.info("CHANNELOPEN", reason);

    const guild = await bot.guilds.fetch(config.sifcordGuildId);
    const party = await guild.channels.fetch(SIFCORD_PARTY_CATEGORY_ID);

    if (open) {
        await moveChannelBelow(party, await guild.channels.fetch(SIF_STORAGE_CATEGORY_ID), reason);
        await setChannelPermissions(party, guild.roles.everyone, null, reason);
    } else {
        await setChannelPermissions(party, guild.roles.everyone, false, reason);
        await moveChannelBelow(party, await guild.channels.fetch(VC_CATEGORY_ID), reason);
    }
}

async function findAndExecuteHandler(bot, user, key, open) {
    let handler = undefined;
    let hasPerms = false;
    if (await bot.auth.checkStaff(user)) {
        if (key === "rc") handler = handleRC;
        else if (key === "sm") handler = handleSM;
        else if (key === "cm") handler = handleCM;
        else if (key === "sbl") handler = handleSBL;
        else if (key === "dlp") handler = handleDLP;
    }
    if (handler === undefined && await bot.auth.checkParty(user)) {
        if (key === "sifparty") handler = handleSIFParty;
        else if (key === "sifasparty") handler = handleSIFASParty;
        else if (key === "sifcordparty") handler = handleSIFcordParty;
    }

    if (handler !== undefined) {
        await handler(bot, open, user);
        return true;
    }
    return false;
}

async function postStaffControlPanel(bot) {
    const rows = [new ActionRowBuilder(), new ActionRowBuilder(), new ActionRowBuilder(), new ActionRowBuilder(), new ActionRowBuilder()];
    rows[0].addComponents(
        new ButtonBuilder()
            .setLabel("SIF Score Match")
            .setCustomId("channelopen-label-sm")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setLabel("Open")
            .setCustomId("channelopen-open-sm")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setLabel("Close")
            .setCustomId("channelopen-close-sm")
            .setStyle(ButtonStyle.Danger)
    );
    rows[1].addComponents(
        new ButtonBuilder()
            .setLabel("SIF Companion Match")
            .setCustomId("channelopen-label-cm")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setLabel("Open")
            .setCustomId("channelopen-open-cm")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setLabel("Close")
            .setCustomId("channelopen-close-cm")
            .setStyle(ButtonStyle.Danger)
    );
    rows[2].addComponents(
        new ButtonBuilder()
            .setLabel("SIF Rhythmic Carnival")
            .setCustomId("channelopen-label-rc")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setLabel("Open")
            .setCustomId("channelopen-open-rc")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setLabel("Close")
            .setCustomId("channelopen-close-rc")
            .setStyle(ButtonStyle.Danger)
    );
    rows[3].addComponents(
        new ButtonBuilder()
            .setLabel("SIFAS SBL")
            .setCustomId("channelopen-label-sbl")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setLabel("Open")
            .setCustomId("channelopen-open-sbl")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setLabel("Close")
            .setCustomId("channelopen-close-sbl")
            .setStyle(ButtonStyle.Danger)
    );
    rows[4].addComponents(
        new ButtonBuilder()
            .setLabel("SIFAS DLP")
            .setCustomId("channelopen-label-dlp")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setLabel("Open")
            .setCustomId("channelopen-open-dlp")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setLabel("Close")
            .setCustomId("channelopen-close-dlp")
            .setStyle(ButtonStyle.Danger)
    );
    const channel = await bot.channels.fetch("836582911134269510");
    await channel.send({
        content: "**Event Channel Open/Close Buttons**\n(alternative text commands in the message below)",
        components: rows
    });
    await channel.send("The SIF Rhythmic Carnival channel will be automatically opened/closed on schedule (Friday 16:00 - Monday 15:00 JST), but can still be opened/closed manually here.\n\n" +
        "Alternatively, you can use the text commands `.open` and `.close` in the channel you want to open/close. " +
        "For example, type `.open` in <#690089810685198437> to open the SIFAS SBL event channel.\n\n" +
        "You can also use the command in this channel instead by putting the event name behind it:\n" +
        "`.open sm`/`.close sm` - SIF Score Match\n" +
        "`.open cm`/`.close cm` - SIF Companion Match\n" +
        "`.open rc`/`.close rc` - SIF Rhythmic Carnival\n" +
        "`.open sbl`/`.close sbl` - SIFAS SBL\n" +
        "`.open dlp`/`.close dlp` - SIFAS DLP");
}

async function postPartyControlPanel(bot) {
    const rows = [new ActionRowBuilder(), new ActionRowBuilder(), new ActionRowBuilder()];
    rows[0].addComponents(
        new ButtonBuilder()
            .setLabel("SIF Party")
            .setCustomId("channelopen-label-sifparty")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setLabel("Open (read only)")
            .setCustomId("channelopen-open-sifparty")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setLabel("Unlock")
            .setCustomId("channelopen-unlock-sifparty")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setLabel("Close")
            .setCustomId("channelopen-close-sifparty")
            .setStyle(ButtonStyle.Danger)
    );
    rows[1].addComponents(
        new ButtonBuilder()
            .setLabel("SIFAS Party")
            .setCustomId("channelopen-label-sifasparty")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setLabel("Open (read only)")
            .setCustomId("channelopen-open-sifasparty")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setLabel("Unlock")
            .setCustomId("channelopen-unlock-sifasparty")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setLabel("Close")
            .setCustomId("channelopen-close-sifasparty")
            .setStyle(ButtonStyle.Danger)
    );
    rows[2].addComponents(
        new ButtonBuilder()
            .setLabel("SIFcord Party")
            .setCustomId("channelopen-label-sifcordparty")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setLabel("Open")
            .setCustomId("channelopen-open-sifcordparty")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setLabel("Close")
            .setCustomId("channelopen-close-sifcordparty")
            .setStyle(ButtonStyle.Danger)
    );
    const channel = await bot.channels.fetch("836582911134269510");
    await channel.send({
        content: "**Party Channel Open/Close Buttons**\n(alternative text commands in the message below)",
        components: rows
    });
    await channel.send("SIF/SIFAS Party will be read-only for other users when you click Open, so you can send challenge posts in peace - then, click Unlock to let everyone post.\n" +
        "(If you want to open the channel for everyone right away though, you can just click Unlock, no need to click Open first.)\n\n" +
        "Alternatively, you can use the text commands `.open`, `.unlock` and `.close` in this channel:\n" +
        "`.open sifparty`/`.unlock sifparty`/`.close sifparty` - SIF Party\n" +
        "`.open sifasparty`/`.unlock sifasparty`/`.close sifasparty` - SIFAS Party\n" +
        "`.open sifcordparty`/`.close sifcordparty` - SIFcord Party");
}

module.exports = (bot, db) => {
    bot.on("ready", async () => {
        bot.cron("0 16 * * 5", async () => {
            await handleRC(bot, true);
        });
        bot.cron("0 15 * * 1", async () => {
            await handleRC(bot, false);
        });
    });

    return {
        async textCommand(message, args) {
            try {
                if (args[0] === "poststaffcontrolpanel") {
                    await postStaffControlPanel(bot);
                    return;
                }
                if (args[0] === "postpartycontrolpanel") {
                    await postPartyControlPanel(bot);
                    return;
                }

                if (args[0] === "unlock" && (args[1] === "sifparty" || args[1] === "sifasparty") && await bot.auth.checkParty(message.author)) {
                    if (args[2] === "sifparty") await unlockSIFParty(bot, message.author);
                    else await unlockSIFASParty(bot, message.author);
                } else {
                    let key = args[1];
                    if (key === undefined) {
                        if (message.channelId === SIF_RC_CHANNEL_ID) key = "rc";
                        else if (message.channelId === SIF_SM_CHANNEL_ID) key = "sm";
                        else if (message.channelId === SIF_CM_CHANNEL_ID) key = "cm";
                        else if (message.channelId === SIF_PARTY_CHANNEL_ID) key = "sifparty";
                        else if (message.channelId === SIFAS_SBL_CHANNEL_ID) key = "sbl";
                        else if (message.channelId === SIFAS_DLP_CHANNEL_ID) key = "dlp";
                        else if (message.channelId === SIFAS_PARTY_CHANNEL_ID) key = "sifasparty";
                        else if (message.channelId === SIFCORD_PARTY_CHANNEL_ID) key = "sifcordparty";
                    }

                    if (!(await findAndExecuteHandler(bot, message.author, key, args[0] !== "close"))) {
                        if (await bot.auth.checkParty(message.author)) {
                            if (key === undefined) {
                                await message.reply("You're not in an " + args[0] + "-able channel.")
                                    .catch(error => {
                                        log.error("CHANNELOPEN", "Failed to notify user about error: " + error + "\n" + error.stack);
                                    });
                            } else {
                                await message.reply("Unknown channel key.")
                                    .catch(error => {
                                        log.error("CHANNELOPEN", "Failed to notify user about error: " + error + "\n" + error.stack);
                                    });
                            }
                        }
                    }
                }
            } catch (e) {
                log.error("CHANNELOPEN", "Error handling text command: " + e + "\n" + e.stack);
                await message.reply("An error occured.")
                    .catch(error => {
                        log.error("CHANNELOPEN", "Failed to notify user about error: " + error + "\n" + error.stack);
                    });
            }
        },
        async button(interaction, args) {
            try {
                const deferral = interaction.deferUpdate();
                if (args[1] === "unlock" && (args[2] === "sifparty" || args[2] === "sifasparty") && await bot.auth.checkParty(interaction.user)) {
                    if (args[2] === "sifparty") await unlockSIFParty(bot, interaction.user);
                    else await unlockSIFASParty(bot, interaction.user);
                } else {
                    await findAndExecuteHandler(bot, interaction.user, args[2], args[1] !== "close");
                }
                await deferral;
                interaction.editReply({})
                    .catch(error => {
                        log.error("CHANNELOPEN", "Failed to acknowledge interaction: " + error + "\n" + error.stack);
                    });
            } catch (e) {
                log.error("CHANNELOPEN", "Error handling button interaction: " + e + "\n" + e.stack);
            }
        }
    };
};