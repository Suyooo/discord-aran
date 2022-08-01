const express = require("express");
const db = require("./db");
const emoji = require("emoji-name-map");
const rolebuttons_edit = require("./static/js/edit-html");
const config = require("../../config");
const log = require("../../logger");

module.exports = (bot, db_) => {
    const router = express.Router();
    router.use(bot.auth.routerStaffOnly);

    /*
     * FRONTEND
     */

    router.get("/", (req, res, next) => {
        res.render("../modules/rolebuttons/views/list", {"groups": db.groups_list()});
    });

    router.get("/new/", (req, res, next) => {
        Promise.all([bot.modules.helper.listChannelsOfGuild(config.sifcordGuildId), bot.modules.helper.listRolesOfGuild(config.sifcordGuildId)])
            .then(([channels, roles]) => {
                res.render("../modules/rolebuttons/views/edit", {
                    "group": {id: "null", guild_id: config.sifcordGuildId, messages: []},
                    "modules": {emoji, rolebuttons_edit},
                    "channels": channels,
                    "roles": roles
                });
            });
    });

    router.get("/:id/", (req, res, next) => {
        let grp = db.groups_get(parseInt(req.params.id));
        let msgs = db.messages_list(grp.id);
        msgs.forEach(msg => {
            msg.buttons = db.buttons_list(msg.id);
        });
        grp.messages = msgs;
        Promise.all([bot.modules.helper.listChannelsOfGuild(grp.guild_id), bot.modules.helper.listRolesOfGuild(grp.guild_id)])
            .then(([channels, roles]) => {
                res.render("../modules/rolebuttons/views/edit", {
                    "group": grp,
                    "modules": {emoji, rolebuttons_edit},
                    "channels": channels,
                    "roles": roles
                });
            });
    });

    /*
     * BACKEND
     */

    router.put("/save/", (req, res, next) => {
        let group_json;
        let new_group = false;
        db.transaction(() => {
            if (req.body.id) {
                group_json = db.groups_update(req.body);
            } else {
                new_group = true;
                group_json = db.groups_new(req.body);
            }
            req.body.messages.forEach(msg => {
                if (new_group) msg.group_id = group_json.id;
                let msg_json;
                let new_msg = false;
                if (msg.id) {
                    msg_json = db.messages_update(msg);
                } else {
                    new_msg = true;
                    msg_json = db.messages_new(msg);
                }
                msg.buttons.forEach(btn => {
                    if (new_msg) btn.message_id = msg_json.id;
                    if (btn.id) {
                        db.buttons_update(btn);
                    } else {
                        db.buttons_new(btn);
                    }
                });
            });
            req.body.delete_buttons.forEach(db.buttons_delete);
            req.body.delete_messages.forEach(db.messages_delete);
        })();
        res.json(group_json);
    });

    router.delete("/delete/", (req, res, next) => {
        bot.modules.rolebuttons.deleteAllMessages(req.body.id).then(() => {
            db.transaction(() => {
                db.messages_list(req.body.id).forEach(msg => {
                    db.buttons_list(msg.id).forEach(btn => {
                        db.buttons_delete(btn.id);
                    });
                    db.messages_delete(msg.id);
                });
                db.groups_delete(req.body.id);
            })();
            res.json({});
        });
    });

    router.put("/post/", (req, res, next) => {
        log.info("ROLEBUTTONS", "Posting requested for Group #" + req.body.id);
        bot.modules.rolebuttons.postGroup(req.body.id, true).then(() => res.json({})).catch(e => next(e));
    });

    router.put("/update/", (req, res, next) => {
        log.info("ROLEBUTTONS", "Updates requested for Group #" + req.body.id);
        bot.modules.rolebuttons.postGroup(req.body.id, false).then(() => res.json({})).catch(e => next(e));
    });

    return router;
}