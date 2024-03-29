const config = require("./config");
const log = require("./logger");
const express = require("express");
const body = require("body-parser");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const session = require("express-session");
const MemoryStore = require("memorystore")(session);
const fs = require("fs");
const crypto = require("crypto");

module.exports = (moduleList, bot, db) => {
    const app = express();

    app.set("view engine", "ejs");
    app.use(body.json());
    app.use(session({
        cookie: {maxAge: 86400000},
        store: new MemoryStore({
            checkPeriod: 86400000 // prune expired entries every 24h
        }),
        saveUninitialized: false,
        resave: false,
        secret: require('crypto').randomBytes(64).toString('hex')
    }))
    app.use(passport.initialize());
    app.use(passport.session());

    app.use("/vendor", express.static("static/vendor"));
    app.use("/style", express.static("static/style"));
    app.use("/vendor/jquery", express.static("node_modules/jquery/dist"));

    /*
     * AUTHENTICATION
     */

    passport.use(new DiscordStrategy({
        clientID: config.clientId,
        clientSecret: config.clientSecret,
        callbackURL: config.dashboardDomain + config.dashboardRootPath + "/auth/callback",
        scope: ["identify"],
        state: true
    }, function (accessToken, refreshToken, profile, done) {
        process.nextTick(function () {
            return done(null, profile);
        });
    }));

    passport.serializeUser(function (user, done) {
        done(null, user);
    });
    passport.deserializeUser(function (obj, done) {
        done(null, obj);
    });

    app.get("/auth", passport.authenticate("discord", {prompt: "none"}));
    app.get("/auth/callback",
        passport.authenticate("discord", {failureRedirect: config.dashboardRootPath + "/"}), function (req, res) {
            res.redirect(config.dashboardRootPath + "/");
        }
    );
    app.locals.dashboardRootPath = config.dashboardRootPath;

    const allModules = [];
    const dashboardModules = {};

    for (const mod of moduleList) {
        log.debug("DASHBOARD", "Loading module " + mod.name);

        let fullDesc = mod.info.description;
        if (mod.info.hasOwnProperty("textCommands")) {
            fullDesc += " (Text Commands: " + mod.info["textCommands"].map(c => config.textCommandPrefix + c).join(", ") + ")"
        }
        allModules.push([mod.name, fullDesc]);

        if (mod.hasDashboard) {
            const module = require("./modules/" + mod.name + "/dashboard")(bot, db);
            app.use("/" + mod.name, module);

            if (mod.info.hasOwnProperty("dashboardTitle")) {
                dashboardModules[mod.name] = mod.info.dashboardTitle;
            }
            log.info("DASHBOARD", "Module dashboard component for " + mod.name + " registered");
        }

        app.use("/js/" + mod.name, express.static("modules/" + mod.name + "/static/js"));
        app.use("/img/" + mod.name, express.static("modules/" + mod.name + "/static/img"));
        app.use("/style/" + mod.name, express.static("modules/" + mod.name + "/static/style"));
        app.use("/vendor/" + mod.name, express.static("modules/" + mod.name + "/static/vendor"));
    }

    allModules.sort((a, b) => a[0].localeCompare(b[0]));

    app.get("/", function (req, res) {
        if (req.isAuthenticated()) {
            res.render("index", {"modules": dashboardModules, "active": allModules});
        } else {
            res.redirect(config.dashboardRootPath + "/auth");
        }
    });

    app.listen(config.dashboardPort, () => {
        log.info("DASHBOARD", "Listening on port " + config.dashboardPort);
    });
}