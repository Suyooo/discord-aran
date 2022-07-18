# Aran Bot

Bot for [the School Idol Festival Discord server](https://discord.gg/sif).

Note that this is the "private" part of Aran, as in, it is only used on SIFcord.  
The SIFAS Card/Song Lookup functions, which can be useful for other servers, are implemented
seperately as a different bot, so you can have it join your servers without all the extra stuff
in here. For info about that and the invite link, [check out the discord-sifaslookup repo](https://github.com/Suyooo/discord-sifaslookup/).

## Setup

If you want to run this yourself you need to:

* Run `npm install` to grab packages
* Create a `config.secret.json` file with three keys, `clientId`, `clientSecret` and `botToken`,
  being your app's client ID, client secret and bot token
* You probably want to change the `SIFCORD` constant in `config.js` to a test server's ID
* If you want to, change the port the dashboard runs on in `config.local.json` 
* Start the bot and dashboard with `npm start` or `node server.js`

## Implementing Modules

To avoid having to mess with too much of the code, new functions can be implemented as modules.
Generally, feel free to check the `rolebuttons` module as an example of how to implement the
following components.

To create a new module, make a new subfolder in the `modules` folder with an `info.json` file in
it and the following required keys:

* `dashboardTitle`: Label for the link to the module's dashboard on the index, or `null` if
  it shouldn't be linked on the dashboard (for utility modules, or modules without dashboards)

### Bot Component

Bot components can use the Discord.JS client to interact with the Discord server to send
messages, look up channels/roles/users/etc and so on. It is optional to have a bot component.

The bot component is implemented in the `bot.js` file in the module folder's root. It must
export a function that takes the Discord.JS client object as a parameter, and returns an object
with any number of the following methods:

* `async button(interaction)`: Receives a button message component interaction from Discord.JS
* `async selection(interaction)`: Receives a select menu message component interaction from
  Discord.JS
* Any number of utility methods that can be used by the bot or other components as you like

(TODO: some system to register for events like receiving messages, or to create "regular"
commands you can type in chat)

If you want to use a database to store configuration, you should make sure it gets automatically
created if the database file does not exist yet

#### Regarding Message Component Interactions

If you use Discord's message components, like buttons and select menus, make sure their ID
starts with your module's name and a hyphen. The main bot uses this prefix to route component
interactions to the correct module. So, for example, for a module in the folder `rolebuttons`,
all message component IDs must start with `rolebuttons-`.

Anything after that prefix can be whatever you want, to identify the button/menu or to carry
information or a state, as long as you stay below Discord's 100-character limit.

### Dashboard Component

Dashboard components are loaded into the frontend, so you can manage settings and such from a
browser instead of having to use chat commands. It is optional to have a dashboard component.

The dashboard component is implemented in the `dashboard.js` file in the module folder's root.
It must export an Express.JS router, which will be served at the `/modulename/` URL of the
dashboard. You probably want some index page since that is what the front page will link to.
However, you are not forced to - if you, for example, create a utility module that is only used
by other modules for data interchange, you can only implement those routes, and declare in the
`info.json` file that there is no dashboard for your module.

If you want to limit access to the dashboard, make sure to use one of the middlewares from
`auth.js`, like `router.use(auth.mustBeStaff);`. You can create a `views` subfolder in your
module folder to add EJS templates to use (make sure to include the header/footer). You can also
create a `static` folder for resources used by the dashboard. The `js`, `style` and `vendor`
folders will be served by Express.JS at the `/js/modulename/`, `/style/modulename/` and
`/vendor/modulename/` URLs of the dashbaord server.