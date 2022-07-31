const Jimp = require("jimp");
const imageHandler = require("./imageHandler");
const tesseract = require("node-tesseract-ocr");
const fs = require("fs");
const {closest} = require('fastest-levenshtein');
const layouts = require("./layout");
const log = require("../../../logger");

// psm: 7 - Page Segmentation Method 7: treat image as single line

async function readNumber(originalImage, bbox, threshold) {
    let tempName = "temp-" + Math.random().toString(36).substr(2, 5) + ".png"
    await imageHandler.prepareForOCR(originalImage, bbox, threshold).then(i => i.write(tempName));
    let res;
    try {
        res = await tesseract.recognize(tempName, {
            psm: 7,
            presets: ["digits"],
            tessedit_char_whitelist: "0123456789"
        });
    } catch (e) {
        return undefined;
    }
    fs.unlink(tempName, ()=>{});
    log.debug("PARTYSUBMIT", "OCR read number: " + res.trim());
    return res === "" ? undefined : Number(res);
}

async function readString(originalImage, bbox, threshold) {
    let tempName = "temp-" + Math.random().toString(36).substr(2, 5) + ".png"
    await imageHandler.prepareForOCR(originalImage, bbox, threshold).then(i => i.write(tempName));
    let res;
    try {
        res = await tesseract.recognize(tempName, {
            lang: "jpn",
            psm: 7
        });
    } catch (e) {
        return undefined;
    }
    fs.unlinkSync(tempName);
    log.debug("PARTYSUBMIT", "OCR read string: " + res.trim());
    return res.trim();
}

async function readStringWithOptions(originalImage, options, bbox, threshold) {
    return closest(await readString(originalImage, bbox, threshold), options);
}

async function getClosestPHashMatch(originalImage, options, bbox) {
    let image = await imageHandler.cropclone(originalImage, bbox.x, bbox.y, bbox.w, bbox.h);
    let hash = image.pHash();
    log.debug("PARTYSUBMIT", "OCR got picture hash: " + hash);
    let best = undefined, bestDist = undefined;
    for (let i in options) {
        let otherHash = options[i];
        let dist = Jimp.compareHashes(hash, otherHash);
        if (bestDist === undefined || dist < bestDist) {
            best = otherHash;
            bestDist = dist;
        }
    }
    return best;
}

const SIF = {
    async score(image, layouts) {
        return await readNumber(image, layouts.score, 200);
    },
    async mvp(image, layouts, options) {
        return await getClosestPHashMatch(image, options, layouts.song);
    },
    async combo(image, layouts) {
        return await readNumber(image, layouts.combo, 200);
    },
    async perfects(image, layouts) {
        return await readNumber(image, layouts.perfects, 200);
    },
    async greats(image, layouts) {
        return await readNumber(image, layouts.greats, 200);
    },
    async goods(image, layouts) {
        return await readNumber(image, layouts.goods, 200);
    },
    async bads(image, layouts) {
        return await readNumber(image, layouts.bads, 200);
    },
    async misses(image, layouts) {
        return await readNumber(image, layouts.misses, 200);
    },
    async hits(image, layouts) {
        return (await this.perfects(image, layouts)) + (await this.greats(image, layouts));
    }
}

const SIFAS = {
    async score(image, layouts) {
        return await readNumber(image, layouts.score, -200);
    },
    async mvp(image, layouts, options) {
        return await readStringWithOptions(image, options, layouts.song, -200);
    },
    async skills(image, layouts) {
        return await readNumber(image, layouts.skills, 150);
    }
}

module.exports = {SIF, SIFAS};

/*(async function() {
    let image = await imageHandler.loadImage("https://media.discordapp.net/attachments/832628579728752680/873727798357938206/Screenshot_2021-08-08-07-40-32-247_klb.android.lovelive_en.jpg");
    let layout = await layouts.getLayoutSIFResult(image);
    const o = {
        "1101001000001001011001000100000001010000000010001000000000000000": "NSNM",
        "1101001000011000001001100011000110100000001000101000000000000001": "DIVE"
    }
    let best = await getClosestPHashMatch(image,Object.keys(o),layout.song);
    console.log(o[best]);
})();*/