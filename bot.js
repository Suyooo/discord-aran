const fs = require("fs");
const {Client, GatewayIntentBits, InteractionType, Partials} = require('discord.js');
const cron = require("cron");
const config = require("./config");
const log = require("./logger");

module.exports = (moduleList, db) => {
    const bot = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.GuildScheduledEvents,
        ],
        partials: [Partials.Channel], // required for DMs
        allowedMentions: {parse: ['users'], repliedUser: false}
    });

    bot.cron = function (pattern, func) {
        return cron.job(pattern, func, null, true, 'Asia/Tokyo');
    };

    bot.auth = require("./auth")(bot, db); // technically implemented like a module, but let's give it a special place

    bot.modules = {};
    bot.textCommands = {};

    for (const mod of moduleList) {
        log.debug("BOT", "Loading module " + mod.name);

        const module = require("./modules/" + mod.name + "/bot")(bot, db);
        bot.modules[mod.name] = module;
        if (mod.info.hasOwnProperty("textCommands")) {
            for (const textCommand of mod.info.textCommands) {
                if (bot.textCommands.hasOwnProperty(textCommand)) {
                    log.error("BOT", "Startup Error: Duplicate text command \"" + textCommand + "\"");
                    process.exit(1);
                }
                bot.textCommands[textCommand] = module.textCommand;
            }
        }
        log.info("BOT", "Module bot component for " + mod.name + " registered");
    }

    bot.once("ready", () => {
        log.info("BOT", "Ready");
    });

    bot.on("messageCreate", message => {
        if (message.author.bot) return;
        if (message.content.startsWith(config.textCommandPrefix)) {
            let args = message.content.substr(config.textCommandPrefix.length).split(" ");
            if (bot.textCommands.hasOwnProperty(args[0])) {
                log.info("BOT", "Recieved text command " + args[0] + " from " + message.author.tag);
                try {
                    bot.textCommands[args[0]](message, args);
                } catch (error) {
                    log.error("BOT", "Uncaught Error in text command " + args[0] + ": " + error + "\n" + error.stack);
                    return message.reply("There was an error while executing this command!");
                }
            }
        }
    });

    bot.on("interactionCreate", interaction => {
        log.debug("BOT", "Interaction " + interaction.customId + " from " + interaction.user.tag);
        const args = interaction.customId.split("-");
        const module = bot.modules[args[0]];
        if (!module) {
            log.error("BOT", "Got interaction for module " + args[0] + ", but it's not loaded");
            return;
        }

        if (interaction.isAnySelectMenu()) {
            log.info("BOT", "Recieved select menu interaction " + interaction.customId + " from " + interaction.user.tag);
            if (module.selection === undefined) {
                log.error("BOT", "Got interaction for module " + args[0] + ", but it doesn't handle selections");
                return;
            }

            module.selection(interaction, args)
                .catch(error => {
                    log.error("BOT", "Uncaught Error in selection for module " + args[0] + ": " + error + "\n" + error.stack);
                    let sendMessage = (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).bind(interaction);
                    sendMessage({content: "There was an error while executing this command!", ephemeral: true})
                        .catch(error => {
                            log.error("BOT", "Also failed to send a failure notice to the user: " + error + "\n" + error.stack);
                        });
                });
        } else if (interaction.isButton()) {
            log.info("BOT", "Recieved button interaction " + interaction.customId + " from " + interaction.user.tag);
            if (module.button === undefined) {
                log.error("BOT", "Got interaction for module " + args[0] + ", but it doesn't handle buttons");
                return;
            }

            module.button(interaction, args)
                .catch(error => {
                    log.error("BOT", "Uncaught Error in button for module " + args[0] + ": " + error + "\n" + error.stack);
                    let sendMessage = (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).bind(interaction);
                    sendMessage({content: "There was an error while executing this command!", ephemeral: true})
                        .catch(error => {
                            log.error("BOT", "Also failed to send a failure notice to the user: " + error + "\n" + error.stack);
                        });
                });
        } else if (interaction.type === InteractionType.ModalSubmit) {
            log.info("BOT", "Recieved modal interaction " + interaction.customId + " from " + interaction.user.tag);
            if (module.button === undefined) {
                log.error("BOT", "Got interaction for module " + args[0] + ", but it doesn't handle modals");
                return;
            }

            module.modal(interaction, args)
                .catch(error => {
                    log.error("BOT", "Uncaught Error in modal for module " + args[0] + ": " + error + "\n" + error.stack);
                    let sendMessage = (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).bind(interaction);
                    sendMessage({content: "There was an error while executing this command!", ephemeral: true})
                        .catch(error => {
                            log.error("BOT", "Also failed to send a failure notice to the user: " + error + "\n" + error.stack);
                        });
                });
        }
    });

    return bot.login(config.botToken)
        .then(() => {
            log.info("BOT", "Logged in");
            return bot;
        })
        .catch(error => {
            log.error("BOT", "Failed to log in! " + error + "\n" + error.stack);
            process.exit(1);
        });
};