const {ChannelType, EmbedBuilder} = require("discord.js");
const log = require("../../logger");

function joinThread(thread) {
    if (thread.joined) return;
    log.debug("THREADWATCH", "New thread " + thread.name + " in #" + thread.parent.name + ", attempting to join");
    if (!thread.joinable) {
        log.error("THREADWATCH", "Missing permissions to join thread " + thread.name + " in #" + thread.parent.name);
        return;
    }
    thread.join().then(() => {
        log.info("THREADWATCH", "Joined thread " + thread.name + " in #" + thread.parent.name);
    }).catch(error => {
        log.error("THREADWATCH", "Unable to join thread " + thread.name + " in #" + thread.parent.name + ": " + error + "\n" + error.stack);
    });
}

module.exports = (bot, db) => {
    bot.on("ready", () => {
        bot.channels.cache.filter(x => x.isThread()).forEach(joinThread);
    });
    bot.on("threadCreate", joinThread);
    bot.on("threadListSync", threads => threads.forEach(joinThread));
    bot.on("threadUpdate", (oldThread, newThread) => {
        if (newThread.locked || newThread.archived) return;
        if (!oldThread.locked && !oldThread.archived) return;
        joinThread(newThread);
    });
    return {};
};