const https = require("https");
const FormData = require("form-data");
const {
    ModalBuilder,
    ButtonBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonStyle,
    AttachmentBuilder,
    SelectMenuBuilder,
    SelectMenuOptionBuilder
} = require("discord.js");
const Discord = require("discord.js");
const imageHandler = require("./ocr/imageHandler");
const layout = require("./ocr/layout");
const reader = require("./ocr/reader");
const sheetHandler = require("./sheet-handler");
const docHandler = require("./doc-handler");
const config = require("../../config");
const log = require("../../logger");
const partyConfig = require("./config");

// TODO: give out MVP roles
// TODO: remove clear/MVP role timers
// TODO: remove reward emotes timer
// TODO: auto party-unstorage 15 minutes before
// TODO: auto party-unlock when a message gets pinned?

const SubmissionState = {
    EDITING: 0, SUBMITTED: 1, CANCELLED_USER: 2, CANCELLED_TIMEOUT: 3
}

const OcrHandler = {
    SIF: 0, SIFAS: 1
}

function format(x) {
    // https://stackoverflow.com/a/2901298
    let parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts.join(".");
}

function urlencode(s) {
    return encodeURIComponent(s).replace(/[!'()*]/g, function (c) {
        return '%' + c.charCodeAt(0).toString(16);
    });
}

class Submission {
    commandMessage;
    partyInfo;

    imageList;
    readImageIndex;
    mvpIndex;
    score;
    other;
    showOther = false;

    submissionMessage;
    submissionAttachmentMessage;
    submissionAttachmentUrl;
    submissionStatus = SubmissionState.EDITING;
    submissionTimeout;

    // --- OCR

    constructor(commandMessage, partyInfo) {
        log.info("PARTYSUBMIT", "Starting submission for " + commandMessage.author.tag);
        this.commandMessage = commandMessage;
        this.partyInfo = partyInfo;
    }

    async getImages(bot) {
        log.debug("PARTYSUBMIT", "Grabbing images");
        const cutoff = Date.now() - 900000; // 15 minutes
        let lastMessages;
        try {
            lastMessages =
                [...(await this.commandMessage.channel.messages.fetch(this.commandMessage.id ? {before: this.commandMessage.id} : undefined)).values()]
                    .filter((m) => (m.author && m.author.id === this.commandMessage.author.id && m.createdTimestamp > cutoff))
                    .sort((a, b) => b.createdTimestamp - a.createdTimestamp); // messages.fetch has no order guarantees
        } catch (e) {
            log.error("PARTYSUBMIT", "ERROR while fetching messages: " + e + "\n" + e.stack);
            throw "There was an error fetching your messages from Discord. You can try again, but if it still doesn't work, [please submit manually](" + (await this.makeFormLink()) + ")!";
        }
        lastMessages.unshift(this.commandMessage); // add images from this message to the list as well

        // Starting from the latest message, collect images
        let lastMessageTimestamp = undefined;
        this.imageList = [];
        for (const m of lastMessages) {
            if (this.imageList.length > 0) {
                // If we collected any images already, check for cutoffs:
                if (m.content === config.textCommandPrefix + "submit") {
                    // If there was a previous submission, keep the images seperated
                    break;
                }
                if (lastMessageTimestamp - m.createdTimestamp <= 60000) {
                    // If there's over one minute between messages, assume those are unrelated to the submission
                    break;
                }
            }

            if (m.attachments) {
                const attachmentURLs = [...m.attachments.values()]
                    .filter(a => a.contentType.startsWith("image/"))
                    .map(a => a.proxyURL + (a.width > 1280 ? "?width=1280&height=" + Math.floor(a.height * 1280 / a.width) : ""));
                if (attachmentURLs.length > 0) this.imageList.push(...attachmentURLs);
            }
            if (m.embeds) {
                const embedURLs = m.embeds
                    .filter(e => e.data.thumbnail)
                    .map(e => e.data.thumbnail.proxy_url + (e.data.thumbnail.width > 1280 ? "?width=1280&height=" + Math.floor(e.data.thumbnail.height * 1280 / e.data.thumbnail.width) : ""));
                if (embedURLs.length > 0) this.imageList.push(...embedURLs);
            }
            lastMessageTimestamp = m.createdTimestamp;
        }

        log.debug("PARTYSUBMIT", "Found images: " + this.imageList.join(" "));
        if (this.imageList.length < this.partyInfo.minImages) {
            log.debug("PARTYSUBMIT", "Aborting: Not enough images");
            throw (this.imageList.length === 0
                ? ("I couldn't find any messages with images from you posted in the last 15 minutes.")
                : ("A submission requires at least " + this.partyInfo.minImages + " images, but I only found " + this.imageList.length + " images you posted."))
            + " Please send all of the required screenshots together, then type `" + config.textCommandPrefix + "submit` to try again!";
        }
    }

