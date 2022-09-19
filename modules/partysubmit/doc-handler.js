const parseGoogleDocsJson = require("./parse-google-docs-json");
const creds = require("./google-credentials.json");
const sheetHandler = require("./sheet-handler");

async function getPosts() {
    const documentId = await sheetHandler.getDocumentId();
    if (documentId === null) throw new Error("The forms and writing document were never created!");

    const parsed = await parseGoogleDocsJson({
        documentId,
        clientEmail: creds.client_email,
        privateKey: creds.private_key,
    });

    const sifLines = [];
    const sifasLines = [];
    let currentLines = undefined;

    for (const line of parsed.toJson().content) {
        if (line.hasOwnProperty("h1")) {
            if (line.h1 === "SIF Challenge Post") currentLines = sifLines;
            else if (line.h1 === "SIFAS Challenge Post") currentLines = sifasLines;
            else if (line.h1 === "SIF Results Post") break;
        } else {
            if (currentLines !== undefined) currentLines.push(line);
        }
    }

    const sifPosts = sifLines.map(l => l[Object.keys(l)[0]]).join("\n").trim().split("\n\n\n\n").map(p => p.trim());
    const sifasPosts = sifasLines.map(l => l[Object.keys(l)[0]]).join("\n").trim().split("\n\n\n\n").map(p => p.trim());

    const errors = [];
    if (sifPosts.some(p => p.length > 2000)) {
        errors.push("SIF Challenge Post is too long");
    }
    if (sifasPosts.some(p => p.length > 2000)) {
        errors.push("SIFAS Challenge Post is too long");
    }
    if (sifPosts.some(p => p.indexOf("{%%") !== -1)) {
        errors.push("SIF Challenge Post has unfinished to-dos (Ctrl+F and search for `{%%`)");
    }
    if (sifasPosts.some(p => p.indexOf("{%%") !== -1)) {
        errors.push("SIFAS Challenge Post has unfinished to-dos (Ctrl+F and search for `{%%`)");
    }
    if (errors.length > 0) throw new Error(errors.join("\n"));

    return {sifPosts, sifasPosts};
}

module.exports = {getPosts};