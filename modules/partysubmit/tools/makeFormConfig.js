const prefill = "";

let form = {
    "id": prefill.split("/d/e/")[1].split("/viewform")[0],
    "fields": {
        "userTag": undefined,
        "mvp": undefined,
        "score": undefined,
        "other": undefined,
        "images": []
    }
};

let unknown = undefined;
prefill.split("?")[1].split("&").filter(f => f.startsWith("entry.")).forEach(f => {
    const s = f.split("=");
    if (s[1] === "images") {
        form.fields.images.push(s[0]);
    } else if (form.fields.hasOwnProperty(s[1])) {
        form.fields[s[1]] = s[0];
    } else {
        if (unknown === undefined) {
            unknown = s[0];
        } else {
            console.error("Multiple unknown fields: " + unknown + " and " + s[0]);
            process.exit(1);
        }
    }
});

form.fields.mvp = unknown;

console.log("\"form\":" + JSON.stringify(form));