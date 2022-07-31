const imageHandler = require("../ocr/imageHandler");
const layout = require("../ocr/layout");
(async function() {
    let image = await imageHandler.loadImage("");
    await image.resize(150, 150);
    await image.crop(image.bitmap.width * 0.05, image.bitmap.height * 0.05, image.bitmap.width * 0.9, image.bitmap.height * 0.6);
    console.log(image.pHash());
})();