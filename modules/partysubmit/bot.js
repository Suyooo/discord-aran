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
    AttachmentBuilder
} = require("discord.js");
const Discord = require("discord.js");
const tinyurl = require("turl");
const imageHandler = require("./ocr/imageHandler");
const layout = require("./ocr/layout");
const reader = require("./ocr/reader");
const roleHandler = require("./role-handler");
const config = require("../../config");
const log = require("../../logger");
const partyConfig = require("./config");

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

    submissionMessage;
    submissionAttachmentMessage;
    submissionAttachmentUrl;
    submissionStatus = SubmissionState.EDITING;
    submissionTimeout;
    submissionShortLinkCache;
    submissionShortLinkLast;

    // --- OCR

    constructor(commandMessage, partyInfo) {
        log.debug("PARTYSUBMIT", "Starting submission for " + commandMessage.author.tag);
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
            log.error("PARTYSUBMIT", "ERROR while fetching messages: " + e.stack);
            throw "There was an error fetching your messages from Discord. You can try again, but if it still doesn't work, [please submit manually](" + (await this.makeFormLink(false)) + ")!";
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
                    .map(a => a.proxyURL);
                if (attachmentURLs.length > 0) this.imageList.push(...attachmentURLs);
            }
            if (m.embeds) {
                const embedURLs = m.embeds
                    .filter(e => e.data.thumbnail)
                    .map(e => e.data.thumbnail.proxy_url);
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

                this.readImageIndex = i;
                break;
            } catch (e) {
                log.error("PARTYSUBMIT", "ERROR handling image " + (i + 1) + ", continuing: " + e.stack);
                this.mvp = this.score = this.other = undefined;
            }
        }

        if (this.readImageIndex === undefined) {
            log.debug("PARTYSUBMIT", "Aborting: No result screen found");
            throw "I couldn't recognize any of your images as the Results Screen, sorry! (Is there a screen filter or something?)\n" +
            "[You can still submit this play manually with this link](" + (await this.makeFormLink(false)) + ") - you just have to fill in the numbers yourself.";
        } else {
            if (this.imageList.length > this.partyInfo.form.fields.images.length) {
                log.debug("PARTYSUBMIT", "Too many images, making check image");
                const urls = [this.imageList[this.readImageIndex], ...this.imageList.filter((_, li) => li !== this.readImageIndex)]
                    .slice(0, this.partyInfo.form.fields.images.length).map(u => u + "?width=160&height=90");
                try {
                    const image = await imageHandler.makeCollage(urls, 160, 90);
                    this.submissionAttachmentMessage = await (await bot.channels.resolve("863812003880370227")) // #trash_room on Suyooo's server
                        .send({
                            content: "Dumping an image here to use for a party submission. Don't mind me.",
                            files: [new AttachmentBuilder(image).setName("picked_images.png")]
                        })
                    this.submissionAttachmentUrl = this.submissionAttachmentMessage.attachments.first().proxyURL;
                } catch (e) {
                    log.error("PARTYSUBMIT", "ERROR handling too many image collage, continuing: " + e.stack);
                }
            }
            await this.updateEmbed();
        }
    }

    // --- Building Message

    getFormFields() {
        const fields = {};

        fields[this.partyInfo.form.fields.userTag] = this.commandMessage.author.tag;
        if (this.mvpIndex !== undefined) fields[this.partyInfo.form.fields.mvp] = this.partyInfo.mvps[this.mvpIndex].mvpName;
        if (this.score !== undefined) fields[this.partyInfo.form.fields.score] = this.score;
        if (this.other !== undefined && this.other !== "") fields[this.partyInfo.form.fields.other] = this.other;

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

    async makeFormLink(shorten) {
        const fields = this.getFormFields();
        const link = "https://docs.google.com/forms/d/e/" + this.partyInfo.form.id + "/viewform?"
            + Object.keys(fields).map(k => k + "=" + urlencode(fields[k])).join("&");

        if (link.length < 256 || !shorten) {
            return link;
        }
        if (link !== this.submissionShortLinkLast) {
            try {
                log.debug("PARTYSUBMIT", "Fetching short URL");
                this.submissionShortLinkCache = await tinyurl.shorten(link);
                this.submissionShortLinkLast = link;
            } catch (e) {
                return link.substring(0, 256);
            }
        }
        return this.submissionShortLinkCache;
    }

    async updateEmbed(interaction) {
        log.debug("PARTYSUBMIT", "Posting embed");
        let buttons = undefined;

        // Only show Other Value field if we have recognized 2nd MVP, and a third image exists if it is required
        const showOther = this.partyInfo.mvps[this.mvpIndex].readOther &&
            (!this.partyInfo.other.requiresThirdImage || this.imageList.length > 2);

        const embed = new EmbedBuilder()
            .setColor(partyConfig.embedColor)
            .setThumbnail(this.imageList[this.readImageIndex])
            .addFields(
                {
                    name: this.partyInfo.sameSongForMVPs ? "Participating in " + this.partyInfo.other.mvpName : "Song / MVP",
                    value: this.partyInfo.mvps[this.mvpIndex].mvpName,
                    inline: false
                },
                {
                    name: this.partyInfo.scoreLabel,
                    value: format(this.score),
                    inline: showOther
                }
            );
        if (showOther) {
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
                embed.setDescription("I found more images than needed - the images that will be submitted are shown below, please make sure they include everything you need!")
                    .setImage(this.submissionAttachmentUrl);
            }

            buttons = new ActionRowBuilder();
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId("partysubmit-submit-" + this.commandMessage.author.id)
                    .setLabel("Submit")
                    .setDisabled(this.other === undefined)
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId("partysubmit-score-" + this.commandMessage.author.id)
                    .setLabel("Edit " + this.partyInfo.scoreLabel)
                    .setStyle(ButtonStyle.Secondary)
            );
            if (showOther) {
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
                    .setURL(await this.makeFormLink(true))
                    .setLabel("Submit via Form")
                    .setStyle(ButtonStyle.Link)
            );
        } else if (this.submissionStatus === SubmissionState.SUBMITTED) {
            embed.setFooter({text: "Submission successful!"});
        } else {
            if (this.submissionStatus === SubmissionState.CANCELLED_USER) {
                embed.setFooter({text: "The automatic submission was cancelled, but you can still submit this play manually below."});
            } else {
                embed.setFooter({text: "The automatic submission timed out, but you can still submit this play manually below."});
            }
            buttons = new ActionRowBuilder();
            buttons.addComponents(
                new ButtonBuilder()
                    .setURL(await this.makeFormLink(true))
                    .setLabel("Submit via Form")
                    .setStyle(ButtonStyle.Link)
            );
        }

        if (interaction !== undefined) {
            await interaction.update({
                embeds: [embed], components: buttons ? [buttons] : []
            });
        } else if (this.submissionMessage !== undefined) {
            await this.submissionMessage.edit({
                embeds: [embed], components: buttons ? [buttons] : []
            });
        } else {
            this.submissionMessage = await this.commandMessage.reply({
                embeds: [embed], components: buttons ? [buttons] : []
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
                roleHandler.giveRewardRole(interaction.member);
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
            .setLabel("Optional - you can leave it empty and submit!")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("Not participating");

        if (this.other !== undefined && this.other !== "") {
            valueInput.setValue("" + this.other);
        }

        modal.addComponents(new ActionRowBuilder().addComponents([valueInput]));
        await interaction.showModal(modal);
    }

    async editOther(interaction) {
        const valueString = interaction.fields.getTextInputValue("value");
        log.debug("PARTYSUBMIT", interaction.user.tag + " editing their other value, submitted " + valueString);
        if (valueString === "") {
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

function startParty(bot) {
    // TODO: when databasing, load correct party config (in role-handler too)
    // TODO: possible to load seperate test config?
    log.info("PARTYSUBMIT", "Party goes live!");
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

    Object.keys(activeSubmissions).forEach(userId => delete activeSubmissions[userId]);
    partyTimeout = setTimeout(endParty, partyConfig.partyStart + 86580000 - Date.now()); // + 24 hours run time + 3 minute grace period
    roleHandler.startParty().then(() => checkRoles(bot));
}

function endParty() {
    log.info("PARTYSUBMIT", "Party has ended!");

    clearTimeout(partyTimeout);
    clearTimeout(partyRoleCheckTimeout);
    partyTimeout = undefined;
    partyRoleCheckTimeout = undefined;
}

function checkRoles(bot) {
    roleHandler.checkRoles(bot).finally(() => {
        if (partyTimeout !== undefined) {
            partyRoleCheckTimeout = setTimeout(() => checkRoles(bot), 60000); // 1 minute
        }
    });
}

module.exports = (bot) => {
    bot.on("ready", () => {
        startParty(bot); // TODO REMOVE
        if (partyConfig.partyStart + 86580000 < Date.now()) { // planned party not over yet (+ 24 hours run time + 3 minute grace period)
            if (partyConfig.partyStart <= Date.now()) { // start immediately if at least 3 minutes before party start time
                startParty(bot);
            } else {
                setTimeout(() => startParty(bot), partyConfig.partyStart - Date.now());
            }
        }
    });

    return {
        async textCommand(message, args) {
            if (args[0] === "submit") {
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
            } else if (args[1] === "cancel") {
                await submission.cancel(interaction);
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