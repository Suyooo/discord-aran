const express = require("express");
const log = require("../../logger");
let stonks;

module.exports = (bot, db) => {
    stonks = require("./stonks")(undefined);
    const router = express.Router();

    /*
     * CONTROL
     */

    router.get("/", bot.auth.routerPartyOnly, (req, res, next) => {
        res.render("../modules/partynatsumi/views/controls");
    });

    /*
     * VIEW
     */

    router.get("/public/", (req, res, next) => {
        res.render("../modules/partynatsumi/views/stonklist", {
            data: stonks.getData(),
            stonks: stonks.STONK_LIST,
            interval: stonks.INTERVAL,
            startTime: stonks.START_TIME
        });
    });

    router.get("/public/ranking/", (req, res, next) => {
        db.modules.partynatsumi.Inventory.findAll({
            order: [["money","DESC"]]
        })
            .then(res => Promise.all(res.map(r => bot.modules.partynatsumi.getNameForRank(r.userId, r.money))))
            .then(ranks => res.render("../modules/partynatsumi/views/rankings", {
                ranking: ranks
            }));
    });

    /*
     * BACKEND
     */

    router.get("/public/latest/", (req, res, next) => {
        res.json(stonks.getLatest());
    });

    return router;
}