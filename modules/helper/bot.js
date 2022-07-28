const config = require("../../config");
const log = require("../../logger");
const {ChannelType} = require("discord.js");

function resolveChannelId(bot, id) {
}

module.exports = (bot) => {
    const o = {
        listChannelsOfGuild: async (guildId) => {
            return await bot.guilds.fetch(guildId).then(guild => {
                const all = [...guild.channels.cache.values()];
                const channels = all.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice)
                    .sort((a, b) => {
                        return a.position - b.position;
                    });
                const categories = all.filter(c => c.type === ChannelType.GuildCategory)
                    .sort((a, b) => {
                        return a.position - b.position;
                    });
                return categories.flatMap(cat => [cat, ...channels.filter(c => c.parentId === cat.id)])
                    .map(c => ({
                        "id": c.id,
                        "name": c.name,
                        "type": c.type === ChannelType.GuildCategory ? "category" : (c.type === ChannelType.GuildVoice ? "voice" : "text")
                    }));
            });
        },
        listRolesOfGuild: async (guildId) => {
            return await bot.guilds.fetch(guildId).then(guild => {
                return [...guild.roles.cache.values()]
                    .filter(r => r.id !== guild.roles.everyone.id)
                    .sort((a, b) => {
                        return b.position - a.position;
                    })
                    .map(r => ({
                        "id": r.id,
                        "name": r.name,
                        "color": r.color
                    }));
            });
        }
    };

    return o;
};