    async doRecognition(bot) {
        log.debug("PARTYSUBMIT", "Starting recognition");
        for (let i = 0; i < this.imageList.length; i++) {
            try {
                const image = await imageHandler.loadImage(this.imageList[i]).catch(() => undefined);
                if (image === undefined) continue;
                let layouts, ocrHandler;

                if (this.partyInfo.ocrHandler === OcrHandler.SIF) {
                    ocrHandler = reader.SIF;
                    layouts = await layout.getLayoutSIFResult(image);
                    if (layouts === undefined) continue;
                } else if (this.partyInfo.ocrHandler === OcrHandler.SIFAS) {
                    ocrHandler = reader.SIFAS;
                    layouts = await layout.getLayoutSIFASResult(image);
                    if (layouts === undefined) continue;
                }

                this.score = await ocrHandler.score(image, layouts);
                // Rough Check: There was a score read and it's in a range that realistically is the actual score
                if (this.score === undefined || this.score <= 10000) {
                    this.score = undefined;
                    continue;
                }

                if (this.partyInfo.manualChallengeSelect) {
                    this.mvpIndex = undefined;
                } else {
                    if (this.partyInfo.sameSongForMVPs) {
                        if (this.partyInfo.other?.requiresThirdImage) {
                            this.mvpIndex = this.imageList.length > 2 ? 0 : 1;
                        } else {
                            this.mvpIndex = 0;
                        }
                    } else {
                        const lookup =
                            await ocrHandler.mvp(image, layouts, Object.keys(this.partyInfo.lookupMVPIndexByRecognitionCriteria));
                        this.mvpIndex = this.partyInfo.lookupMVPIndexByRecognitionCriteria[lookup];
                    }
                    if (this.partyInfo.mvps[this.mvpIndex].readOther && this.partyInfo.other?.autoFillFunction) {
                        this.other = await ocrHandler[this.partyInfo.other?.autoFillFunction](image, layouts);
                    }
                }

                this.readImageIndex = i;
                break;
            } catch (e) {
                log.error("PARTYSUBMIT", "ERROR handling image " + (i + 1) + ", continuing: " + e + "\n" + e.stack);
                this.mvp = this.score = this.other = undefined;
            }
        }

        if (this.readImageIndex === undefined) {
            log.debug("PARTYSUBMIT", "Aborting: No result screen found");
            throw "I couldn't recognize any of your images as the Results Screen, sorry! (Is there a screen filter or something? If not, feel free to ping so we can find out why it's not working!)\n" +
            "[You can still submit this play manually with this link](" + (await this.makeFormLink()) + ") - you just have to fill in the numbers yourself.";
        } else {
            if (this.imageList.length > this.partyInfo.form.fields.images.length) {
                log.debug("PARTYSUBMIT", "Too many images, making check image");
                const urls = [this.imageList[this.readImageIndex], ...this.imageList.filter((_, li) => li !== this.readImageIndex)]
                    .slice(0, this.partyInfo.form.fields.images.length).map(u => u.split("?")[0] + "?width=160&height=90");
                try {
                    const image = await imageHandler.makeCollage(urls, 160, 90);
                    this.submissionAttachmentMessage = await (await bot.channels.resolve("863812003880370227")) // #trash_room on Suyooo's server
                        .send({
                            content: "Dumping an image here to use for a party submission. Don't mind me.",
                            files: [new AttachmentBuilder(image).setName("picked_images.png")]
                        })
                    this.submissionAttachmentUrl = this.submissionAttachmentMessage.attachments.first().proxyURL;
                } catch (e) {
                    log.error("PARTYSUBMIT", "ERROR handling too many image collage, continuing: " + e + "\n" + e.stack);
                }
            }

            // Only show Other Value field if we have recognized 2nd MVP, and a third image exists if it is required
            this.showOther = this.partyInfo.mvps[this.mvpIndex || 0].readOther &&
                (!this.partyInfo.other.requiresThirdImage || this.imageList.length > 2);

            await this.updateEmbed();
        }
    }

