# get numbers for extra MVPs

import sqlite3,json

db = sqlite3.connect("reset_timeline.db")
c = db.cursor()

invs = {}

for inv in c.execute("SELECT * FROM partynatsumi_inventories"):
    invs[inv[0]] = [inv[1],json.loads(inv[2].replace("\\\"","\"")),None,None,json.loads(inv[5].replace("\\\"","\"")),inv[6],inv[6]]

worsts = []
longs = []

for k in invs:
    periodstarts = [None for i in range(9)] # turn, min, max, amount
    worstperiod = (-1,0,0,0,0,0) # stonk, start turn, start price, end turn, end price, amount
    longperiod = (-1,0,0,0,0,0)
    for t in c.execute("SELECT * FROM partynatsumi_traderecords WHERE userId=\""+k+"\""):
        if t[5] < 0:
            if periodstarts[t[3]] == None:
                periodstarts[t[3]] = (t[2],t[4],t[4],t[5])
            else:
                periodstarts[t[3]] = (periodstarts[t[3]][0],periodstarts[t[3]][1],max(periodstarts[t[3]][2],t[4]),periodstarts[t[3]][3]+t[5])
        elif periodstarts[t[3]] != None:
            worstloss = periodstarts[t[3]][2] - t[4]
            if worstloss > (worstperiod[2]-worstperiod[4]):
                worstperiod = (t[3],periodstarts[t[3]][0],periodstarts[t[3]][2],t[2],t[4],0)
            if t[2]-periodstarts[t[3]][0] >= 100:
                longwin = t[4] - periodstarts[t[3]][1]
                if longwin > (longperiod[4]-longperiod[2]):
                    longperiod = (t[3],periodstarts[t[3]][0],periodstarts[t[3]][1],t[2],t[4],0)
            periodstarts[t[3]] = None
    if worstperiod[0] != -1:
        worsts.append((worstperiod[2]-worstperiod[4],k,worstperiod[0],worstperiod[2],worstperiod[4]))
    if longperiod[0] != -1:
        longs.append((longperiod[4]-longperiod[2],k,longperiod[0],longperiod[2],longperiod[4]))

print("bad call")
for t in reversed(sorted(worsts)): print(t)
print()
print("loveca hands")
for t in reversed(sorted(longs)): print(t)
print()

jobs = {}
with open("log","r") as log:
    # lazy solution to people re-clicking the job buttons: only check hour, record each hour only once
    for l in log.readlines():
        if "partynatsumi-job-" in l:
            if l.split("partynatsumi-job-")[1].split("\n")[0] not in jobs:
                jobs[l.split("partynatsumi-job-")[1].split("\n")[0]] = set()
            jobs[l.split("partynatsumi-job-")[1].split("\n")[0]].add(l.split(":")[0])

jobcount = []
for k in jobs:
    jobcount.append((len(jobs[k]), k))
print("hard worker")
for t in reversed(sorted(jobcount)): print(t)
