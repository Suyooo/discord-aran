const sequelize = require("sequelize");
const inflection = require("inflection");
const log = require("./logger");

module.exports = (moduleList) => {
    const db = new sequelize.Sequelize("sqlite:config.db", {logging: log.debug.bind(this, "DB")});

    db.modules = {};
    const originalDefine = db.define.bind(db);

    for (const mod of moduleList) {
        log.debug("BOT", "Loading module " + mod.name);
        db.modules[mod.name] = {};

        let count = 0;
        db.define = (modelName, attributes, options) => {
            if (options === undefined) options = {};
            options.tableName = mod.name + "_" + (options.tableName ? options.tableName : inflection.pluralize(modelName).toLowerCase());
            const model = originalDefine(mod.name + "_" + modelName, attributes, options);
            db.modules[mod.name][modelName] = model;
            // TODO: Add per-model sync, so force/alter can be set as command line arguments per model to update tables
            count++;
            return model;
        }

        const module = require("./modules/" + mod.name + "/db")(db);
        log.info("DB", "Registered " + count + " database model(s) for " + mod.name);
    }

    db.define = () => {
        log.error("DB", "I have no idea why you would define new models during runtime and have no idea right now how to easily deal with that, so I'll just ignore it");
        return undefined;
    };

    return db.sync()
        .then(() => {
            log.info("DB", "Models synchronized");
            return db;
        })
        .catch(error => {
            log.error("DB", "Failed to synchronize models! " + error.stack);
            process.exit(1);
        });
};