# sells all leftover stocks for the last price

import discord
import sqlite3,json


class MyClient(discord.Client):
    async def on_ready(self):
        db = sqlite3.connect("reset_timeline.db")
        c = db.cursor()

        invs = {}

        for inv in c.execute("SELECT * FROM partynatsumi_inventories"):
            invs[inv[0]] = [inv[1],json.loads(inv[2].replace("\\\"","\"")),None,None,json.loads(inv[5].replace("\\\"","\"")),inv[6],inv[6]]

        p = [192,197,133,297,91,105,93,176,185]
        l = []

        for k in invs:
            inv = invs[k]
            for i in range(9):
                inv[0] += inv[1][i] * p[i]
                inv[1][i] = 0
            l.append((inv[0],k))
            
        for t in reversed(sorted(l)):
            print(((await self.fetch_user(t[1])).name)+": "+str(t[0]))
            #print(t[1]+": "+str(t[0]))

intents = discord.Intents(messages=True, guilds=True)

client = MyClient(intents=intents)
client.run('fuck')