    // --- Building Message

    getFormFields() {
        const fields = {};

        fields[this.partyInfo.form.fields.userTag] = this.commandMessage.author.tag;
        if (this.mvpIndex !== undefined) fields[this.partyInfo.form.fields.mvp] = this.partyInfo.mvps[this.mvpIndex].mvpName;
        if (this.score !== undefined) fields[this.partyInfo.form.fields.score] = this.score;
        if (this.showOther && this.other !== undefined && this.other !== "") fields[this.partyInfo.form.fields.other] = this.other;

        if (this.readImageIndex !== undefined) fields[this.partyInfo.form.fields.images[0]] = this.imageList[this.readImageIndex];
        let j = 0;
        for (let i = this.readImageIndex !== undefined ? 1 : 0; i < this.partyInfo.form.fields.images.length; i++) {
            if (j === this.readImageIndex) j++;
            if (j >= this.imageList.length) break;
            fields[this.partyInfo.form.fields.images[i]] = this.imageList[j];
            j++;
        }

        return fields;
    }

    async makeFormLink() {
        const fields = this.getFormFields();
        return "https://docs.google.com/forms/d/e/" + this.partyInfo.form.id + "/viewform?"
            + Object.keys(fields).map(k => k + "=" + urlencode(fields[k])).join("&");
    }

