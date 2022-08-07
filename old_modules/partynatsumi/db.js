const {DataTypes} = require("sequelize");
module.exports = db => {
    db.define("TurnRecord", {
        turn: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        stockNo: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true
        },
        price: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        nextBonus: {
            type: DataTypes.DOUBLE,
            allowNull: false
        }
    });

    db.define("Inventory", {
        userId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            primaryKey: true
        },
        money: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 10000
        },
        stocks: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [0,0,0,0,0,0,0,0,0]
        },
        jobTimeout: {
            type: DataTypes.BIGINT
        },
        jobFinishMessage: {
            type: DataTypes.STRING(20)
        },
        messages: {
            type: DataTypes.JSON,
            allowNull: false
        }
    });

    db.define("TradeRecord", {
        userId: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        turn: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        stockNo: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        price: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        amount: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    });

    const Option = db.define("Option", {
        showPrices: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        bonusMultiplier: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            defaultValue: 0.00025
        },
        bonusDecay: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            defaultValue: 0.8
        },
        tradeRandom: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            defaultValue: 0.05
        },
        capPriceMax: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 999
        },
        capPriceMin: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 20
        },
        capBonus: {
            type: DataTypes.DOUBLE,
            allowNull: false,
            defaultValue: .5
        }
    });
};