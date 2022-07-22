const config = require("../../config");
const log = require("../../logger");

const RC_CHANNEL_ID = "591254845621665793";
const MAIN_CHANNEL_ID = "207972536393138177";
const MAIN_CATEGORY_ID = "360566929448108032";
const STORAGE_CATEGORY_ID = "629503261392502815";

function setPermissionsForEveryone(channel, perm) {
    return channel.permissionOverwrites.edit(config.sifcordGuildId, {
        "ViewChannel": perm,
        "SendMessages": perm
    }, {
        "reason": "Scheduled RC channel open/close",
        "type": 0 // 0 = role override
    });
}

// For future reference? Cron schedule for 5x EXP Periods - 0 12,17,22 * * 6,7

module.exports = (bot) => {
    bot.on("ready", async () => {
        const guild = await bot.guilds.fetch(config.sifcordGuildId);
        const channel = await guild.channels.fetch(RC_CHANNEL_ID);
        const mainChannel = await guild.channels.fetch(MAIN_CHANNEL_ID);

        bot.cron("0 16 * * 5", async () => {
            log.info("RC", "Opening RC channel");
            await setPermissionsForEveryone(channel, null);
            await channel.setParent(MAIN_CATEGORY_ID, {
                "reason": "Scheduled RC channel open/close",
                "lockPermissions": false
            });
            await channel.setPosition(mainChannel.position + (channel.position > mainChannel.position ? 1 : 0), {
                "reason": "Scheduled RC channel open/close"
            });
        });
        bot.cron("0 15 * * 1", async () => {
            log.info("RC", "Closing RC channel");
            await setPermissionsForEveryone(channel, false);
            await channel.setParent(STORAGE_CATEGORY_ID, {
                "reason": "Scheduled RC channel open/close",
                "lockPermissions": false
            });
        });
    });
    return {};
};