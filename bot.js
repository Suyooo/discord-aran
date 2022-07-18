const fs = require("fs");
const {Client, Collection, Intents} = require("discord.js");
const config = require("./config");
const log = require("./logger");

const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});

client.modules = {};
const moduleNames = fs.readdirSync("./modules");

for (const moduleName of moduleNames) {
    if (fs.existsSync("./modules/" + moduleName + "/bot.js")) {
        client.modules[moduleName] = require("./modules/" + moduleName + "/bot")(client);
        log.info("BOT", "Loaded module " + moduleName);
    }
}

client.once("ready", async () => {
    log.info("BOT", "Logged in and ready");
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