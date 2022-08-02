const config = require("../../config");
const log = require("../../logger");
const {ChannelType} = require("discord.js");

const nameUpdateTimeouts = {};

function checkCountdownNameUpdate(bot, event, hours) {
    delete nameUpdateTimeouts[event.id];
    const now = Date.now();
    const target = event.scheduledEndTimestamp - (3600000 * hours);

    if (now < target) {
        // Make sure inaccuracies didn't lead to the timeout ending early
        // The name update should be after the full hour to make sure the event handler below correctly schedules the
        // next name update and doesn't re-schedule the current one
        nameUpdateTimeouts[event.id] = setTimeout(checkCountdownNameUpdate.bind(this, bot, event, hours), target - now + 100);
        return;
    }
    let newName = event.name.substr(event.name.indexOf("SIFcord Party"));
    if (hours === 1) {
        newName = "[FINAL HOUR!] " + newName;
    } else if (hours > 1) {
        newName = "[" + hours + "h left] " + newName;
    }
    try {
        event.setName(newName);
    } catch (e) {
        log.error("PARTYEVENT", "Failed to set event name: " + e);
        if (hours > 1) {
            // Usually the next name update would be scheduled in the event handler below, but if the name change fails...
            nameUpdateTimeouts[event.id] = setTimeout(checkCountdownNameUpdate.bind(this, bot, event, hours - 1),
                event.scheduledEndTimestamp - (3600000 * (hours - 1)) - now + 100);
        }
    }
}

module.exports = (bot, db) => {
    async function handleEvent(oldEvent, newEvent) {
        const location = newEvent?.entityMetadata?.location || oldEvent?.entityMetadata?.location;
        if (location) {
            if (newEvent !== undefined && newEvent.isActive()) {
                const channelNames = [...location.matchAll(/#([^#,;/ ]*)/g)].map(m => m[1]);
                log.debug("PARTYEVENT", "Event " + newEvent.name + " now active, channels " + channelNames.join("/"));
                for (let channelName of channelNames) {
                    const channel = bot.channels.cache.find(channel => channel.name === channelName);
                    log.debug("PARTYEVENT", "Looking for " + channelName + ", got " + (channel ? channel.name : "undefined"));
                    if (channel && channel.type === ChannelType.GuildText) {
                        try {
                            log.info("PARTYEVENT", "Adding marker for " + channelName);
                            channel.setName(channelName + "🟢");
                        } catch {
                            // pass
                        }
                    }
                }
            } else if (newEvent === undefined || !newEvent.isActive()) {
                const channelNames = [...location.matchAll(/#([^#,;/ ]*)/g)].map(m => m[1]);
                log.debug("PARTYEVENT", "Event " + newEvent.name + " now inactive, channels " + channelNames.join("/"));
                for (let channelName of channelNames) {
                    const searchName = channelName + "🟢";
                    const channel = bot.channels.cache.find(channel => channel.name === searchName);
                    log.debug("PARTYEVENT", "Looking for " + searchName + ", got " + (channel ? channel.name : "undefined"));
                    if (channel && channel.type === ChannelType.GuildText) {
                        try {
                            log.info("PARTYEVENT", "Removing marker for " + channelName);
                            channel.setName(channelName);
                        } catch {
                            // pass
                        }
                    }
                }
            }
        }

        if (newEvent.isActive() && newEvent.name.indexOf("SIFcord Party") !== -1 && newEvent.name.indexOf("Birthday") !== -1) {
            // For Birthday events, do a countdown for the last four hours in the event name
            clearTimeout(nameUpdateTimeouts[newEvent.id]);
            const now = Date.now();
            let hours = 4;
            let target = newEvent.scheduledEndTimestamp - (3600000 * hours);
            while (target < now && hours > 0) {
                hours--;
                target += 3600000;
            }
            if (hours > 0) {
                log.info("PARTYEVENT", "Scheduled " + hours + "-hour countdown change for " + newEvent.name + " in " + ((target - now) / 1000) + "s");
                nameUpdateTimeouts[newEvent.id] = setTimeout(checkCountdownNameUpdate.bind(this, bot, newEvent, hours), target - now + 100);
            }
        }
    }

    bot.on("guildScheduledEventUpdate", handleEvent);
    bot.on("guildScheduledEventDelete", handleEvent);
    bot.on("ready", async () => {
        bot.guilds.fetch(config.sifcordGuildId).then(guild =>
            guild.scheduledEvents.fetch({}).then(events => events.each(ev => {
                handleEvent(undefined, ev);
            })));
    });
    return {};
};