    async updateEmbed(interaction) {
        log.debug("PARTYSUBMIT", "Posting embed");
        const componentArray = [];

        const embed = new EmbedBuilder()
            .setColor(partyConfig.embedColor)
            .setThumbnail(this.imageList[this.readImageIndex])
            .addFields(
                {
                    name: this.partyInfo.manualChallengeSelect
                        ? "Challenge"
                        : (this.partyInfo.sameSongForMVPs
                            ? "Participating in " + this.partyInfo.other.mvpName
                            : "Song / MVP"),
                    value: this.partyInfo.mvps[this.mvpIndex]?.mvpName || "**Please select!**",
                    inline: false
                },
                {
                    name: this.partyInfo.scoreLabel,
                    value: format(this.score),
                    inline: this.showOther
                }
            );
        if (this.showOther) {
            embed.addFields(
                {
                    name: this.partyInfo.other.label,
                    value: this.other !== undefined ? (this.other !== "" ? format(this.other) : "---") : "**Please enter!**",
                    inline: true
                }
            );
        }

        if (this.submissionStatus === SubmissionState.EDITING) {
            embed.setFooter({text: "If the MVP or images are wrong, click \"Submit via Form\" to edit everything!"});
            if (this.submissionAttachmentUrl !== undefined) {
                embed.setDescription("I found more images than needed - the images that will be submitted are shown below, please make sure they include everything you need and the values are right!")
                    .setImage(this.submissionAttachmentUrl);
            } else if (this.other === undefined && this.showOther) {
                embed.setDescription("Please double-check the values I've read and enter the missing ones! (Your submission doesn't count until you enter everything needed and hit Confirm!)")
            } else {
                embed.setDescription("Please double-check the values I've read! (Your submission doesn't count until you hit Confirm!)")
            }

            if (this.mvpIndex === undefined) {
                const selector = new ActionRowBuilder();
                selector.addComponents(new SelectMenuBuilder()
                    .setCustomId("partysubmit-mvp-" + this.commandMessage.author.id)
                    .setPlaceholder("Select Challenge")
                    .setOptions(
                        [...this.partyInfo.mvps.map((mvp, i) => new SelectMenuOptionBuilder()
                            .setLabel(mvp.selectTitle)
                            .setDescription(mvp.selectDescription)
                            .setValue(i.toString()))]
                    )
                );
                componentArray.push(selector);
            }

            const buttons = new ActionRowBuilder();
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId("partysubmit-submit-" + this.commandMessage.author.id)
                    .setLabel("Confirm")
                    .setDisabled(this.mvpIndex === undefined || (this.other === undefined && this.showOther))
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId("partysubmit-score-" + this.commandMessage.author.id)
                    .setLabel("Edit " + this.partyInfo.scoreLabel)
                    .setStyle(ButtonStyle.Secondary)
            );
            if (this.showOther) {
                buttons.addComponents(
                    new ButtonBuilder()
                        .setCustomId("partysubmit-other-" + this.commandMessage.author.id)
                        .setLabel("Edit " + this.partyInfo.other.label)
                        .setStyle(this.other === undefined ? ButtonStyle.Primary : ButtonStyle.Secondary)
                );
            }
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId("partysubmit-cancel-" + this.commandMessage.author.id)
                    .setLabel("Cancel")
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId("partysubmit-form-" + this.commandMessage.author.id)
                    .setLabel("Submit via Form")
                    .setStyle(ButtonStyle.Secondary)
            );
            componentArray.push(buttons);
        } else if (this.submissionStatus === SubmissionState.SUBMITTED) {
            embed.setFooter({text: "Submission successful!"});
        } else {
            if (this.submissionStatus === SubmissionState.CANCELLED_USER) {
                embed.setDescription("The automatic submission was cancelled, but [you can still submit this play manually with this link](" + (await this.makeFormLink()) + ").");
            } else {
                embed.setDescription("The automatic submission timed out, but [you can still submit this play manually with this link](" + (await this.makeFormLink()) + ").");
            }
        }

        if (interaction !== undefined) {
            await interaction.update({
                embeds: [embed], components: componentArray
            });
        } else if (this.submissionMessage !== undefined) {
            await this.submissionMessage.edit({
                embeds: [embed], components: componentArray
            });
        } else {
            this.submissionMessage = await this.commandMessage.reply({
                embeds: [embed], components: componentArray
            });
        }
    }

    // --- User Interactions

    async submit(interaction) {
        log.debug("PARTYSUBMIT", interaction.user.tag + " requested to submit their submission");

        const fields = this.getFormFields();
        const form = new FormData();
        for (const k in fields) {
            form.append(k, fields[k]);
        }

        form.submit({
            protocol: "https:",
            port: 443,
            host: "docs.google.com",
            path: "/forms/u/0/d/e/" + this.partyInfo.form.id + "/formResponse"
        }, function (err, res) {
            if (err === null && res.statusCode === 200) {
                this.submissionStatus = SubmissionState.SUBMITTED;
                this.destroy(interaction);
                sheetHandler.giveRewardRole(interaction.member);
            } else {
                log.error("PARTYSUBMIT", "ERROR submitting form: Status Code " + res.statusCode + " " + res.statusMessage);
                interaction.reply({
                    content: "There was an error sending your submission. You can try again, but if it still doesn't work, please submit via the form!",
                    ephemeral: true
                });
                this.updateEmbed();
            }
        }.bind(this));
    }

    async editMvp(interaction) {
        const valueString = interaction.values[0];
        log.debug("PARTYSUBMIT", interaction.user.tag + " editing their MVP, submitted " + valueString);
        const value = parseInt(valueString, 10);
        if (Number.isNaN(value) || value < 0 || value >= this.partyInfo.mvps.length) {
            await interaction.reply({
                content: "You made an invalid selection. (huh!?!?!?)",
                ephemeral: true
            });
        } else {
            this.mvpIndex = value;
            await this.updateEmbed(interaction);
        }
    }

    async openScoreModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("partysubmit-score-" + this.commandMessage.author.id)
            .setTitle("Your " + this.partyInfo.scoreLabel);

        const valueInput = new TextInputBuilder()
            .setCustomId("value")
            .setLabel("Your " + this.partyInfo.scoreLabel)
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        if (this.score !== undefined) {
            valueInput.setValue("" + this.score);
        }

        modal.addComponents(new ActionRowBuilder().addComponents([valueInput]));
        await interaction.showModal(modal);
    }

    async editScore(interaction) {
        const valueString = interaction.fields.getTextInputValue("value");
        log.debug("PARTYSUBMIT", interaction.user.tag + " editing their score, submitted " + valueString);
        const value = parseInt(valueString, 10);
        if (Number.isNaN(value) || value < 0) {
            await interaction.reply({
                content: "Please enter a valid number (integers ≥0 only).",
                ephemeral: true
            });
        } else {
            this.score = value;
            await this.updateEmbed(interaction);
        }
    }

    async openOtherModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId("partysubmit-other-" + this.commandMessage.author.id)
            .setTitle(this.partyInfo.other.modalPrompt);

        const valueInput = new TextInputBuilder()
            .setCustomId("value")
            .setLabel(this.partyInfo.other.required ? this.partyInfo.other.modalPrompt : "Optional - you can leave it empty and submit!")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder(this.partyInfo.other.required ? "Please enter" : "Not participating");

        if (this.other !== undefined && this.other !== "") {
            valueInput.setValue("" + this.other);
        }

        modal.addComponents(new ActionRowBuilder().addComponents([valueInput]));
        await interaction.showModal(modal);
    }

    async editOther(interaction) {
        const valueString = interaction.fields.getTextInputValue("value");
        log.debug("PARTYSUBMIT", interaction.user.tag + " editing their other value, submitted " + valueString);
        if (valueString === "" && !this.partyInfo.other.required) {
            this.other = "";
            await this.updateEmbed(interaction);
            return;
        }

        const value = parseInt(valueString, 10);
        if (Number.isNaN(value) || value < 0) {
            await interaction.reply({
                content: "Please enter a valid number (integers ≥0 only) or leave the field empty.",
                ephemeral: true
            });
        } else {
            this.other = value;
            await this.updateEmbed(interaction);
        }
    }

    async sendFormLink(interaction) {
        interaction.reply({
            content: "[Here's your form link!](" + (await this.makeFormLink()) + ")",
            ephemeral: true
        });
    }

    async cancel(interaction) {
        this.submissionStatus = interaction ? SubmissionState.CANCELLED_USER : SubmissionState.CANCELLED_TIMEOUT;
        await this.destroy(interaction);
    }

    async destroy(interaction) {
        clearTimeout(this.submissionTimeout);
        this.submissionTimeout = undefined;
        if (this.submissionAttachmentMessage !== undefined) {
            this.submissionAttachmentMessage.delete().catch(() => null);
        }
        delete activeSubmissions[this.commandMessage.author.id];
        await this.updateEmbed(interaction);
    }
}

