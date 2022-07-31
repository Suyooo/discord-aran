const Jimp = require("jimp");

async function loadImage(url, coloured) {
    return await Jimp.read(url);
}

async function makeCollage(urls, w, h) {
    const image = await Jimp.read(urls[0]);
    await image.contain(urls.length * w, h, Jimp.HORIZONTAL_ALIGN_LEFT | Jimp.VERTICAL_ALIGN_TOP);
    for (let i = 1; i < urls.length; i++) {
        const next = await Jimp.read(urls[i]);
        image.blit(next, w * i, 0);
    }
    return new Buffer.from((await image.getBase64Async(Jimp.MIME_PNG)).split(",")[1], "base64");
}

async function threshold(image, thresh, invert) {
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
        let c = image.bitmap.data[idx] < thresh ? (invert ? 255 : 0) : (invert ? 0 : 255);

        image.bitmap.data[idx] = c;
        image.bitmap.data[idx + 1] = c;
        image.bitmap.data[idx + 2] = c;
    });
    return image;
}

async function prepareForOCR(originalImage, bbox, thresh) {
    const image = await cropclone(originalImage, bbox.x, bbox.y, bbox.w, bbox.h);
    await image.grayscale();
    await image.normalize();
    await threshold(image, Math.abs(thresh), thresh < 0);
    return image;
}

function cropclone(originalImage, x, y, w, h) {
    return new Promise((resolve) => {
        new Jimp(w, h, (err, image) => {
            if (err !== null) throw err;
            image.blit(originalImage, 0, 0, x, y, w, h, (err, i) => {
                if (err !== null) throw err;
                resolve(i)
            });
        });
    });
}

module.exports = {loadImage, makeCollage, prepareForOCR, cropclone};