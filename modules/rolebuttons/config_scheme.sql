CREATE TABLE "groups" (
	"id"	INTEGER NOT NULL,
	"name"	TEXT,
	"guild_id"	TEXT NOT NULL,
	"channel_id"	TEXT NOT NULL,
	"require_role_ids"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT)
)

CREATE TABLE "messages" (
	"id"	INTEGER NOT NULL,
	"group_id"	INTEGER NOT NULL,
	"display_order"	INTEGER NOT NULL,
	"title"	TEXT,
	"description"	TEXT,
	"color"	TEXT,
	"posted_msg_id"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("group_id") REFERENCES "groups"("id")
)

CREATE TABLE "buttons" (
	"id"	INTEGER NOT NULL,
	"message_id"	INTEGER NOT NULL,
	"display_row"	INTEGER NOT NULL,
	"display_order"	INTEGER NOT NULL,
	"role_id"	TEXT NOT NULL,
	"label"	TEXT,
	"emoji"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("message_id") REFERENCES "messages"("id")
)