const activeSubmissions = {};
const roleHavers = new Set();
let partyTimeout = undefined;
let partyRoleCheckTimeout = undefined;
let partyActivityTimeout = undefined;

// Prepare some indexes
partyConfig.lookupConfigByChannelId = {
    [partyConfig.SIF.testChannels[0]]: partyConfig.SIF,
    [partyConfig.SIF.testChannels[1]]: partyConfig.SIF,
    [partyConfig.SIF.partyChannel]: partyConfig.SIF,
    [partyConfig.SIFAS.testChannels[0]]: partyConfig.SIFAS,
    [partyConfig.SIFAS.testChannels[1]]: partyConfig.SIFAS,
    [partyConfig.SIFAS.partyChannel]: partyConfig.SIFAS
};
partyConfig.isTestChannel = {
    [partyConfig.SIF.testChannels[0]]: true,
    [partyConfig.SIF.testChannels[1]]: true,
    [partyConfig.SIF.partyChannel]: false,
    [partyConfig.SIFAS.testChannels[0]]: true,
    [partyConfig.SIFAS.testChannels[1]]: true,
    [partyConfig.SIFAS.partyChannel]: false
};
partyConfig.SIF.lookupMVPIndexByRecognitionCriteria = {};
for (const mvpIndex in partyConfig.SIF.mvps) {
    for (const r of partyConfig.SIF.mvps[mvpIndex].recognition) {
        partyConfig.SIF.lookupMVPIndexByRecognitionCriteria[r] = mvpIndex;
    }
}
partyConfig.SIFAS.lookupMVPIndexByRecognitionCriteria = {};
for (const mvpIndex in partyConfig.SIFAS.mvps) {
    for (const r of partyConfig.SIFAS.mvps[mvpIndex].recognition) {
        partyConfig.SIFAS.lookupMVPIndexByRecognitionCriteria[r] = mvpIndex;
    }
}

