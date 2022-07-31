const imageHandler = require("./imageHandler");

async function getLayoutSIFResult(originalImage) {
    // find bottom box (with the accuracies), find the rest from there
    let image = await imageHandler.cropclone(originalImage,
        originalImage.bitmap.width * 0.475, originalImage.bitmap.height * 0.8, originalImage.bitmap.width * 0.525, originalImage.bitmap.height * 0.2 - 1);
    await image.grayscale();
    await image.normalize();
    let longestStreakLength = 0, longestStreakStart = 0, firstLongStreak = undefined;
    for (let y = image.bitmap.height - 1; y >= 0; y--) {
        let currentStreakLength = 0, currentStreakStart = 0;
        for (let x = 0; x < image.bitmap.width; x++) {
            let idx = image.getPixelIndex(x, y);
            if (image.bitmap.data[idx] > 245) {
                currentStreakLength++;
                if (currentStreakLength > longestStreakLength) {
                    longestStreakLength = currentStreakLength;
                    longestStreakStart = currentStreakStart;
                    if (firstLongStreak === undefined && currentStreakLength > image.bitmap.width * 0.2) {
                        firstLongStreak = y;
                    }
                }
            } else {
                currentStreakLength = 0;
                currentStreakStart = x + 1;
            }
        }
    }

    let bbox = {
        x: originalImage.bitmap.width * 0.475 + longestStreakStart,
        y: originalImage.bitmap.height * 0.8 + firstLongStreak - longestStreakLength / 2,
        w: longestStreakLength,
        h: longestStreakLength / 2
    };

    let layouts = {
        bbox,
        score: {
            x: bbox.x + bbox.w * 0.45,
            y: bbox.y - bbox.h * 0.425,
            w: bbox.w * 0.5,
            h: bbox.h * 0.175
        },
        combo: {
            x: bbox.x + bbox.w * 0.7,
            y: bbox.y + bbox.h * 0.02,
            w: bbox.w * 0.25,
            h: bbox.h * 0.155
        },
        perfects: {
            x: bbox.x + bbox.w * 0.75,
            y: bbox.y + bbox.h * 0.225,
            w: bbox.w * 0.2,
            h: bbox.h * 0.15
        },
        greats: {
            x: bbox.x + bbox.w * 0.75,
            y: bbox.y + bbox.h * 0.375,
            w: bbox.w * 0.2,
            h: bbox.h * 0.15
        },
        goods: {
            x: bbox.x + bbox.w * 0.75,
            y: bbox.y + bbox.h * 0.525,
            w: bbox.w * 0.2,
            h: bbox.h * 0.15
        },
        bads: {
            x: bbox.x + bbox.w * 0.75,
            y: bbox.y + bbox.h * 0.675,
            w: bbox.w * 0.2,
            h: bbox.h * 0.165
        },
        misses: {
            x: bbox.x + bbox.w * 0.75,
            y: bbox.y + bbox.h * 0.84,
            w: bbox.w * 0.2,
            h: bbox.h * 0.145
        },
        song: {
            x: bbox.x + bbox.w * 0.015,
            y: bbox.y - bbox.h * 1.11,
            w: bbox.w * 0.17,
            h: bbox.h * 0.235
        }
    }

    if (hasInvalidLayout(layouts, originalImage.bitmap.width, originalImage.bitmap.height)) {
        return undefined;
    }
    return layouts;
}

