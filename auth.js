const bot = require("./bot");
const config = require("./config");

async function checkStaff(client, userId) {
    try {
        let guild = await client.guilds.fetch(config.sifcordGuildId);
        // do not cache: role changes should be reflected immediately
        let member = await guild.members.fetch({user: userId, force: true});
        return member.roles.cache.some(role => role.id === config.staffRoleId);
    } catch (e) {
        return false;
    }
}

async function routerStaffOnly(req, res, next) {
    try {
        if (req.isAuthenticated()) {
            if (await checkStaff(bot, req.user.id)) {
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

module.exports = {
    checkStaff, routerStaffOnly
}