function startParty(bot, post) {
    // TODO: when databasing, load correct party config (in role-handler too)
    // TODO: possible to load seperate test config?
    Object.keys(activeSubmissions).forEach(userId => delete activeSubmissions[userId]);
    partyTimeout = setTimeout(() => endParty(bot), partyConfig.partyStart + 86580000 - Date.now()); // + 24 hours run time + 3 minute grace period
    sheetHandler.startParty().then(() => {
        checkRoles(bot);
        if (post) {
            docHandler.getPosts().then(({sifPosts, sifasPosts}) => Promise.all([
                sendChallengePosts(bot, bot.channels.resolve(partyConfig.SIF.partyChannel), sifPosts, "unlockSIFParty"),
                sendChallengePosts(bot, bot.channels.resolve(partyConfig.SIFAS.partyChannel), sifasPosts, "unlockSIFASParty")
            ])).catch(e => {
                bot.channels.resolve(partyConfig.controllerChannelId)
                    .send({
                        content: "**Unable to automatically send challenge posts** - " +
                            "someone please manually copypaste them from the doc in the pinned sheet and open the Party channels! @here\n\n" +
                            "The problem reported was:\n" + e.message,
                        allowedMentions: {parse: ['users', 'roles']}
                    });
            });
        }
    });
    playSIF(bot);
}

async function sendChallengePosts(bot, channel, posts, unlockMethod) {
    // Open first to make sure ping goes through
    await bot.modules.channelopen[unlockMethod](bot, bot.user);

    const messages = [];
    for (const post of posts) {
        messages.push(await channel.send({content: post, allowedMentions: {parse: ['users', 'roles']}}));
    }

    // Make sure there is enough pin space
    const pins = (await channel.messages.fetchPinned());
    if (pins.size + messages.length > 50) {
        await Promise.all([...pins.values()]
            .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
            .slice(0, pins.size + messages.length - 50)
            .map(m => m.unpin("Making space for new Party challenge posts")));
    }
    for (let i = messages.length - 1; i >= 0; i--) {
        await messages[i].pin();
    }
}

function endParty(bot) {
    log.info("PARTYSUBMIT", "1st grace period over, not accepting new automatic submissions");

    clearTimeout(partyTimeout);
    partyTimeout = undefined;
    clearTimeout(partyRoleCheckTimeout);
    clearTimeout(partyActivityTimeout);
    bot.user.setActivity(null);
    partyRoleCheckTimeout = undefined;

    new Promise(resolve => {
        setTimeout(resolve, 120000); // 2 minute grace period for clicking submit
    }).then(() => sheetHandler.endParty(bot.channels.resolve(partyConfig.controllerChannelId)));
}

function checkRoles(bot) {
    sheetHandler.checkRoles(bot).finally(() => {
        if (partyTimeout !== undefined) {
            partyRoleCheckTimeout = setTimeout(() => checkRoles(bot), 60000); // 1 minute
        }
    });
}

function playSIF(bot) {
    if (partyTimeout === undefined) return;
    bot.user.setActivity("#sif_party");
    partyActivityTimeout = setTimeout(() => playSIFAS(bot), 60000);
}

function playSIFAS(bot) {
    if (partyTimeout === undefined) return;
    bot.user.setActivity("#sifas_party");
    partyActivityTimeout = setTimeout(() => playSIF(bot), 60000);
}

