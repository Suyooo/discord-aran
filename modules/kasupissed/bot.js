module.exports = (bot) => {
    bot.on("messageCreate", async message => {
        if (message.author.bot) return;
        const content = message.content.toLowerCase();
        if (content.indexOf("kasukasu") !== -1 || content.indexOf("ksks") !== -1 || content.indexOf("かすかす") !== -1 || content.indexOf("カスカス") !== -1) {
            message.react("762379674126778439").catch(()=>{});
        }
    });
    return {};
};