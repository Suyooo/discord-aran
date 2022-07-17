const fs = require("fs");
const {Client, Collection, Intents} = require("discord.js");
const config = require("./config");
const log = require("./logger");

const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]});

client.modules = new Collection();
const moduleNames = fs.readdirSync("./modules");

for (const moduleName of moduleNames) {
    const module = require("./modules/" + moduleName + "/bot")(client);
    client.modules.set(moduleName, module);
}

client.once("ready", async () => {
    log.info("BOT", "Ready!");
});

client.on("interactionCreate", async interaction => {
    if (interaction.isSelectMenu()) {
        const command = client.modules.get(interaction.customId.split("-")[0]);
        if (!command) return;

        try {
            await command.selection(interaction);
        } catch (error) {
            log.error("INTERACTION", "Uncaught Error in selection of command " + command + ": " + error.stack);
            let sendMessage = (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).bind(interaction);
            return sendMessage({content: "There was an error while executing this command!", ephemeral: true});
        }
    } else if (interaction.isButton()) {
        const command = client.modules.get(interaction.customId.split("-")[0]);
        if (!command) return;

        try {
            await command.button(interaction);
        } catch (error) {
            log.error("INTERACTION", "Uncaught Error in button of command " + command + ": " + error.stack);
            let sendMessage = (interaction.replied || interaction.deferred ? interaction.followUp : interaction.reply).bind(interaction);
            return sendMessage({content: "There was an error while executing this command!", ephemeral: true});
        }
    }
});

client.login(config.botToken);

module.exports = client;