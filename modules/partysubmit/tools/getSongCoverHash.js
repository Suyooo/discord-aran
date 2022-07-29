const imageHandler = require("./ocr/imageHandler");
const layout = require("./ocr/layout");
/*(async function() {
    let image = await imageHandler.loadImage("https://cdn.discordapp.com/attachments/926146147913982003/947837682837508126/Screenshot_20220228-134049.png");
    let layouts = await layout.getLayoutSIFResult(image);
    await image.crop(layouts.song.x,layouts.song.y,layouts.song.w,layouts.song.h);
    console.log(image.pHash());
})();*/
(async function() {
    let image = await imageHandler.loadImage("https://card.llsif.moe/asset/assets/image/live/live_icon/j_bd_05_01.png");
    await image.resize(150, 150);
    await image.crop(image.bitmap.width * 0.05, image.bitmap.height * 0.05, image.bitmap.width * 0.9, image.bitmap.height * 0.6);
    console.log(image.pHash());
})();