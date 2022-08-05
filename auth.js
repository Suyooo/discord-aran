const config = require("./config");

module.exports = (bot, db) => {
    async function checkStaff(userId) {
        try {
            const guild = await bot.guilds.fetch(config.sifcordGuildId);
            // do not cache: role changes should be reflected immediately
            const member = await guild.members.fetch({user: userId, force: true});
            return member.roles.cache.some(role => role.id === config.staffRoleId);
        } catch (e) {
            return false;
        }
    }

    async function routerStaffOnly(req, res, next) {
        try {
            if (req.isAuthenticated()) {
                if (await checkStaff(req.user.id)) {
                    return next();
                }
                res.status(403);
                res.send("This module's dashboard can only be accessed by Staff");
            } else {
                res.redirect(config.dashboardRootPath + "/auth");
            }
        } catch (e) {
            next(e);
        }
    }

    async function checkParty(userId) {
        try {
            const guild = await bot.guilds.fetch(config.sifcordGuildId);
            // do not cache: role changes should be reflected immediately
            const member = await guild.members.fetch({user: userId, force: true});
            return member.roles.cache.some(role => role.id === config.staffRoleId || role.id === config.partyRoleId);
        } catch (e) {
            return false;
        }
    }

    async function routerPartyOnly(req, res, next) {
        try {
            if (req.isAuthenticated()) {
                if (await checkParty(req.user.id)) {
                    return next();
                }
                res.status(403);
                res.send("This module's dashboard can only be accessed by Staff or Party crew");
            } else {
                res.redirect(config.dashboardRootPath + "/auth");
            }
        } catch (e) {
            next(e);
        }
    }

    return {checkStaff, routerStaffOnly, checkParty, routerPartyOnly};
}