const config = require("./config");
const log = require("./logger");
const express = require("express");
const body = require("body-parser");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const session = require("express-session");
const MemoryStore = require("memorystore")(session);
const bot = require("./bot");
const fs = require("fs");
const crypto = require("crypto");

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

const moduleNames = fs.readdirSync("./modules");
const dashboardModules = {};

for (const moduleName of moduleNames) {
    log.info("DASHBOARD", "Loading module " + moduleName);
    const moduleInfo = require("./modules/" + moduleName + "/info");
    if (fs.existsSync("./modules/" + moduleName + "/dashboard.js")) {
        const module = require("./modules/" + moduleName + "/dashboard");
        app.use("/" + moduleName, module);

        if (moduleInfo.hasOwnProperty("dashboardTitle")) {
            dashboardModules[moduleName] = moduleInfo.dashboardTitle;
        }
        log.info("DASHBOARD", "Module dashboard component for " + moduleName + " registered");
    }
    app.use("/js/" + moduleName, express.static("modules/" + moduleName + "/static/js"));
    app.use("/style/" + moduleName, express.static("modules/" + moduleName + "/static/style"));
    app.use("/vendor/" + moduleName, express.static("modules/" + moduleName + "/static/vendor"));
}

app.get("/", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("index", {"modules": dashboardModules});
    } else {
        res.redirect(config.dashboardRootPath + "/auth");
    }
});

app.listen(config.dashboardPort, () => {
    log.info("DASHBOARD", "Listening on port " + config.dashboardPort);
});