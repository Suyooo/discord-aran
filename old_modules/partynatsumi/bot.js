const log = require("../../logger");
const config = require("../../config");
const {
    ButtonStyle,
    ButtonBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

let stop = false;

module.exports = (bot, db) => {
    const stonks = require("./stonks")(db);

    async function getNameForRank(userId, money) {
        return [(await bot.users.fetch(userId)).username, formatG(money)];
    }

    function cap(x, cap) {
        return (x > cap ? ">" + cap : x.toString());
    }

    function formatG(x) {
        // https://stackoverflow.com/a/2901298
        let parts = x.toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        return parts.join(".") + " G";
    }

    function jobButton(userId, disable) {
        const row = new ActionRowBuilder();
        row.addComponents(new ButtonBuilder()
            .setCustomId("partynatsumi-job-" + userId)
            .setStyle(ButtonStyle.Primary)
            .setLabel("Get A Part-Time Job")
            .setEmoji("🚲")
            .setDisabled(disable));
        return [row];
    }

    function stonkButtons(userId, stonk, owned, disable) {
        const row = new ActionRowBuilder();
        row.addComponents(new ButtonBuilder()
                .setCustomId("partynatsumi-sell-" + userId + "-" + stonk)
                .setStyle(ButtonStyle.Danger)
                .setLabel("Sell")
                .setDisabled(disable),
            new ButtonBuilder()
                .setCustomId("partynatsumi-sell10-" + userId + "-" + stonk)
                .setStyle(ButtonStyle.Danger)
                .setLabel("-10")
                .setDisabled(disable),
            new ButtonBuilder()
                .setCustomId("partynatsumi-owned")
                .setStyle(ButtonStyle.Secondary)
                .setLabel("" + owned)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId("partynatsumi-buy10-" + userId + "-" + stonk)
                .setStyle(ButtonStyle.Success)
                .setLabel("+10")
                .setDisabled(disable),
            new ButtonBuilder()
                .setCustomId("partynatsumi-buy-" + userId + "-" + stonk)
                .setStyle(ButtonStyle.Success)
                .setLabel("Buy")
                .setDisabled(disable));
        return [row];
    }

    async function doTradeUpdates(interaction, msg, i, args, newAmount, newMoney, messages, jobFinishMessage) {
        try {
            if (newAmount !== undefined) {
                if (interaction.user.dmChannel === null) await message.author.createDM();
                await Promise.all([
                    interaction.user.dmChannel.messages.fetch(messages[1]).then(msg => msg.edit({content: "Gs Owned: " + formatG(newMoney)})),
                    interaction.user.dmChannel.messages.fetch(messages[2 + i]).then(msg => msg.edit({components: stonkButtons(args[2], i, newAmount, false)}))
                ]);
                /*if (jobFinishMessage) {
                    interaction.user.dmChannel.messages.fetch(jobFinishMessage).then(msg => msg.delete()).catch(() => null);
                    await db.transaction(async transaction => {
                        const inv = await db.modules.partynatsumi.Inventory.findByPk(args[2], {
                            transaction,
                            lock: transaction.LOCK.UPDATE
                        });
                        inv.jobFinishMessage = null;
                        await inv.save({transaction});
                    });
                }*/
            }
            await interaction.editReply({content: msg});
        } catch (error) {
            log.error("PARTYNATSUMI", "Failed to do trade: " + error + "\n" + error.stack);
            interaction.editReply({
                content: "Something went wrong! Please ping Suyooo ASAP"
            }).catch(() => null);
        }
    }

    function endJob(user) {
        if (stop) return;
        db.transaction(async transaction => {
            const inv = await db.modules.partynatsumi.Inventory.findByPk(user.id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            const tip = Math.floor(Math.random() * 40) + 10;
            inv.jobTimeout = null;
            inv.money += 500 + tip;
            if (user.dmChannel === null) await user.createDM();
            user.dmChannel.messages.fetch(inv.messages[1]).then(msg => msg.edit({content: "Gs Owned: " + formatG(inv.money)}));
            //inv.jobFinishMessage = (await user.send("You have finished your part-time job and have been paid 500 G plus " + tip + " G in tips.")).id;
            const jobFinishMessage = await user.send("You have finished your part-time job and have been paid 500 G plus " + tip + " G in tips.");
            setTimeout(() => jobFinishMessage.delete().catch(() => null), 60000);
            await inv.save({transaction});
        }).catch(error => {
            log.error("PARTYNATSUMI", "Failed to end job: " + error + "\n" + error.stack);
            user.send({content: "Something went wrong! Please ping Suyooo ASAP"}).catch(() => null);
        });
    }

    bot.on("ready", async () => {
        const inventories = await db.transaction(transaction => db.modules.partynatsumi.Inventory.findAll({transaction}));
        for (const inv of inventories) {
            if (inv.jobTimeout) {
                const user = await bot.users.fetch(inv.userId);
                setTimeout(() => endJob(user), inv.jobTimeout - Date.now());
            }
        }
    });

    return {
        async textCommand(message, args) {
            if (args[0] === "ost") {
                if (stop || stonks.getTurn() >= 288) {
                    message.reply({
                        content: "The game is over!"
                    })
                    return;
                }
                const inv = await db.transaction(transaction => db.modules.partynatsumi.Inventory.findByPk(message.author.id, {transaction}));
                if (inv === null) {
                    const messages = [];
                    try {
                        messages.push(await message.author.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle("Welcome to Oninatsu Stonk Trading!")
                                    .setColor("#FF51C4")
                                    .setDescription("This is your personal control panel where you can trade stonks and keep track of your inventory.\n\nClick the -10 and +10 buttons to trade stonks in packs of ten, or the Sell and Buy to buy any other amount.\nIf you're low on Gs, you can also take a part-time job at Lber Eats. You won't be able to trade stonks for an hour, but you will gain 500 G from it.\n\nTo see the current stonk prices, [check the OST Page!](https://suyo.be/ost/)")
                            ]
                        }));
                        messages.push(await message.author.send({
                            content: "Gs Owned: 10 000 G",
                            components: jobButton(message.author.id, true)
                        }));
                        for (const i in stonks.STONK_LIST) {
                            messages.push(await message.author.send({
                                content: stonks.STONK_LIST[i][0] + " - " + stonks.STONK_LIST[i][1],
                                components: stonkButtons(message.author.id, i, 0, true)
                            }));
                        }
                    } catch (e) {
                        message.reply("Please allow DMs from this server so I can send you your stonk control panel! (Server Menu > Privacy Settings - you can deactivate the setting again after the Party!)");
                        return;
                    }
                    bot.guilds.fetch(config.sifcordGuildId)
                        .then(guild => guild.members.fetch(message.author.id))
                        .then(member => member.roles.add("891221604233773077", "Party Challenge"))
                        .catch(error => {
                            log.error("PARTYNATSUMI", "Failed to give role to player: " + error + "\n" + error.stack);
                            message.author.send({content: "One small problem - I couldn't give you your Natsumi birthday role. Let Staff know and we can give it to you that way!"}).catch(() => null);
                        });
                    await db.modules.partynatsumi.Inventory.create({
                        userId: message.author.id,
                        messages: messages.map(m => m.id)
                    })
                        .then(() => messages[1].edit({components: jobButton(message.author.id, false)}))
                        .then(() => messages.slice(2).map((msg, i) => msg.edit({components: stonkButtons(message.author.id, i, 0, false)})))
                        .catch(error => {
                            log.error("PARTYNATSUMI", "Failed to add player: " + error + "\n" + error.stack);
                            message.author.send({content: "Something went wrong! Please ping Suyooo ASAP"}).catch(() => null);
                        });

                }
            } else if (args[0] === "endostgame") {
                if (stonks.getTurn() < 288 && !(args.length > 1 && args[1] === "force")) {
                    message.reply("The game is not over yet...");
                    return;
                }
                if (await bot.auth.checkStaff(message.author.id)) {
                    log.info("PARTYNATSUMI", "Ending the game.");
                    message.reply("Selling all leftover stonks, please wait...");
                    const inventories = await db.transaction(transaction => db.modules.partynatsumi.Inventory.findAll({transaction}));
                    for (const inv of inventories) {
                        const user = await bot.users.fetch(inv.userId);
                        if (user.dmChannel === null) await user.createDM();
                        for (const msgId of inv.messages) {
                            user.dmChannel.messages.fetch(msgId).then(msg => msg.delete()).catch(() => null);
                        }
                        if (inv.jobFinishMessage) {
                            user.dmChannel.messages.fetch(inv.jobFinishMessage).then(msg => msg.delete()).catch(() => null);
                        }

                        for (const i in stonks.STONK_LIST) {
                            if (inv.stocks[i] > 0) {
                                await stonks.doTrade(inv.userId, i, undefined, inv.stocks[i]).catch(() => null);
                            }
                        }
                    }
                    message.reply("All stonks sold - the final rankings are now available!");
                }
                stop = true;
            } else if (args[0] === "fixost") {
                await db.transaction(async transaction => {
                    const inv = await db.modules.partynatsumi.Inventory.findByPk(message.author.id, {
                        transaction,
                        lock: transaction.LOCK.UPDATE
                    });
                    if (inv !== null) {
                        const messages = [inv.messages[0]];
                        messages.push((await message.author.send({
                            content: "Gs Owned: " + formatG(inv.money),
                            components: jobButton(message.author.id, false)
                        })).id);
                        for (const i in stonks.STONK_LIST) {
                            messages.push((await message.author.send({
                                content: stonks.STONK_LIST[i][0] + " - " + stonks.STONK_LIST[i][1],
                                components: stonkButtons(message.author.id, i, inv.stocks[i], false)
                            })).id);
                        }

                        if (message.author.dmChannel === null) await message.author.createDM();
                        for (const msgId of inv.messages) {
                            message.author.dmChannel.messages.fetch(msgId).then(msg => msg.delete()).catch(() => null);
                        }
                        if (inv.jobFinishMessage) {
                            message.author.dmChannel.messages.fetch(inv.jobFinishMessage).then(msg => msg.delete()).catch(() => null);
                        }

                        inv.messages = messages;
                        inv.jobFinishMessage = null;
                        await inv.save({transaction});
                    }
                });
            } else if (args[0] === "reloadoptions") {
                db.transaction(transaction => db.modules.partynatsumi.Option.findOne({transaction})).then(row => {
                    stonks.setOption(row);
                });
                message.reply("k done");
            } else if (args[0] === "cleartrading") {
                db.transaction(transaction => db.modules.partynatsumi.Option.findOne({transaction})).then(row => {
                    stonks.setOption(row);
                });
                message.reply("k done");
            }
        },
        async button(interaction, args) {
            if (stop || stonks.getTurn() >= 288) {
                interaction.reply({
                    content: "The game is over!",
                    ephemeral: true
                })
                return;
            }
            if (args[1] === "buy10" || args[1] === "sell10") {
                await interaction.deferReply({ephemeral: true});
                const i = parseInt(args[3]);
                stonks.doTrade(args[2], i, undefined, args[1] === "buy10" ? -10 : 10)
                    .then(([msg, newAmount, newMoney, messages, jobFinishMessage]) => doTradeUpdates(interaction, msg, i, args, newAmount, newMoney, messages, jobFinishMessage));
            } else if (args[1] === "job") {
                await interaction.deferReply({ephemeral: true});
                await db.transaction(async transaction => {
                    const inv = await db.modules.partynatsumi.Inventory.findByPk(interaction.user.id, {
                        transaction,
                        lock: transaction.LOCK.UPDATE
                    });
                    if (inv.jobTimeout) return inv;
                    inv.jobTimeout = Date.now() + 6 * stonks.INTERVAL; // 1 hour
                    await inv.save({transaction});
                    setTimeout(() => endJob(interaction.user), 6 * stonks.INTERVAL);
                    return inv
                }).then(async (inv) => {
                    await interaction.editReply({
                        content: "You're now doing some work for Lber Eats until <t:" + Math.floor(inv.jobTimeout / 1000) + ":T>."
                    });
                }).catch(error => {
                    log.error("PARTYNATSUMI", "Failed to start job: " + error + "\n" + error.stack);
                    interaction.editReply({
                        content: "Something went wrong! Please ping Suyooo ASAP"
                    }).catch(() => null);
                });
            } else {
                const i = parseInt(args[3]);
                const inv = await db.transaction(transaction => db.modules.partynatsumi.Inventory.findByPk(args[2], {transaction}));
                const price = stonks.getLatest()[i][4];
                if (inv.jobTimeout) {
                    interaction.reply({
                        content: "You're at your part-time job right now. You can't trade.",
                        ephemeral: true
                    }).catch(() => null);
                    return;
                } else if (args[1] === "sell" && inv.stocks[i] === 0) {
                    interaction.reply({
                        content: "You don't own any of this stonk.",
                        ephemeral: true
                    }).catch(() => null);
                    return;
                } else if (args[1] === "buy" && inv.money < price) {
                    interaction.reply({
                        content: "You don't have enough money to buy this.",
                        ephemeral: true
                    }).catch(() => null);
                    return;
                }
                const modal = new ModalBuilder()
                    .setCustomId("partynatsumi-" + args[1] + "-" + interaction.user.id + "-" + i + "-" + price)
                    .setTitle(stonks.STONK_LIST[i][0] + " @" + cap(price, 9999) + " G - You have "
                        + cap(inv.stocks[i], 99999) + " and " + cap(inv.money, 9999999) + " G");

                const valueInput = new TextInputBuilder()
                    .setCustomId("value")
                    .setLabel("How many do you want to " + args[1] + "?")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents([valueInput]));
                interaction.showModal(modal).catch(() => null);
            }
        },
        async modal(interaction, args) {
            if (stop || stonks.getTurn() >= 288) {
                interaction.reply({
                    content: "The game is over!",
                    ephemeral: true
                })
                return;
            }
            await interaction.deferReply({ephemeral: true});
            const valueString = interaction.fields.getTextInputValue("value");
            const value = parseInt(valueString, 10);
            if (Number.isNaN(value) || value < 0) {
                interaction.editReply({
                    content: "Please enter a valid number (integers ≥0 only)."
                }).catch(() => null);
                return;
            }

            const i = parseInt(args[3]);
            stonks.doTrade(args[2], i, parseInt(args[4]), args[1] === "buy" ? -value : value)
                .then(([msg, newAmount, newMoney, messages, jobFinishMessage]) => doTradeUpdates(interaction, msg, i, args, newAmount, newMoney, messages, jobFinishMessage));
        },
        getNameForRank
    }
};