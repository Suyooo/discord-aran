const imageHandler = require("../ocr/imageHandler");
const layout = require("../ocr/layout");

async function getPHash(url) {
    let image = await imageHandler.loadImage(url);
    await image.resize(150, 150);
    await image.crop(image.bitmap.width * 0.05, image.bitmap.height * 0.05, image.bitmap.width * 0.9, image.bitmap.height * 0.6);
    return image.pHash();
}
module.exports = getPHash;