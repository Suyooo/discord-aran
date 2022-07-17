const log = require("../../logger.js");
const fs = require("fs");
if (!fs.existsSync("modules/rolebuttons/config.db")) {
    const db = require("better-sqlite3")("modules/rolebuttons/config.db", {verbose: log.debug.bind(this, "SQL")});
    db.exec(fs.readFileSync("modules/rolebuttons/config_scheme.sql", "utf8"));
    db.close();
}
const db = require("better-sqlite3")("modules/rolebuttons/config.db", {fileMustExist: true, verbose: log.debug.bind(this, "SQL")});

/*
 * GROUPS
 */

const GROUPS_LIST = db.prepare("SELECT * FROM groups");

function groups_list() {
    return GROUPS_LIST.all();
}

const GROUPS_GET = db.prepare("SELECT * FROM groups WHERE id = ?");

function groups_get(id) {
    let res = GROUPS_GET.get(id);
    if (!res) {
        throw new Error("This role group does not exist");
    }
    return res;
}

const GROUPS_UPDATE = db.prepare("UPDATE groups SET name = ?, guild_id = ?, channel_id = ?, require_role_ids = ? WHERE id = ?");

function groups_update(val) {
    if (GROUPS_UPDATE.run(val.name, val.guild_id, val.channel_id, val.require_role_ids, val.id).changes === 0) {
        throw new Error("This role group does not exist");
    }
    return val;
}

const GROUPS_NEW = db.prepare("INSERT INTO groups(name, guild_id, channel_id) VALUES(?,?,?)");

function groups_new(val) {
    val.id = GROUPS_NEW.run(val.name, val.guild_id, val.channel_id).lastInsertRowid;
    return val;
}

const GROUPS_DELETE = db.prepare("DELETE FROM groups WHERE id = ?");

function groups_delete(id) {
    GROUPS_DELETE.run(id);
}

/*
 * MESSAGES
 */

const MESSAGES_LIST = db.prepare("SELECT * FROM messages WHERE group_id = ? ORDER BY display_order");

function messages_list(group_id) {
    return MESSAGES_LIST.all(group_id);
}

const MESSAGES_GET = db.prepare("SELECT * FROM messages WHERE id = ?");

function messages_get(id) {
    let res = MESSAGES_GET.get(id);
    if (!res) {
        throw new Error("This role message does not exist");
    }
    return res;
}

const MESSAGES_UPDATE = db.prepare("UPDATE messages SET group_id = ?, display_order = ?, title = ?, description = ?, color = ?, posted_msg_id = ? WHERE id = ?");

function messages_update(val) {
    if (MESSAGES_UPDATE.run(val.group_id, val.display_order, val.title, val.description, val.color, val.posted_msg_id, val.id).changes === 0) {
        throw new Error("This role message does not exist");
    }
    return val;
}

const MESSAGES_NEW = db.prepare("INSERT INTO messages(group_id, display_order, title, description, color, posted_msg_id) VALUES(?,?,?,?,?,?)");

function messages_new(val) {
    val.id = MESSAGES_NEW.run(val.group_id, val.display_order, val.title, val.description, val.color, val.posted_msg_id).lastInsertRowid;
    return val;
}

const MESSAGES_DELETE = db.prepare("DELETE FROM messages WHERE id = ?");

function messages_delete(id) {
    MESSAGES_DELETE.run(id);
}

/*
 * BUTTONS
 */

const BUTTONS_LIST = db.prepare("SELECT * FROM buttons WHERE message_id = ? ORDER BY display_order");

function buttons_list(message_id) {
    return BUTTONS_LIST.all(message_id);
}

const BUTTONS_GET = db.prepare("SELECT * FROM buttons WHERE id = ?");

function buttons_get(id) {
    let res = BUTTONS_GET.get(id);
    if (!res) {
        throw new Error("This role button does not exist");
    }
    return res;
}

const BUTTONS_UPDATE = db.prepare("UPDATE buttons SET message_id = ?, display_row = ?, display_order = ?, role_id = ?, label = ?, emoji = ? WHERE id = ?");

function buttons_update(val) {
    if (BUTTONS_UPDATE.run(val.message_id, val.display_row, val.display_order, val.role_id, val.label, val.emoji, val.id).changes === 0) {
        throw new Error("This role button does not exist");
    }
    return val;
}

const BUTTONS_NEW = db.prepare("INSERT INTO buttons(message_id, display_row, display_order, role_id, label, emoji) VALUES(?,?,?,?,?,?)");

function buttons_new(val) {
    val.id = BUTTONS_NEW.run(val.message_id, val.display_row, val.display_order, val.role_id, val.label, val.emoji).lastInsertRowid;
    return val;
}

const BUTTONS_DELETE = db.prepare("DELETE FROM buttons WHERE id = ?");

function buttons_delete(id) {
    BUTTONS_DELETE.run(id);
}

module.exports = {
    groups_list, groups_get, groups_new, groups_update, groups_delete,
    messages_list, messages_get, messages_new, messages_update, messages_delete,
    buttons_list, buttons_get, buttons_new, buttons_update, buttons_delete
}