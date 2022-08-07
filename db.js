const sequelize = require("sequelize");
const inflection = require("inflection");
const log = require("./logger");
const config = require("./config");

function getDatabase() {
    if (config.database.driver === "sqlite") {
        return new sequelize.Sequelize("sqlite:" + config.database.filename, {
            dialect: "sqlite",
            logging: undefined /*log.debug.bind(this, "DB")*/
        });
    } else if (config.database.driver === "mysql") {
        return new sequelize.Sequelize(config.database.database, config.database.username, config.database.password, {
            dialect: "mysql",
            host: config.database.host,
            logging: undefined /*log.debug.bind(this, "DB")*/
        });
    } else {
        console.log("Unsupported database driver configured.");
        process.exit(1);
    }
}

module.exports = (moduleList) => {
    const db = getDatabase();

    db.modules = {};
    const originalDefine = db.define.bind(db);

    for (const mod of moduleList) {
        log.debug("DB", "Loading module " + mod.name);
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
            log.error("DB", "Failed to synchronize models! " + error + "\n" + error.stack);
            process.exit(1);
        });
};