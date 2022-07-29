const fs = require("fs");
const {Client, GatewayIntentBits, InteractionType, Partials} = require('discord.js');
const cron = require("cron");
const config = require("./config");
const log = require("./logger");

const client = new Client({
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

client.cron = function (pattern, func) {
    return cron.job(pattern, func, null, true, 'Asia/Tokyo');
};

client.modules = {};
client.textCommands = {};
const moduleNames = fs.readdirSync("./modules");

for (const moduleName of moduleNames) {
    if (config.hasOwnProperty("moduleWhitelist") && config.moduleWhitelist.indexOf(moduleName) === -1) {
        log.info("BOT", "Module " + moduleName + " not whitelisted, skipping");
        continue;
    }
    log.info("BOT", "Loading module " + moduleName);
    const moduleInfo = require("./modules/" + moduleName + "/info");
    if (fs.existsSync("./modules/" + moduleName + "/bot.js")) {
        const module = require("./modules/" + moduleName + "/bot")(client);
        client.modules[moduleName] = module;
        if (moduleInfo.hasOwnProperty("textCommands")) {
            for (const textCommand of moduleInfo.textCommands) {
                if (client.textCommands.hasOwnProperty(textCommand)) {
                    log.error("BOT", "Startup Error: Duplicate text command \"" + textCommand + "\"");
                    process.exit(1);
                }
                client.textCommands[textCommand] = module.textCommand;
            }
        }
        log.info("BOT", "Module bot component for " + moduleName + " registered");
    }
}

client.once("ready", async () => {
    log.info("BOT", "Logged in and ready");
});

client.on("messageCreate", async message => {
    if (message.author.bot) return;
    if (message.content.startsWith(config.textCommandPrefix)) {
        let args = message.content.substr(config.textCommandPrefix.length).split(" ");
        if (client.textCommands.hasOwnProperty(args[0])) {
            try {
                client.textCommands[args[0]](message, args);
            } catch (error) {
                log.error("BOT", "Uncaught Error in text command " + args[0] + ": " + error.stack);
                return message.reply("There was an error while executing this command!");
            }
        }
    }
});

client.on("interactionCreate", async interaction => {
    if (interaction.isSelectMenu()) {
        log.info("BOT", "Recieved select menu interaction " + interaction.customId);
        const args = interaction.customId.split("-");
        const module = client.modules[args[0]];
        if (!module) return;

        try {
            await module.selection(interaction, args);
        } catch (error) {
            log.error("BOT", "Uncaught Error in selection for module " + args[0] + ": " + error.stack);
            let sendMessage = (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).bind(interaction);
            return sendMessage({content: "There was an error while executing this command!", ephemeral: true});
        }
    } else if (interaction.isButton()) {
        log.info("BOT", "Recieved button interaction " + interaction.customId);
        const args = interaction.customId.split("-");
        const module = client.modules[args[0]];
        if (!module) return;

        try {
            await module.button(interaction, args);
        } catch (error) {
            log.error("BOT", "Uncaught Error in button for module " + args[0] + ": " + error.stack);
            let sendMessage = (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).bind(interaction);
            return sendMessage({content: "There was an error while executing this command!", ephemeral: true});
        }
    } else if (interaction.type === InteractionType.ModalSubmit) {
        log.info("BOT", "Recieved modal submission " + interaction.customId);
        const args = interaction.customId.split("-");
        const module = client.modules[args[0]];
        if (!module) return;

        try {
            await module.modal(interaction, args);
        } catch (error) {
            log.error("BOT", "Uncaught Error in modal for module " + args[0] + ": " + error.stack);
            let sendMessage = (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).bind(interaction);
            return sendMessage({content: "There was an error while executing this command!", ephemeral: true});
        }
    }
});

client.login(config.botToken);

module.exports = client;