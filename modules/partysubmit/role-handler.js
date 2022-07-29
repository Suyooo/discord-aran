const {GoogleSpreadsheet} = require("google-spreadsheet");
const creds = require("./google-credentials.json");
const partyConfig = require("./config");
const config = require("../../config");
const log = require("../../logger");

let spreadsheet = undefined;
let knownRoleHavers = new Set();

function startParty() {
    let doc = new GoogleSpreadsheet(partyConfig.spreadsheetId);
    return doc.useServiceAccountAuth(creds).then(async () => {
        await doc.loadInfo();
    }).then(() => {
        log.info("PARTYSUBMIT", "Logged into sheet for party");
        spreadsheet = doc.sheetsByTitle["Collection of Info and Stuff"];
        knownRoleHavers.clear();
    });
}

const cellAddrList = ["B12", "G12", "L12"];

function giveRewardRole(member) {
    if (member !== undefined && !knownRoleHavers.has(member.user.tag)) {
        log.info("ROLE", "Awarding reward role to " + member.user.tag);
        member.roles.add(partyConfig.clearRewardRoleId, "Party Challenge cleared")
            .then(() => knownRoleHavers.add(member.user.tag))
            .catch(() => null);
    }
}

function checkRoles(bot) {
    spreadsheet.resetLocalCache(true);
    return spreadsheet.loadCells(cellAddrList).then(() => {
        const clearers = new Set();
        for (const cellAddr of cellAddrList) {
            const cell = spreadsheet.getCellByA1(cellAddr);
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
            p.push(guild.members.fetch({cache: false, query: add.split("#")[0], limit: 1000}).then((members) => {
                const member = members.find(m => m.user.tag === add);
                if (member !== undefined) {
                    log.info("ROLE", "Awarding reward role to " + member.user.tag);
                    member.roles.add(partyConfig.clearRewardRoleId, "Party Challenge cleared");
                }
            }));
        }
        for (const remove of removeRole) {
            p.push(guild.members.fetch({cache: false, query: remove.split("#")[0], limit: 1000}).then((members) => {
                const member = members.find(m => m.user.tag === remove);
                if (member !== undefined) {
                    log.info("ROLE", "Removing reward role from " + member.user.tag);
                    member.roles.remove(partyConfig.clearRewardRoleId, "Party Challenge submission rejected");
                }
            }));
        }
        return Promise.all(p);
    });
}

module.exports = {startParty, giveRewardRole, checkRoles};