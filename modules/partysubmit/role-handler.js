const {GoogleSpreadsheet} = require("google-spreadsheet");
const creds = require("./google-credentials.json");
const partyConfig = require("./config");
const config = require("../../config");
const log = require("../../logger");

let frontSheet = undefined;
const winnerCellAddrList = ["G12", "B12", "L12"]; // SIF, SIFAS, OOG
let settingsSheet = undefined;
const formsCloseCellAddr = "J18";
const mvpNameCellAddrList = ["J3", "B9", "J6", "B12"]; // SIF A, SIF B, SIFAS A, SIFAS B
let rankingsSheet = undefined;
const topCellAddrList = ["B7:D9", "G7:I9", "L7:N9", "Q7:S9"]; // SIF A, SIF B, SIFAS A, SIFAS B
let knownRoleHavers = new Set();

function startParty() {
    let doc = new GoogleSpreadsheet(partyConfig.spreadsheetId);
    return doc.useServiceAccountAuth(creds).then(async () => {
        await doc.loadInfo();
    }).then(() => {
        log.info("PARTYSUBMIT", "Logged into sheet for party");
        frontSheet = doc.sheetsByTitle["Collection of Info and Stuff"];
        settingsSheet = doc.sheetsByTitle["Settings"];
        rankingsSheet = doc.sheetsByTitle["Public View Data Transmission"];
        knownRoleHavers.clear();
    });
}

function endParty(controllerChannel) {
    return settingsSheet.loadCells(formsCloseCellAddr).then(() => {
        const cell = settingsSheet.getCellByA1(formsCloseCellAddr);
        cell.value = false;
        return settingsSheet.saveUpdatedCells().then(() => {
            return new Promise(resolve => {
                setTimeout(resolve, 10000); // 10 second wait for form closing
            }).then(async () => {
                await Promise.all([
                    frontSheet.loadCells(winnerCellAddrList),
                    settingsSheet.loadCells(mvpNameCellAddrList),
                    rankingsSheet.loadCells(topCellAddrList)
                ]);
                // send finish message
                let msg = "Party has ended, forms have been closed. After you posted the results, please finish the Party by going to the sheet and using SIFcord Party => Finish Party menu option!\n\nHere's some stuff to copypaste into the writing doc!\n\n";
                msg += "SIF Clears\n```";
                msg += await makeMentionList(controllerChannel.guild, winnerCellAddrList[0]);
                msg += "```\n\nSIFAS Clears\n```";
                msg += await makeMentionList(controllerChannel.guild, winnerCellAddrList[1]);
                msg += "```\n\nOOG Players\n```";
                msg += await makeMentionList(controllerChannel.guild, winnerCellAddrList[2]);
                msg += "```\n\nSIF MVPs **(unverified - please check before posting!)**\n```";
                msg += await makeMVPList(controllerChannel.guild, mvpNameCellAddrList[0], topCellAddrList[0].substr(0,1), topCellAddrList[0].substr(3,1));
                msg += "\n\n";
                msg += await makeMVPList(controllerChannel.guild, mvpNameCellAddrList[1], topCellAddrList[1].substr(0,1), topCellAddrList[1].substr(3,1));
                msg += "```\n\nSIFAS MVPs **(unverified - please check before posting!)**\n```";
                msg += await makeMVPList(controllerChannel.guild, mvpNameCellAddrList[2], topCellAddrList[2].substr(0,1), topCellAddrList[2].substr(3,1));
                msg += "\n\n";
                msg += await makeMVPList(controllerChannel.guild, mvpNameCellAddrList[3], topCellAddrList[3].substr(0,1), topCellAddrList[3].substr(3,1));
                msg += "```";
                await controllerChannel.send(msg);
            });
        });
    });
}

async function makeMentionList(guild, cellAddr) {
    const cell = frontSheet.getCellByA1(cellAddr);
    if (cell.value == null) return "";
    const clearers = [];
    for (const clearer of cell.value.split(", ")) {
        const member = await findMemberByTag(guild, clearer.substring(1));
        clearers.push(member.toString());
    }
    return clearers.join(", ");
}

async function makeMVPList(guild, mvpNameCellAddr, rankingUserColumn, rankingValueColumn) {
    const nameCell = settingsSheet.getCellByA1(mvpNameCellAddr);
    const top = [];
    for (let row = 7; row <= 9; row++) {
        const member = await findMemberByName(guild, settingsSheet.getCellByA1(rankingUserColumn + row).value);
        top.push((row === 7 ? "1st" : (row === 8 ? "2nd" : "3rd")) + ": " + (member ? member.toString() : "??")
            + " (" + settingsSheet.getCellByA1(rankingValueColumn + row).value + ")");
    }
    return "**" + nameCell.value + "**: " + top.join("\n");
}

function giveRewardRole(member) {
    if (member !== undefined && !knownRoleHavers.has(member.user.tag)) {
        log.info("PARTYSUBMIT", "Awarding reward role to " + member.user.tag);
        member.roles.add(partyConfig.clearRewardRoleId, "Party Challenge cleared")
            .then(() => knownRoleHavers.add(member.user.tag))
            .catch(() => null);
    }
}

function checkRoles(bot) {
    frontSheet.resetLocalCache(true);
    return frontSheet.loadCells(winnerCellAddrList).then(() => {
        const clearers = new Set();
        for (const cellAddr of winnerCellAddrList) {
            const cell = frontSheet.getCellByA1(cellAddr);
            if (cell.value == null) continue;
            for (const clearer of cell.value.split(", ")) {
                clearers.add(clearer.substring(1));
            }
        }

        const addRole = new Set([...clearers].filter(x => !knownRoleHavers.has(x)));
        const removeRole = new Set([...knownRoleHavers].filter(x => !clearers.has(x)));

        knownRoleHavers = clearers;
        return (async function () {
            return [await bot.guilds.fetch(config.sifcordGuildId), addRole, removeRole];
        })();
    }).then(([guild, addRole, removeRole]) => {
        const p = [];
        for (const add of addRole) {
            p.push(findMemberByTag(guild, add).then((member) => {
                if (member !== undefined) {
                    log.info("PARTYSUBMIT", "Awarding reward role to " + member.user.tag);
                    member.roles.add(partyConfig.clearRewardRoleId, "Party Challenge cleared");
                }
            }));
        }
        for (const remove of removeRole) {
            p.push(findMemberByTag(guild, remove).then((member) => {
                if (member !== undefined) {
                    log.info("PARTYSUBMIT", "Removing reward role from " + member.user.tag);
                    member.roles.remove(partyConfig.clearRewardRoleId, "Party Challenge submission rejected");
                }
            }));
        }
        return Promise.all(p);
    });
}

async function findMemberByName(guild, name) {
    const members = await guild.members.fetch({query: name, limit: 2});
    if (members.size === 1) return members.first();
    else return undefined; // not unique
}

async function findMemberByTag(guild, tag) {
    const members = await guild.members.fetch({query: tag.split("#")[0], limit: 1000});
    return members.find(m => m.user.tag === tag);
}

module.exports = {startParty, endParty, giveRewardRole, checkRoles};