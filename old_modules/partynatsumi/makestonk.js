const Jimp = require("jimp");

const rand = [];
const POINT_COUNT = 5;

const OFF = Math.random() * 50 + 50;
const MULTI = Math.random() * 3 + 0.5;
console.log(OFF,MULTI,"=>",Math.floor(OFF),Math.floor(OFF+MULTI*100));

rand.push([0, Math.random() * 100]);
rand.push([288, Math.random() * 100]);
for (let x = 0; x < POINT_COUNT / 2; x++) {
    rand.push([Math.floor(Math.random() * 144), Math.random() * 100]);
}
for (let x = 0; x < POINT_COUNT / 2; x++) {
    rand.push([Math.floor(Math.random() * 144) + 144, Math.random() * 100]);
}

const points = rand.sort((a, b) => a[0] - b[0]);

function subdivide(a, b, x) {
    const aa = [(a[0] + a[2]) / 2, (a[1] + a[3]) / 2];
    const bb = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    return [[a[0], a[1], aa[0], aa[1]], [aa[0], aa[1], bb[0], bb[1]], [bb[0], bb[1], b[2], b[3]]];
}

let lines = [];
for (let i = 1; i < points.length; i++) {
    lines.push(points[i - 1].concat(points[i]));
}

for (let x = 0; x < 5; x++) {
    const newLines = [];
    for (let i = 1; i < lines.length; i++) {
        const a = i === 1 ? lines[i - 1]
            : [(lines[i - 1][0] + lines[i - 1][2]) / 2, (lines[i - 1][1] + lines[i - 1][3]) / 2, lines[i - 1][2], lines[i - 1][3]];
        const b = i === lines.length - 1 ? lines[i]
            : [lines[i][0], lines[i][1], (lines[i][0] + lines[i][2]) / 2, (lines[i][1] + lines[i][3]) / 2];
        const [aa, bb, cc] = subdivide(a, b, 0);
        newLines.push(aa, bb, cc);
    }
    lines = newLines;
}

const BLACK = Jimp.rgbaToInt(200, 200, 200, 255);
const LIGHTRED = Jimp.rgbaToInt(255, 200, 200, 255);
const GREEN = Jimp.rgbaToInt(0, 200, 0, 255);
const RED = Jimp.rgbaToInt(255, 0, 0, 255);
new Jimp(288, 100, 0xffffffff, (err, image) => {
    if (err !== null) throw err;
    let current = 0;
    let groupRandom = Math.random();
    let nextGroupIn = Math.floor(Math.random() * 5) + 5;
    let last = 0;
    const results = [];
    for (let x = 0; x <= 288; x++) {
        nextGroupIn--;
        if (nextGroupIn <= 0) {
            groupRandom = Math.random();
            nextGroupIn = Math.floor(Math.random() * 5) + 5;
        }
        if (x < 144) {
            for (let y = 0; y < 100; y++) {
                image.setPixelColor(LIGHTRED, x, y);
            }
        }
        while (lines[current][2] < x) {
            current++;
        }

        let thisRandom = Math.random();
        const y = (lines[current][3] - lines[current][1]) / (lines[current][2] - lines[current][0]) * (x - lines[current][0]) + lines[current][1];
        let randY = y + (groupRandom - .5) * 15 + (thisRandom - .5) * 10;
        results.push(randY*MULTI+OFF);
        randY = Math.floor(randY);
        if (x > 0) {
            image.setPixelColor(BLACK, x - 1, 100 - Math.floor(y));
            for (let yy = Math.min(last, randY); yy <= Math.max(last, randY); yy++) {
                image.setPixelColor(last < randY ? GREEN : RED, x - 1, 100 - yy);
            }
        }
        last = randY;
    }
    image.write("graph.png");
    console.log("[" + results.join(",") + "]");
});