const {createLogger, format, transports} = require("winston");

const logger = createLogger({
    level: "debug",
    format: format.combine(
        format.errors({stack: true}),
        format.colorize(),
        format.timestamp({
            format: "HH:mm:ss"
        }),
        format.align(),
        format.printf(info => {
            return `${info.timestamp} [${info.level}] : ${info.message}`;
        })
    ),
    defaultMeta: {service: "logger"},
    transports: [
        new transports.Console(),
        new transports.File({filename: "log"})
    ]
});

module.exports = {
    debug(tag, msg) {
        logger.debug(("[" + tag + "]").padEnd(16, " ") + msg);
    },
    info(tag, msg) {
        logger.info(("[" + tag + "]").padEnd(16, " ") + msg);
    },
    warn(tag, msg) {
        logger.warn(("[" + tag + "]").padEnd(16, " ") + msg);
    },
    error(tag, msg) {
        logger.error(("[" + tag + "]").padEnd(16, " ") + msg);
    }
}