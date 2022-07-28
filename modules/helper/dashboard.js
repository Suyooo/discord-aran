const express = require("express");
const bot = require("../../bot");

const router = express.Router();

router.get("/guild/:id/channels/", (req, res, next) => {
    bot.modules.helper.listChannelsOfGuild(req.params.id).then(r => res.json(r));
});
router.get("/guild/:id/roles/", (req, res, next) => {
    bot.modules.helper.listRolesOfGuild(req.params.id).then(r => res.json(r));
});

module.exports = router;