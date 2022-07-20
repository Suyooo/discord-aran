const fs = require("fs");
const {Client, Collection, Intents} = require("discord.js");
const config = require("./config");
const log = require("./logger");

const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});

client.modules = {};
client.textCommands = {};
const moduleNames = fs.readdirSync("./modules");

for (const moduleName of moduleNames) {
    log.info("BOT", "Loading module " + moduleName);
    const moduleInfo = require("./modules/" + moduleName + "/info");
    if (fs.existsSync("./modules/" + moduleName + "/bot.js")) {
        const module = require("./modules/" + moduleName + "/bot")(client);
        client.modules[moduleName] = module;
        if (moduleInfo.hasOwnProperty("textCommands")) {
            for (const textCommand of moduleInfo.textCommands) {
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
    if (message.content.startsWith(config.textCommandPrefix)) {
        let args = message.content.substr(config.textCommandPrefix.length).split(" ");
        if (client.textCommands.hasOwnProperty(args[0])) {
            client.textCommands[args[0]](message, args);
        }
    }
});

client.on("interactionCreate", async interaction => {
    if (interaction.isSelectMenu()) {
        log.info("BOT","Recieved select menu interaction " + interaction.customId);
        const module = client.modules[interaction.customId.split("-")[0]];
        if (!module) return;

        try {
            await module.selection(interaction);
        } catch (error) {
            log.error("INTERACTION", "Uncaught Error in selection for module " + module + ": " + error.stack);
            let sendMessage = (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).bind(interaction);
            return sendMessage({content: "There was an error while executing this command!", ephemeral: true});
        }
    } else if (interaction.isButton()) {
        log.info("BOT","Recieved button interaction " + interaction.customId);
        const module = client.modules[interaction.customId.split("-")[0]];
        if (!module) return;

        try {
            await module.button(interaction);
        } catch (error) {
            log.error("INTERACTION", "Uncaught Error in button for module " + module + ": " + error.stack);
            let sendMessage = (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).bind(interaction);
            return sendMessage({content: "There was an error while executing this command!", ephemeral: true});
        }
    }
});

client.login(config.botToken);

module.exports = client;