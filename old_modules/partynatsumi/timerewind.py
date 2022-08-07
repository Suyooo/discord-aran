# recreates player inventories at a certain turn

import sqlite3,json
TURN = 204

db = sqlite3.connect("destruction_timeline.db")
c = db.cursor()

invs = {}

for inv in c.execute("SELECT * FROM partynatsumi_inventories"):
    invs[inv[0]] = [10000,[0,0,0,0,0,0,0,0,0],None,None,json.loads(inv[5].replace("\\\"","\"")),inv[6],inv[6]]

for t in c.execute("SELECT * FROM partynatsumi_traderecords"):
    if t[2] >= TURN: continue
    invs[t[1]][0] += t[4]*t[5]
    invs[t[1]][1][t[3]] -= t[5]
    invs[t[1]][6] = t[6]

"""with open("timerewind-jobs","r") as jobs:
    for line in jobs.readlines():
        if "," not in line: continue
        invs[line.split(",")[1].split("\n")[0]][0] += 600"""

for k in invs:
    inv = invs[k]
    print("INSERT INTO partynatsumi_inventories VALUES(\""+k+"\","+str(inv[0])+",\""+json.dumps(inv[1]).replace('"','\\"')+"\",NULL,NULL,\""+json.dumps(inv[4]).replace('"','\\"')+"\",\""+inv[5]+"\",\""+inv[6]+"\");")
