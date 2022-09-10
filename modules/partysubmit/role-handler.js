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
const topCellAddrList = ["A7:D16", "F7:I16", "K7:N16", "P7:S16"]; // SIF A, SIF B, SIFAS A, SIFAS B
const topFirstColList = [0, 5, 10, 15]; // SIF A, SIF B, SIFAS A, SIFAS B (0-indexed)
let knownRoleHavers = new Set();

// https://stackoverflow.com/a/39466341
function ordinal(n) {
    return n + (["st", "nd", "rd"][((n + 90) % 100 - 10) % 10 - 1] || "th");
}

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

async function endParty(controllerChannel) {
    log.info("PARTYSUBMIT", "2nd grace period over, making copypasties");
    frontSheet.resetLocalCache(true);
    settingsSheet.resetLocalCache(true);
    rankingsSheet.resetLocalCache(true);
    await Promise.all([
        frontSheet.loadCells(winnerCellAddrList),
        settingsSheet.loadCells(mvpNameCellAddrList),
        rankingsSheet.loadCells(topCellAddrList)
    ]);
    const guild = controllerChannel.guild;
    // send finish message
    let msg = "Party has ended, forms are being closed automatically now.\nAfter you posted the results, please also finish the Party by going to the sheet and using the SIFcord Party => Finish Party menu option!\n\nHere's some stuff to copypaste into the writing doc!\n\n";
    msg += "SIF Clears\n```";
    msg += await makeMentionList(guild, winnerCellAddrList[0]);
    msg += "```\n\nSIFAS Clears\n```";
    msg += await makeMentionList(guild, winnerCellAddrList[1]);
    msg += "```\n\nOOG Players\n```";
    msg += await makeMentionList(guild, winnerCellAddrList[2]);
    msg += "```\n\nSIF MVPs **(unverified - please check before posting!)**\n```";
    msg += await makeMVPList(guild, mvpNameCellAddrList[0], topFirstColList[0], "Score: ", "");
    msg += "\n\n";
    msg += await makeMVPList(guild, mvpNameCellAddrList[1], topFirstColList[1], "", " " + partyConfig.SIF.other.label);
    msg += "```\n\nSIFAS MVPs **(unverified - please check before posting!)**\n```";
    msg += await makeMVPList(guild, mvpNameCellAddrList[2], topFirstColList[2], "Voltage: ", "");
    msg += "\n\n";
    msg += await makeMVPList(guild, mvpNameCellAddrList[3], topFirstColList[3], "", " " + partyConfig.SIFAS.other.label);
    msg += "```";
    log.debug("PARTYSUBMIT", "Sending copypasties");
    await controllerChannel.send(msg);
}

async function makeMentionList(guild, cellAddr) {
    const cell = frontSheet.getCellByA1(cellAddr);
    if (cell.value === null) return "";
    const clearers = [];
    for (const clearer of cell.value.split(", ")) {
        const tag = clearer.trim();
        if (tag === "") continue;
        const member = await findMemberByTag(guild, tag);
        clearers.push(member.toString());
    }
    return clearers.join(", ");
}

async function makeMVPList(guild, mvpNameCellAddr, firstCol, pre, suf) {
    const rankings = {1: undefined, 2: undefined, 3: undefined};
    for (let row = 6; row <= 15; row++) {
        const rank = rankingsSheet.getCell(row, firstCol).value;
        if (rank === null || rank > 3) break;

        const userName = rankingsSheet.getCell(row, firstCol + 1).value;
        const possibleMembers = [...knownRoleHavers.values()].filter(n => n.startsWith(userName.trim()));
        let member;
        if (possibleMembers.length === 1) {
            member = await findMemberByTag(guild, possibleMembers[0]);
        } else {
            member = await findMemberByName(guild, userName);
        }

        if (rankings[rank] === undefined) {
            rankings[rank] = {
                "score": rankingsSheet.getCell(row, firstCol + 3).value,
                "players": []
            }
        }
        rankings[rank].players.push(member ? member.toString() : "@" + userName.trim());
    }

    const nameCell = settingsSheet.getCellByA1(mvpNameCellAddr);
    const top = [];
    for (let rank = 1; rank <= 3; rank++) {
        if (rankings[rank] === undefined) continue;
        let s;

        if (rankings[rank].players.length > 1) {
            const combo = rankings[rank].players[rankings[rank].players.length - 2] + " and " + rankings[rank].players[rankings[rank].players.length - 1];
            rankings[rank].players.splice(-2, 2, combo);
            s = "Tied in " + ordinal(rank) + ": " + rankings[rank].players.join(", ");
        } else {
            s = ((rank > 1) ? (ordinal(rank) + ": ") : "") + rankings[rank].players[0];
        }

        top.push(s + " (" + pre + rankings[rank].score + suf + ")");
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
                clearers.add(clearer);
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