module.exports = (bot, db) => {
    bot.on("ready", () => {
        /*sheetHandler.startParty()
            .then(() => sheetHandler.checkRoles(bot))
            .then(() => sheetHandler.endParty(bot.channels.resolve(partyConfig.controllerChannelId)))
            .then(() => process.exit(0));*/
        if (partyConfig.partyStart + 86580000 >= Date.now()) { // planned party not over yet (+ 24 hours run time + 3 minute grace period)
            if (partyConfig.partyStart - 60000 <= Date.now()) { // start immediately if at least 1 minute before party start time
                log.info("PARTYSUBMIT", "Party is already running");
                startParty(bot, false);
            } else {
                setTimeout(() => {
                    log.info("PARTYSUBMIT", "Party goes live!");
                    startParty(bot, true);
                }, partyConfig.partyStart - Date.now());
                if (partyConfig.partyStart - 1800000 >= Date.now()) { // 30 minutes before start, dry-run challenge posts
                    setTimeout(async () => {
                        await sheetHandler.startParty();
                        log.info("PARTYSUBMIT", "Testing challenge posts");
                        docHandler.getPosts().then(({sifPosts, sifasPosts}) =>
                            bot.channels.resolve(partyConfig.controllerChannelId).send({
                                content: "Challenge Posts have been checked, seems good and ready to go <:ChikaThumbsUp:823272752277356595>"
                            })).catch(e => {
                            bot.channels.resolve(partyConfig.controllerChannelId).send({
                                content: "There are still problems with the Challenge Posts. If you want the posts to be automatic, please fix them in the next 30 minutes! (Or I'll ping everyone)\n\n" +
                                    "The problem reported was:\n" + e.message
                            });
                        });
                    }, partyConfig.partyStart - 1800000 - Date.now());
                }
            }
        }
    });

    return {
        async textCommand(message, args) {
            if (message.channel.id === partyConfig.oogPartyChannel) {
                message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(partyConfig.embedColor)
                        .setDescription("[Use this link to submit for the OOG Party!](" + partyConfig.oogFormLink + ")\nIf you want to submit your game score, head to the game's respective party channel - you can submit them there!")]
                });
                return;
            }

            const partyInfo = partyConfig.lookupConfigByChannelId[message.channel.id];
            if (partyInfo !== undefined && (partyTimeout !== undefined || partyConfig.isTestChannel[message.channel.id])) {
                if (activeSubmissions.hasOwnProperty(message.author.id)) {
                    message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(partyConfig.embedColor)
                            .setDescription("You already have a submission in progress. Please submit or cancel that one first! (If you submitted manually via the form, you'll have to cancel the automatic submission.)")]
                    });
                } else {
                    await message.channel.sendTyping();
                    const submission = new Submission(message, partyInfo);
                    submission.getImages(bot).then(() => submission.doRecognition(bot))
                        .then(() => {
                            activeSubmissions[message.author.id] = submission;
                            submission.submissionTimeout = setTimeout(() => submission.cancel(undefined), 900000); // 15 minutes
                        })
                        .catch((err) => {
                            message.reply({
                                embeds: [new EmbedBuilder()
                                    .setColor(partyConfig.embedColor)
                                    .setDescription(err)]
                            });
                        });
                }
            }
        },
        async button(interaction, args) {
            if (args[2] !== interaction.user.id) {
                interaction.reply({
                    content: "This is not your submission.",
                    ephemeral: true
                });
                return;
            }
            const submission = activeSubmissions[interaction.user.id];
            if (submission === undefined) {
                interaction.reply({
                    content: "This submission has timed out.",
                    ephemeral: true
                });
                return;
            }

            if (args[1] === "submit") {
                await submission.submit(interaction);
            } else if (args[1] === "score") {
                await submission.openScoreModal(interaction);
            } else if (args[1] === "other") {
                await submission.openOtherModal(interaction);
            } else if (args[1] === "form") {
                await submission.sendFormLink(interaction);
            } else if (args[1] === "cancel") {
                await submission.cancel(interaction);
            }
        },
        async selection(interaction, args) {
            if (args[2] !== interaction.user.id) {
                interaction.reply({
                    content: "This is not your submission.",
                    ephemeral: true
                });
                return;
            }
            const submission = activeSubmissions[interaction.user.id];
            if (submission === undefined) {
                interaction.reply({
                    content: "This submission has timed out.",
                    ephemeral: true
                });
                return;
            }

            if (args[1] === "mvp") {
                await submission.editMvp(interaction);
            }
        },
        async modal(interaction, args) {
            if (args[2] !== interaction.user.id) {
                interaction.reply({
                    content: "This is not your submission.",
                    ephemeral: true
                });
                return;
            }
            const submission = activeSubmissions[interaction.user.id];
            if (submission === undefined) {
                interaction.reply({
                    content: "This submission has timed out.",
                    ephemeral: true
                });
                return;
            }

            if (args[1] === "score") {
                await submission.editScore(interaction);
            } else if (args[1] === "other") {
                await submission.editOther(interaction);
            }
        }
    };
};