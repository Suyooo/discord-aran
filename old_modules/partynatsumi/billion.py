# who has a billion money

import sqlite3,json

db = sqlite3.connect("othertimeline.db")
c = db.cursor()

invs = {}

for inv in c.execute("SELECT * FROM partynatsumi_inventories"):
    invs[inv[0]] = [10000,[0,0,0,0,0,0,0,0,0],None,None,json.loads(inv[5].replace("\\\"","\"")),inv[6],inv[6]]

for t in c.execute("SELECT * FROM partynatsumi_traderecords"):
    invs[t[1]][0] += t[4]*t[5]
    invs[t[1]][1][t[3]] -= t[5]
    invs[t[1]][6] = t[6]
    
    if (invs[t[1]][0] >= 1000000000):
        print("BILLION ALERT @ TURN",t[2],t[1])
