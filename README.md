# Aran Bot

Bot for [the School Idol Festival Discord server](https://discord.gg/sif).

Note that this is the "private" part of Aran, as in, it is only used on SIFcord.  
The SIFAS Card/Song Lookup functions, which can be useful for other servers, are implemented seperately as a different
bot, so you can have it join your servers without all the extra stuff in here. For info about that and the invite
link, [check out the discord-sifaslookup repo](https://github.com/Suyooo/discord-sifaslookup/).

## Setup

If you want to run this yourself you need to:

* Run `npm install` to grab packages
* Set up configuration (see next section)
* Start the bot and dashboard with `npm start` or `node aran.js`

### Configuration

#### Secret (`config.secret.json`)

Application keys and tokens from the Discord Developer Portal.

* `clientId`
* `clientSecret`
* `botToken`

#### Global (`config.global.json`)

Configuring bot behaviour.

* `textCommandPrefix`: Messages must start with this prefix to be recognized as text commands.
* `sifcordGuildId`: Server ID for which server this bot should be running on. You probably want to change this to a test
  server's ID.
* `staffRoleId`: Role ID for the role that should be used for dashboard access control.
* `partyRoleId`: Role ID for a role that can access the index and *some* modules related to Party events.

#### Local (`config.local.json`)

File that sets per-environment configuration (so I can deploy every other file from my local environment directly to the
server environment)

* `dashboardPort`: Which port the dashboard should run on.
* `database`: An object with database configuration. The first property is `driver`, which is either `sqlite` or `mysql`
  . Depending on which driver you run, you have other required properties:
  * `sqlite` requires `filename`, the relative path to the database file.
  * `mysql` requires `host`, `database`, `username` and `password`.
* `dashboardRootPath` *(optional)*: If proxying through a webserver running on another port, this option allows you to
  set a subfolder so link URLs are set correctly, without a trailing slash (for example: `/dashboard`). If not set, it
  will be set to the root (empty string).
* `dashboardDomain` *(optional)*: If Express.JS resolves the domain name incorrectly (or the dashboard is proxied), this
  allows you to override it. Again, no trailing slash, and do not include the root path if `dashboardRootPath` is set (
  for example: `https://example.com`).
* `m̀oduleWhitelist` *(optional)*: An array of strings that only allows those modules to be loaded. This allows you to
  run only one single module you are working on in your dev environment, while the rest of the bot can still run the
  rest without any conflicts. If not set, all modules in the `modules` folder will be loaded.

## Implementing Modules

To avoid having to mess with too much of the code, new functions can be implemented as modules. Generally, feel free to
check the `rolebuttons` module as an example of how to implement the following components.

To create a new module, make a new subfolder in the `modules` folder with an `info.json` file in it with the following
keys:

* `description`: A human-readable description of what this module is or does.
* `textCommands` *(optional)*: An array of strings which the bot implements as commands. The text commands will be
  registered so the bot component can be called for them (see below). The strings should not include a command prefix
  symbol, as that is defined in the configuration. If this key is not defined, no text commands are registered.
* `dashboardTitle` *(optional)*: String for the link to the module's dashboard on the index. If this key is not defined,
  it will not be linked on the dashboard (for utility modules, or modules without dashboards)

### Objects

In the modules, you'll mainly be working with the bot and database objects to interact with the server or store data.
Here's what those have.

#### Bot Object

The bot object is generally just
a [Discord.JS client object](https://discord.js.org/#/docs/discord.js/14.0.3/class/Client), so check those docs for what
you can do with it. For example, if you want to add a listener to general events (like `messageCreate` for all messages)
, you can do so by using the regular event listening methods on the bot
object (`bot.on("messageCreate", async message => {...})`).

Additionally, the following properties are added to it by Aran:

* `bot.modules`: Access to all loaded bot components. The property keys are the module names (as in the subfolder names)
  . Using this, you can access your bot component's methods from your dashboard component, or access functions offered
  by helper modules.
* `bot.auth`: Authentication helper. Can be used on bot components to check whether the calling user is Staff, or on
  dashboard components to check whether the logged-in user is Staff. (It technically works like any other module, but we
  give it a special place and make sure it is loaded first.)
* `bot.cron`: You can call this method to schedule functions to be executed at certain times.
  `pattern` is a cron schedule expression, so you can use tools like https://crontab.guru/ to get one. The method
  returns a [CronJob object](https://www.npmjs.com/package/cron) you can store and use to stop the job. Note that
  schedules don't carry over on restarts - if you need persistent scheduled functions, store them in the database and
  re-schedule them when the module gets initialized.

#### Database Object

Similarly, the database object is really just
a [Sequelize ORM database object](https://sequelize.org/docs/v6/category/core-concepts/), with a wrapped `db.define`
method that will prefix the module name to the model and table names.

Additionally, it offers `db.modules`, which allows you to access all defined models. Just like the bot module list, you
use the module and model names as keys (for example, if you defined a model called `User` in the module `test`, you can
access it via `db.modules.test.User`). This way, you don't have to manually store and pass the models returned
by `db.define`.

### Bot Component

Bot components can use the Discord.JS client to interact with the Discord server to send messages, look up
channels/roles/users/etc. and so on. It is optional to have a bot component.

The bot component is implemented in the `bot.js` file in the module folder's root. It must export a function that takes
the bot and database objects as parameters, and returns an object with any number of the following methods:

* `textCommand(message, args)`: Is called if a registered text command with the command prefix from the configuration is
  sent in a channel the bot is in. `args` is the message content split at spaces.
* `button(interaction, args)`: Receives a button message component interaction from Discord.JS. `args` is the
  interaction ID split at hyphens.
* `selection(interaction, args)`: Receives a select menu message component interaction from Discord.JS. `args` is the
  interaction ID split at hyphens.
* `modal(interaction, args)`: Receives a modal submission from Discord.JS. `args` is the interaction ID split at
  hyphens.
* Any number of utility methods that can be used by the bot or other components as you like

Note that the bot is not logged in at the point where modules are loaded. If you want to run any initialization code
that requires you to be connected to Discord, make sure to register it as a `ready` event handler on the client object.

#### Regarding Message Component Interactions

If you use Discord's message components, like buttons and select menus, make sure their ID starts with your module's
name and a hyphen. The main bot uses this prefix to route component interactions to the correct module. So, for example,
for a module in the folder `rolebuttons`, all message component IDs must start with `rolebuttons-`.

Anything after that prefix can be whatever you want, to identify the button/menu or to carry information or a state, as
long as you stay below Discord's 100-character limit.

### Dashboard Component

Dashboard components are loaded into the frontend, so you can manage settings and such from a browser instead of having
to use chat commands. It is optional to have a dashboard component.

The dashboard component is implemented in the `dashboard.js` file in the module folder's root. It must export a function
taking the bot and database objects as parameters, and export an Express.JS router, which will be served at
the `/modulename/` URL of the dashboard. You probably want to implement some kind of index page since that is what the
module index will link to. However, you are not forced to - if you, for example, create a utility module that is only
used by other modules for data interchange, you can only implement those routes, and declare in the `info.json` file
that there is no dashboard for your module.

If you want to limit access to the dashboard, make sure to use one of the middlewares from`bot.auth`,
like `router.use(bot.auth.mustBeStaff);`. You can create a `views` subfolder in your module folder to add EJS templates
to use (make sure to include the header/footer). You can also create a `static` folder for resources used by the
dashboard. The `js`, `img`, `style` and `vendor` folders will be served by Express.JS at the `/js/modulename/`
, `/img/modulename/`, `/style/modulename/` and `/vendor/modulename/` URLs of the dashboard server. This is also done if
you don't have a dashboard component, so you can for example host images you want to use in embeds sent by the bot this
way.

### Database Models

Database models can be defined in the `db.js` file in the module folder's root. It must export a function taking the
database object as parameter. No return value is required. This allows you to call the `db.define` function to create
new models. (Please use that method instead of extending classes, as the wrapped `db.define` function makes sure to
prefix names with the module name and to add it to the `db.modules` list.)

If you want to do any work on the data before the bot or dashboard components are loaded (for example an integrity check
or something), make sure to call the model's `sync()` method first to load data. Otherwise, Aran will sync all models at
once after all modules are loaded.

### Initialization Order

Aran first loads the database, defines all module's models and sychronizes them. Then the bot will be initialized, all
module's bot components are loaded and finally the bot logs in. After that, the dashboard is initialized and the
dashboard components are loaded.

This means you can assume that the database is fully available in your bot component's initialization, and both the
database and bot can be used in the dashboard component's initialization.