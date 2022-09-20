const imageHandler = require("./imageHandler");
const layout = require("./layout");
const reader = require("./reader");
const Jimp = require("jimp");

(async () => {
    let img = await imageHandler.loadImage("https://media.discordapp.net/attachments/827558022078267462/1021811732034879549/Screenshot_20220920-235408.jpg?width=1280&height=606");
    let lay = await layout.getLayoutSIFASResult(img);
    await reader.SIFAS.skills(img, lay);
    Object.keys(lay).forEach(k => drawRect(img, lay[k]));
    await img.write("test.png");
})();

const RED = Jimp.rgbaToInt(255,0,0,255);
function drawRect(image, rect) {
    for (let x = rect.x; x <= rect.x + rect.w; x++) {
        image.setPixelColor(RED, x, rect.y);
        image.setPixelColor(RED, x, rect.y + rect.h);
    }
    for (let y = rect.y; y <= rect.y + rect.h; y++) {
        image.setPixelColor(RED, rect.x, y);
        image.setPixelColor(RED, rect.x + rect.w, y);
    }
}