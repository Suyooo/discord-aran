function getFormInfo(url) {
    let form = {
        "id": url.split("/d/e/")[1].split("/viewform?")[0],
        "fields": {
            "userTag": undefined,
            "mvp": undefined,
            "score": undefined,
            "other": undefined,
            "images": []
        }
    };

    let unknown = undefined;
    url.split("&").filter(f => f.startsWith("entry.")).forEach(f => {
        const s = f.split("=");
        if (s[1] === "images") {
            form.fields.images.push(s[0]);
        } else if (form.fields.hasOwnProperty(s[1])) {
            form.fields[s[1]] = s[0];
        } else if (s[0] !== "usp") {
            if (unknown === undefined) {
                unknown = s[0];
            } else {
                throw new Error("Multiple unknown fields: " + unknown + " and " + s[0]);
            }
        }
    });

    form.fields.mvp = unknown;

    if (form.fields.userTag === undefined) throw new Error("NO USER TAG FIELD FOUND");
    if (form.fields.mvp === undefined) throw new Error("NO MVP FIELD FOUND");
    if (form.fields.score === undefined) throw new Error("NO SCORE FIELD FOUND");
    if (form.fields.images.length < 2) throw new Error("LESS THAN TWO IMAGE FIELDS FOUND");

    return form;
}

module.exports = getFormInfo;