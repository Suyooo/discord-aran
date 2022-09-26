const log = require("../../logger");
const config = require("../../config");

const RC_CHANNEL_ID = "591254845621665793";
const RC_ROLE_ID = "858308125274931232";
const SBL_CHANNEL_ID = "690089810685198437";
const SBL_ROLE_ID = "1023977389195276358";

module.exports = (bot, db) => {
    return {
        async textCommand(message, args) {
            if (message.author.bot) return;
            if (args.length < 2) {
                message.reply("Please add a message after the !rcping command, to let people know what's happening! (For example, \"Starting a round now!\" or \"Anyone around to play?\")");
                return;
            }

            const targetChannelId = args[0] === "rcping" ? RC_CHANNEL_ID : SBL_CHANNEL_ID;
            const targetRoleId = args[0] === "rcping" ? RC_ROLE_ID : SBL_ROLE_ID;

            if (message.channelId !== targetChannelId) {
                log.debug("LOBBYPING", message.author.tag + " tried " + args[0] + " in " + message.channel.name);
                message.author.send("You're not in the correct channel for this command.").catch(e => {
                    log.error("LOBBYPING", "Failed to notify" + message.author.tag + " that " + message.channel.name + " is not the right channel for " + args[0] + ": " + e + "\n" + e.stack);
                });
                return;
            }

            const member = await (await bot.guilds.fetch(config.sifcordGuildId)).members.fetch({
                user: message.author.id,
                force: true
            });
            if (member.roles.cache.every(role => role.id !== targetRoleId)) {
                log.debug("LOBBYPING", message.author.tag + " doesn't have role for " + args[0]);
                message.author.send("You don't have the role you're trying to ping.").catch(e => {
                    log.error("LOBBYPING", "Failed to notify" + message.author.tag + " that they don't have the correct role for " + args[0] + ": " + e + "\n" + e.stack);
                });
                return;
            }

            await Promise.all([
                message.channel.send({
                    content: "<@&" + targetRoleId + "> **" + message.author.toString() + " pinged you:** " + args.slice(1).join(" "),
                    allowedMentions: {parse: [], roles: [targetRoleId], repliedUser: false}
                }),
                message.delete()
            ]);
        }
    }
};