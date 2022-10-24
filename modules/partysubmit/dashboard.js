const express = require("express");
const log = require("../../logger");
const getFormInfo = require("./tools/makeFormConfig");
const bodyParser = require("body-parser").urlencoded({extended: false});
const {GoogleSpreadsheet} = require("google-spreadsheet");
const creds = require("./google-credentials.json");
const partyConfig = require("./config.json");
const getPHash = require("./tools/getSongCoverHash");
const fs = require("fs");

module.exports = (bot, db) => {
    const router = express.Router();
    router.use(bot.auth.routerPartyOnly);

    /*
     * FRONTEND
     */

    router.get("/", (req, res, next) => {
        res.render("../modules/partysubmit/views/index", {config: fs.readFileSync("modules/partysubmit/config.json")});
    });

    router.post("/new", bodyParser, (req, res, next) => {
        let sifForm, sifasForm;
        try {
            sifForm = getFormInfo(req.body.sifFormPrefill);
        } catch (e) {
            res.send("There was an error creating the submission info from your SIF form link: " + e);
            log.error("PARTYSUBMIT", "ERROR reading form info from prefill link: " + e + "\n" + e.stack);
            return;
        }
        try {
            sifasForm = getFormInfo(req.body.sifasFormPrefill);
        } catch (e) {
            res.send("There was an error creating the submission info from your SIFAS form link: " + e);
            log.error("PARTYSUBMIT", "ERROR reading form info from prefill link: " + e + "\n" + e.stack);
            return;
        }

        log.info("PARTYSUBMIT", "Now logging into a sheet to set up config");
        const doc = new GoogleSpreadsheet(req.body.sheetId);
        doc.useServiceAccountAuth(creds).then(async () => {
            await doc.loadInfo();
            log.info("PARTYSUBMIT", "Logged into a sheet for setting up config");
            const settings = doc.sheetsByTitle["Settings"];
            await settings.loadCells();
            log.info("PARTYSUBMIT", "Loaded cells for setting up config, preparing setup page");

            const date = settings.getCellByA1("D3").formattedValue;
            const partyStart = Date.parse(date.substring(6) + "-" + date.substring(3, 5) + "-" + date.substring(0, 2)) - 9 * 60 * 60 * 1000;

            res.render("../modules/partysubmit/views/new", {
                partyStart,
                spreadsheetId: req.body.sheetId,
                embedColor: settings.getCellByA1("B18").value,
                sifForm: JSON.stringify(sifForm, null, 4),
                sifasForm: JSON.stringify(sifasForm, null, 4),
                sifSongA: settings.getCellByA1("B6").value,
                sifSongB: settings.getCellByA1("D6").value,
                sifasSongA: settings.getCellByA1("F6").value,
                sifasSongB: settings.getCellByA1("H6").value,
                sifFirstMvpOption: settings.getCellByA1("B6").value + " (Party Challenge & " + settings.getCellByA1("J3").value + ")",
                sifasFirstMvpOption: settings.getCellByA1("F6").value + " (Party Challenge & " + settings.getCellByA1("J6").value + ")",
                sifSecondMvp: settings.getCellByA1("B9").value,
                sifasSecondMvp: settings.getCellByA1("B12").value,
                sifSecondMvpOption: settings.getCellByA1("D6").value + " (Party Challenge & " + settings.getCellByA1("B9").value + ")",
                sifasSecondMvpOption: settings.getCellByA1("H6").value + " (Party Challenge & " + settings.getCellByA1("B12").value + ")",
                sifReadOther: !(settings.getCellByA1("J9").value),
                sifasReadOther: !(settings.getCellByA1("J12").value),
                sifModalLabel: settings.getCellByA1("F9").value,
                sifasModalLabel: settings.getCellByA1("F12").value,
                sifModalPrompt: "Your " + settings.getCellByA1("F9").value,
                sifasModalPrompt: "Your " + settings.getCellByA1("F12").value,
                sifThirdImage: settings.getCellByA1("F18").value != null,
                sifasThirdImage: settings.getCellByA1("H18").value != null
            });
        }).catch(e => {
            res.send("Error reading the spreadsheet: " + e);
            log.error("PARTYSUBMIT", "ERROR reading spreadsheet: " + e + "\n" + e.stack);
        });
    });

    /*
     * BACKEND
     */

    const baseConfig = JSON.stringify({
        "partyStart": 0,
        "spreadsheetId": "",
        "embedColor": "",
        "clearRewardRoleId": "",
        "controllerChannelId": "381590906475773953",
        "SIF": {
            "partyChannel": "832628579728752680",
            "testChannels": [
                "926146147913982003",
                "836582911134269510"
            ],
            "ocrHandler": 0,
            "scoreLabel": "Score",
            "sameSongForMVPs": false,
            "manualChallengeSelect": false,
            "mvps": [
                {
                    "mvpName": "",
                    "selectTitle": "",
                    "selectDescription": "",
                    "recognition": null,
                    "readOther": false
                },
                {
                    "mvpName": "",
                    "selectTitle": "",
                    "selectDescription": "",
                    "recognition": null,
                    "readOther": null
                }
            ],
            "minImages": 2,
            "other": {
                "mvpName": "",
                "label": "",
                "modalPrompt": "",
                "autoFillFunction": null,
                "required": false,
                "requiresThirdImage": null
            },
            "form": null
        },
        "SIFAS": {
            "partyChannel": "827558022078267462",
            "testChannels": [
                "832395917302169600",
                "891227747526012950"
            ],
            "ocrHandler": 1,
            "scoreLabel": "Voltage",
            "sameSongForMVPs": false,
            "manualChallengeSelect": false,
            "mvps": [
                {
                    "mvpName": "",
                    "selectTitle": "",
                    "selectDescription": "",
                    "recognition": null,
                    "readOther": false
                },
                {
                    "mvpName": "",
                    "selectTitle": "",
                    "selectDescription": "",
                    "recognition": null,
                    "readOther": null
                }
            ],
            "minImages": 2,
            "other": {
                "mvpName": "",
                "label": "",
                "modalPrompt": "",
                "autoFillFunction": null,
                "required": false,
                "requiresThirdImage": null
            },
            "form": null
        }
    });

    router.post("/create", bodyParser, async (req, res, next) => {
        log.info("PARTYSUBMIT", "Received config creation request");
        const config = JSON.parse(baseConfig);

        try {
            config.partyStart = parseInt(req.body.partyStart);
            config.spreadsheetId = req.body.spreadsheetId;
            config.embedColor = req.body.embedColor;
            config.clearRewardRoleId = req.body.clearRewardRoleId;

            log.info("PARTYSUBMIT", "Setting SIF config");
            config.SIF.mvps[0].mvpName = req.body.sifFirstMvpOption;
            try {
                config.SIF.mvps[0].recognition = [await getPHash(req.body.sifSongAUrl)];
            } catch (e) {
                res.send("There was an error download the album cover for SIF song A: " + e);
                log.error("PARTYSUBMIT", "ERROR while downloading album cover: " + e + "\n" + e.stack);
                return;
            }
            config.SIF.mvps[1].mvpName = req.body.sifSecondMvpOption;
            config.SIF.mvps[1].readOther = req.body.sifReadOther === "true";
            try {
                config.SIF.mvps[1].recognition = [await getPHash(req.body.sifSongBUrl)];
            } catch (e) {
                res.send("There was an error download the album cover for SIF song B: " + e);
                log.error("PARTYSUBMIT", "ERROR while downloading album cover: " + e + "\n" + e.stack);
                return;
            }
            config.SIF.other.mvpName = req.body.sifSecondMvp;
            config.SIF.other.label = req.body.sifModalLabel;
            config.SIF.other.modalPrompt = req.body.sifModalPrompt;
            if (req.body.sifAutofill) config.SIF.other.autoFillFunction = req.body.sifAutofill;
            config.SIF.other.requiresThirdImage = req.body.sifThirdImage === "true";
            config.SIF.form = JSON.parse(req.body.sifForm.replace(/\\"/g, "\""));

            log.info("PARTYSUBMIT", "Setting SIFAS config");
            config.SIFAS.mvps[0].mvpName = req.body.sifasFirstMvpOption;
            config.SIFAS.mvps[0].recognition = [req.body.sifasSongA];
            if (req.body.sifasSongAJaName) config.SIFAS.mvps[0].recognition.push(req.body.sifasSongAJaName);
            config.SIFAS.mvps[1].mvpName = req.body.sifasSecondMvpOption;
            config.SIFAS.mvps[1].readOther = req.body.sifasReadOther === "true";
            config.SIFAS.mvps[1].recognition = [req.body.sifasSongB];
            if (req.body.sifasSongBJaName) config.SIFAS.mvps[1].recognition.push(req.body.sifasSongBJaName);
            config.SIFAS.other.mvpName = req.body.sifasSecondMvp;
            config.SIFAS.other.label = req.body.sifasModalLabel;
            config.SIFAS.other.modalPrompt = req.body.sifasModalPrompt;
            if (req.body.sifasAutofill) config.SIFAS.other.autoFillFunction = req.body.sifasAutofill;
            config.SIFAS.other.requiresThirdImage = req.body.sifasThirdImage === "true";
            config.SIFAS.form = JSON.parse(req.body.sifasForm.replace(/\\"/g, "\""));
        } catch (e) {
            res.send("Something went wrong creating the config: " + e);
            log.error("PARTYSUBMIT", "ERROR while creating config: " + e + "\n" + e.stack);
            return;
        }

        log.info("PARTYSUBMIT", "Writing config");
        try {
            fs.writeFileSync("modules/partysubmit/config.json", JSON.stringify(config, null, 2));
            res.send("Success! Aran will now restart. The config should be active right away in the test channels, so give it a try.");
            res.end();
            log.info("PARTYSUBMIT", "Party config done, restarting");
            setTimeout(() => process.exit(0), 2000);
        } catch (e) {
            res.send("Something went wrong saving the config: " + e);
            log.error("PARTYSUBMIT", "ERROR while saving config: " + e + "\n" + e.stack);
        }
    });

    router.post("/edit", bodyParser, async (req, res, next) => {
        log.info("PARTYSUBMIT", "Received config edit request");

        let config;
        try {
            config = JSON.parse(req.body.json);
        } catch (e) {
            res.send("Something went wrong reading the config, might not be valid JSON: " + e);
            log.error("PARTYSUBMIT", "ERROR while reading edited config: " + e + "\n" + e.stack);
            return;
        }

        log.info("PARTYSUBMIT", "Writing config");
        try {
            fs.writeFileSync("modules/partysubmit/config.json", JSON.stringify(config, null, 2));
            res.send("Success! Aran will now restart. The config should be active right away in the test channels, so give it a try.");
            res.end();
            log.info("PARTYSUBMIT", "Party config done, restarting");
            setTimeout(() => process.exit(0), 2000);
        } catch (e) {
            res.send("Something went wrong saving the config: " + e);
            log.error("PARTYSUBMIT", "ERROR while saving config: " + e + "\n" + e.stack);
        }
    });

    return router;
}