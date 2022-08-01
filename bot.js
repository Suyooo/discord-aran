const fs = require("fs");
const {Client, GatewayIntentBits, InteractionType, Partials} = require('discord.js');
const cron = require("cron");
const config = require("./config");
const log = require("./logger");

module.exports = (db) => {
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
    const moduleNames = fs.readdirSync("./modules");

    for (const moduleName of moduleNames) {
        if (config.hasOwnProperty("moduleWhitelist") && config.moduleWhitelist.indexOf(moduleName) === -1) {
            log.info("BOT", "Module " + moduleName + " not whitelisted, skipping");
            continue;
        }
        log.debug("BOT", "Loading module " + moduleName);
        const moduleInfo = require("./modules/" + moduleName + "/info");

        if (fs.existsSync("./modules/" + moduleName + "/bot.js")) {
            const module = require("./modules/" + moduleName + "/bot")(bot, db);
            bot.modules[moduleName] = module;
            if (moduleInfo.hasOwnProperty("textCommands")) {
                for (const textCommand of moduleInfo.textCommands) {
                    if (bot.textCommands.hasOwnProperty(textCommand)) {
                        log.error("BOT", "Startup Error: Duplicate text command \"" + textCommand + "\"");
                        process.exit(1);
                    }
                    bot.textCommands[textCommand] = module.textCommand;
                }
            }
            log.info("BOT", "Module bot component for " + moduleName + " registered");
        }
    }

    bot.once("ready", () => {
        log.info("BOT", "Ready");
    });

    bot.on("messageCreate", message => {
        if (message.author.bot) return;
        if (message.content.startsWith(config.textCommandPrefix)) {
            let args = message.content.substr(config.textCommandPrefix.length).split(" ");
            if (bot.textCommands.hasOwnProperty(args[0])) {
                try {
                    bot.textCommands[args[0]](message, args);
                } catch (error) {
                    log.error("BOT", "Uncaught Error in text command " + args[0] + ": " + error.stack);
                    return message.reply("There was an error while executing this command!");
                }
            }
        }
    });

    bot.on("interactionCreate", interaction => {
        const args = interaction.customId.split("-");
        const module = bot.modules[args[0]];
        if (!module) {
            log.error("BOT", "Got interaction for module " + args[0] + ", but it's not loaded");
            return;
        }

        if (interaction.isSelectMenu()) {
            log.info("BOT", "Recieved select menu interaction " + interaction.customId);
            if (module.selection === undefined) {
                log.error("BOT", "Got interaction for module " + args[0] + ", but it doesn't handle selections");
                return;
            }

            module.selection(interaction, args)
                .catch(error => {
                    log.error("BOT", "Uncaught Error in selection for module " + args[0] + ": " + error.stack);
                    let sendMessage = (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).bind(interaction);
                    sendMessage({content: "There was an error while executing this command!", ephemeral: true})
                        .catch(error => {
                            log.error("BOT", "Also failed to send a failure notice to the user: " + error.stack);
                        });
                });
        } else if (interaction.isButton()) {
            log.info("BOT", "Recieved button interaction " + interaction.customId);
            if (module.button === undefined) {
                log.error("BOT", "Got interaction for module " + args[0] + ", but it doesn't handle buttons");
                return;
            }

            module.button(interaction, args)
                .catch(error => {
                    log.error("BOT", "Uncaught Error in button for module " + args[0] + ": " + error.stack);
                    let sendMessage = (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).bind(interaction);
                    sendMessage({content: "There was an error while executing this command!", ephemeral: true})
                        .catch(error => {
                            log.error("BOT", "Also failed to send a failure notice to the user: " + error.stack);
                        });
                });
        } else if (interaction.type === InteractionType.ModalSubmit) {
            log.info("BOT", "Recieved modal interaction " + interaction.customId);
            if (module.button === undefined) {
                log.error("BOT", "Got interaction for module " + args[0] + ", but it doesn't handle modals");
                return;
            }

            module.modal(interaction, args)
                .catch(error => {
                    log.error("BOT", "Uncaught Error in modal for module " + args[0] + ": " + error.stack);
                    let sendMessage = (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).bind(interaction);
                    sendMessage({content: "There was an error while executing this command!", ephemeral: true})
                        .catch(error => {
                            log.error("BOT", "Also failed to send a failure notice to the user: " + error.stack);
                        });
                });
        }
    });

    bot.login(config.botToken)
        .then(() => log.info("BOT", "Logged in"))
        .catch(error => {
            log.error("BOT", "Failed to log in! " + error.stack);
            process.exit(1);
        });

    return bot;
};