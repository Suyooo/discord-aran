# sells all leftover stocks for the last price

import sqlite3,json

db = sqlite3.connect("othertimeline.db")
c = db.cursor()

invs = {}

for inv in c.execute("SELECT * FROM partynatsumi_inventories"):
    invs[inv[0]] = [inv[1],json.loads(inv[2].replace("\\\"","\"")),None,None,json.loads(inv[5].replace("\\\"","\"")),inv[6],inv[6]]

p = [159,168,84,350,78,147,183,198,786]
l = []

for k in invs:
    inv = invs[k]
    for i in range(9):
        inv[0] += inv[1][i] * p[i]
        inv[1][i] = 0
    l.append((inv[0],k))
    
for t in sorted(l):
    print(t)
