const bot = require("./bot");
const config = require("./config");

async function mustBeStaff(req, res, next) {
    try {
        if (req.isAuthenticated()) {
            let guild = await bot.guilds.fetch(config.sifcordGuildId);
            // do not cache: role changes should be reflected immediately
            let member = await guild.members.fetch({user: req.user.id, force: true});
            if (member.roles.cache.some(role => role.id === "207972968901509120")) { // "Staff" Role
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
    mustBeStaff
}