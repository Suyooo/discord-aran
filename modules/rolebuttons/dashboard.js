const express = require("express");
const emoji = require("emoji-name-map");
const rolebuttons_edit = require("./static/js/edit-html");
const config = require("../../config");
const log = require("../../logger");
const {Op} = require("sequelize");

module.exports = (bot, db) => {
    const router = express.Router();
    router.use(bot.auth.routerStaffOnly);

    /*
     * FRONTEND
     */

    router.get("/", (req, res, next) => {
        db.modules.rolebuttons.Group.findAll({attributes: ['id', 'title']})
            .then(groups => res.render("../modules/rolebuttons/views/list", {"groups": groups}));
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
        const id = parseInt(req.params.id);
        if (id >= 0) {
            db.modules.rolebuttons.Group.findByPk(id, {
                include: {
                    model: db.modules.rolebuttons.Message,
                    as: "messages",
                    include: {
                        model: db.modules.rolebuttons.Button,
                        as: "buttons"
                    }
                },
                order: [
                    [
                        {model: db.modules.rolebuttons.Message, as: "messages"},
                        'display_order'
                    ],
                    [
                        {model: db.modules.rolebuttons.Message, as: "messages"},
                        {model: db.modules.rolebuttons.Button, as: "buttons"},
                        'display_order'
                    ]
                ]
            }).then(grp => {
                if (grp !== null) {
                    Promise.all([bot.modules.helper.listChannelsOfGuild(grp.guild_id), bot.modules.helper.listRolesOfGuild(grp.guild_id)])
                        .then(([channels, roles]) => {
                            res.render("../modules/rolebuttons/views/edit", {
                                "group": grp,
                                "modules": {emoji, rolebuttons_edit},
                                "channels": channels,
                                "roles": roles
                            });
                        });
                } else {
                    res.status(404).send({
                        message: "This group does not exist."
                    });
                }
            });
        } else {
            res.status(400).send({
                message: "Invalid group ID."
            });
        }
    });

    /*
     * BACKEND
     */

    router.put("/save/", (req, res, next) => {
        let group;
        db.transaction(async (t) => {
            if (req.body.delete_buttons) {
                await db.modules.rolebuttons.Button.destroy({
                    where: {
                        [Op.or]: req.body.delete_buttons.map(i => ({id: i}))
                    },
                    transaction: t
                });
            }
            if (req.body.delete_messages) {
                console.log(req.body.delete_messages);
                await db.modules.rolebuttons.Message.destroy({
                    where: {
                        [Op.or]: req.body.delete_messages.map(i => ({id: i}))
                    },
                    transaction: t
                });
            }

            if (!req.body.id) {
                group = await db.modules.rolebuttons.Group.create(req.body, { transaction: t });
            } else {
                group = await db.modules.rolebuttons.Group.findByPk(req.body.id, {transaction: t});
                await group.set(req.body);
            }

            if (req.body.messages) {
                for (const messageData of req.body.messages) {
                    let message;
                    if (!messageData.id) {
                        message = await group.createMessage(messageData, { transaction: t });
                    } else {
                        message = await db.modules.rolebuttons.Message.findByPk(messageData.id, {transaction: t});
                        await message.set(messageData);
                    }

                    if (messageData.buttons) {
                        for (const buttonData of messageData.buttons) {
                            if (!buttonData.id) {
                                await message.createButton(buttonData, {transaction: t});
                            } else {
                                await db.modules.rolebuttons.Button.update(buttonData, {
                                    where: {id: buttonData.id},
                                    transaction: t
                                });
                            }
                        }
                    }

                    await message.save({transaction: t});
                }
            }

            await group.save({transaction: t});
        })
            .then(() => res.json({"success": true, "id": group.id}))
            .catch(error => {
                log.error("ROLEBUTTONS", "Error saving group: " + error + "\n" + error.stack);
                res.status(500).json({"success": false})
            });
    });

    router.delete("/delete/", (req, res, next) => {
        bot.modules.rolebuttons.deleteAllMessages(req.body.id)
            .then(() => db.modules.rolebuttons.Group.destroy({where: {id: req.body.id}}))
            .then(() => res.json({"success": true}))
            .catch(error => {
                log.error("ROLEBUTTONS", "Error deleting group: " + error + "\n" + error.stack);
                res.status(500).json({"success": false})
            });
    });

    router.put("/post/", (req, res, next) => {
        log.info("ROLEBUTTONS", "Posting requested for Group #" + req.body.id);
        bot.modules.rolebuttons.postGroup(req.body.id, true)
            .then(() => res.json({"success": true}))
            .catch(error => {
                log.error("ROLEBUTTONS", "Error posting group: " + error + "\n" + error.stack);
                res.status(500).json({"success": false})
            });
    });

    router.put("/update/", (req, res, next) => {
        log.info("ROLEBUTTONS", "Updates requested for Group #" + req.body.id);
        bot.modules.rolebuttons.postGroup(req.body.id, false)
            .then(() => res.json({"success": true}))
            .catch(error => {
                log.error("ROLEBUTTONS", "Error updating group: " + error + "\n" + error.stack);
                res.status(500).json({"success": false})
            });
    });

    return router;
}