async function getLayoutSIFASResult(originalImage) {
    // find MVP box, find the rest from there
    let usedHeight = Math.min(originalImage.bitmap.height, originalImage.bitmap.width / 16 * 9);
    let image =  await imageHandler.cropclone(originalImage,
        originalImage.bitmap.width * 0.3, originalImage.bitmap.height * 0.55, originalImage.bitmap.width * 0.11, usedHeight * 0.35);
    await image.grayscale();
    await image.normalize();
    let streaks = {};
    for (let x = 0; x < image.bitmap.width; x++) {
        let currentStreakLength = 0, currentStreakStart = 0, colLongestStreakLength = 0, colLongestStreakStart = 0,
            anyFound = false;
        for (let y = 0; y < image.bitmap.height; y++) {
            let idx = image.getPixelIndex(x, y);
            if (image.bitmap.data[idx] > 175) {
                image.bitmap.data[idx] = 255;
                image.bitmap.data[idx + 1] = 0;
                image.bitmap.data[idx + 2] = 0;
                anyFound = true;
                currentStreakLength++;
                if (currentStreakLength > colLongestStreakLength) {
                    colLongestStreakLength = currentStreakLength;
                    colLongestStreakStart = currentStreakStart;
                }
            } else {
                currentStreakLength = 0;
                currentStreakStart = y + 1;
            }
        }
        if (!anyFound) break;

        let k = colLongestStreakLength + "," + colLongestStreakStart;
        if (!streaks.hasOwnProperty(k)) streaks[k] = {c: 0, x: 0}
        streaks[k].c++;
        streaks[k].x = x;
    }

    let filteredStreaks = Object.keys(streaks)
        .filter(x => Number(x.split(",")[0]) > image.bitmap.height * 0.66);

    if (filteredStreaks.length === 0) {
        return undefined;
    }

    let mostFrequentStreak = filteredStreaks.reduce((p, c) => !p || streaks[p].c < streaks[c].c ? c : p);
    let longestStreakLength = Number(mostFrequentStreak.split(",")[0]),
        longestStreakStart = Number(mostFrequentStreak.split(",")[1]);

    // corners of the box might not be perfect, do a little range check for the true right side
    let lastLongStreak = 0;
    for (let startOffset = -3; startOffset <= 3; startOffset++) {
        for (let lengthOffset = -3; lengthOffset <= 3; lengthOffset++) {
            let checkKey = (longestStreakLength + lengthOffset) + "," + (longestStreakStart + startOffset);
            if (streaks.hasOwnProperty(checkKey) && streaks[checkKey].x > lastLongStreak) {
                lastLongStreak = streaks[checkKey].x;
            }
        }
    }

    let bbox = {
        x: originalImage.bitmap.width * 0.3 + lastLongStreak - longestStreakLength * 2,
        y: originalImage.bitmap.height * 0.55 + longestStreakStart,
        w: longestStreakLength * 2,
        h: longestStreakLength
    };

    let layouts = {
        bbox,
        score: {
            x: bbox.x + bbox.w * 1.66,
            y: bbox.y - bbox.h * 1.66,
            w: bbox.w * 0.89,
            h: bbox.h * 0.194
        },
        skills: {
            x: bbox.x + bbox.w * 0.75,
            y: bbox.y + bbox.h * 0.65,
            w: bbox.w * 0.2,
            h: bbox.h * 0.13
        },
        attribute: {
            x: bbox.x + bbox.w * 1.115,
            y: bbox.h * 0.21,
            w: bbox.w * 0.085,
            h: bbox.h * 0.165
        },
        song: {
            x: bbox.x + bbox.w * 1.2,
            y: bbox.h * 0.21,
            w: bbox.w * 1.3,
            h: bbox.h * 0.165
        }
    };

    if (hasInvalidLayout(layouts, originalImage.bitmap.width, originalImage.bitmap.height)) {
        return undefined;
    }

    // cut off the smaller font size part of the score bounding box
    let scoreBoxImage = await imageHandler.prepareForOCR(originalImage, layouts.score, -200);
    let searchY = scoreBoxImage.bitmap.height * 0.33;
    let rightEdge = scoreBoxImage.bitmap.width - 1;
    while (scoreBoxImage.bitmap.data[scoreBoxImage.getPixelIndex(rightEdge, searchY)] === 255) {
        rightEdge--;
        if (rightEdge < 0) {
            rightEdge = scoreBoxImage.bitmap.width - 1;
            searchY += 5;
            if (searchY > scoreBoxImage.bitmap.height / 2) return undefined;
        }
    }
    // we found the toppest rightest pixel - from there, move right until the character is over
    let pixelsInColumn = true;
    while (pixelsInColumn) {
        if (rightEdge >= scoreBoxImage.bitmap.width) break;
        rightEdge++;
        pixelsInColumn = false;
        for (let y = 0; y < scoreBoxImage.bitmap.height; y++) {
            if (scoreBoxImage.bitmap.data[scoreBoxImage.getPixelIndex(rightEdge, y)] === 0) {
                pixelsInColumn = true;
                break;
            }
        }
    }
    // rightEdge is now right between the last actual score digit and the slash
    layouts.score.w = rightEdge;

    return layouts;
}

function hasInvalidLayout(layouts, width, height) {
    for (let k in layouts) {
        let layout = layouts[k];
        if (layout.x < 0 || layout.x >= width) return true;
        if (layout.x + layout.w < 0 || layout.x + layout.w > width) return true;
        if (layout.y < 0 || layout.y >= height) return true;
        if (layout.y + layout.h < 0 || layout.y + layout.h > height) return true;
    }
    return false;
}

module.exports = {getLayoutSIFResult, getLayoutSIFASResult};