const {DataTypes} = require("sequelize");
module.exports = db => {
    const Button = db.define("Button", {
        display_row: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        display_order: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        role_id: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        label: {
            type: DataTypes.STRING(80)
        },
        emoji: {
            type: DataTypes.STRING(80)
        }
    });
    const Message = db.define("Message", {
        display_order: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        title: {
            type: DataTypes.STRING(256)
        },
        description: {
            type: DataTypes.STRING(4096)
        },
        color: {
            type: DataTypes.STRING(6)
        },
        posted_msg_id: {
            type: DataTypes.STRING(20)
        }
    });
    const Group = db.define("Group", {
        title: {
            type: DataTypes.STRING(256)
        },
        guild_id: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        channel_id: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        require_role_ids: {
            type: DataTypes.STRING(256)
        }
    });

    Group.Messages = Group.hasMany(Message, {as: "messages", foreignKey: {name: "groupId", notNull: false}, onDelete: "CASCADE"});
    Message.Group = Message.belongsTo(Group, {as: "group", foreignKey: {name: "groupId", notNull: false}, onDelete: "CASCADE"});
    Message.Buttons = Message.hasMany(Button, {as: "buttons", foreignKey: {name: "messageId", notNull: false}, onDelete: "CASCADE"});
    Button.Message = Button.belongsTo(Message, {as: "message", foreignKey: {name: "messageId", notNull: false}, onDelete: "CASCADE"});
};