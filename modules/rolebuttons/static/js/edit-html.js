if (typeof module !== "undefined") {
    modules = {emoji: require("emoji-name-map")};
    module.exports = {makeMessage, makeButton, getEmojiShowHTML};
}

let counter = 0;

// https://stackoverflow.com/a/9756789
function quoteattr(s, preserveCR) {
    preserveCR = preserveCR ? '&#13;' : '\n';
    return ('' + s) /* Forces the conversion to string. */
        .replace(/&/g, '&amp;') /* This MUST be the 1st replacement. */
        .replace(/'/g, '&apos;') /* The 4 other predefined entities, required. */
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        /*
        You may add other replacements here for HTML only
        (but it's not necessary).
        Or for XML, only if the named entities are defined in its DTD.
        */
        .replace(/\r\n/g, preserveCR) /* Must be before the next replacement. */
        .replace(/[\r\n]/g, preserveCR);
    ;
}

function makeMessage(message) {
    let widths = [0, 0, 0, 0, 0];
    message.buttons.forEach(b => {
        widths[b.display_row]++;
    })
    let i = 4;
    while (widths[i] === 0) {
        widths[i] = "";
        i--;
    }
    widths[i] = "";

    counter++;
    return "<li class='rolebuttons-message collapsed' data-id='" + quoteattr(message.id) + "' data-posted_msg_id='" + quoteattr(message.posted_msg_id) + "'>" +
        "<label for='title" + counter + "'>Embed Title</label>" +
        "<input id='title" + counter + "' maxlength='256' class='rolebuttons-title' placeholder='(no embed)' value='" + quoteattr(message.title || "") + "'>" +
        "<div class='rolebuttons-toggle'></div>" +
        "<div class='row rolebuttons-embedinfo'><div class='two-thirds column'>" +
        "<label for='desc" + counter + "'>Embed Text</label>" +
        "<textarea id='desc" + counter + "' maxlength='4096' class='rolebuttons-description'>" + quoteattr(message.description || "") + "</textarea>" +
        "</div><div class='one-third column'>" +
        "<label for='color" + counter + "'>Embed Color (Hex Code)</label>" +
        "<input id='color" + counter + "' maxlength='6' class='rolebuttons-color' placeholder='none' value='" + quoteattr(message.color || "") + "'>" +
        "<div id='colorshow" + counter + "' class='rolebuttons-color-show' style='background-color: #" + quoteattr(message.color) + "'></div>" +
        "<label for='row1" + counter + "' style='margin-top: 1em'>Limit Buttons Per Row</label>" +
        "<input type='number' class='rolebuttons-rownum' id='row1" + counter + "' min='1' max='5' placeholder='5' value='" + widths[0] + "'>" +
        "<input type='number' class='rolebuttons-rownum' id='row2" + counter + "' min='1' max='5' placeholder='5' value='" + widths[1] + "'>" +
        "<input type='number' class='rolebuttons-rownum' id='row3" + counter + "' min='1' max='5' placeholder='5' value='" + widths[2] + "'>" +
        "<input type='number' class='rolebuttons-rownum' id='row4" + counter + "' min='1' max='5' placeholder='5' value='" + widths[3] + "'>" +
        "<input type='number' class='rolebuttons-rownum' id='row5" + counter + "' min='1' max='5' placeholder='5' value='" + widths[4] + "'>" +
        "</div></div><ol class='rolebuttons-buttonlist draglist'>" +
        message.buttons.map(makeButton).join("") +
        "</ol>" +
        "<a class='button button-primary rolebuttons-buttonadd'>Add Button</a> " +
        "<a class='button rolebuttons-messagecopy'>Copy Message</a> " +
        "<a class='button rolebuttons-messagedelete'>Delete Message</a></li>";
}

function makeButton(button) {
    let em = getEmojiShowHTML(button.emoji, button.label);
    counter++;
    return "<li class='rolebuttons-button row' data-id='" + quoteattr(button.id) + "'>" +
        "<div class='rolebuttons-emoji-show one column'>" + em + "</div>" +
        "<div class='three columns'>" +
        "<label for='label" + counter + "'>Button Label</label>" +
        "<input id='label" + counter + "' maxlength='80' class='rolebuttons-label' placeholder='(no label)' value='" + quoteattr(button.label || "") + "'>" +
        "</div><div class='three columns'>" +
        "<label for='emoji" + counter + "'>Button Emoji <span class='tooltip' title='Either the name of a Discord default emoji (without the :) or a custom emoji in the form of <:Name:ID> (easiest way to get this is to send the emoji with a \\ before it and copy the resulting code)'>🛈</span></label>" +
        "<input id='emoji" + counter + "' class='rolebuttons-emoji' placeholder='(no emoji)' value='" + quoteattr(button.emoji || "") + "'>" +
        "</div><div class='three columns'>" +
        "<label for='role" + counter + "'>Role ID</label>" +
        "<input id='role" + counter + "' maxlength='88' class='rolebuttons-role' placeholder='Role ID' value='" + quoteattr(button.role_id || "") + "'>" +
        "</div><div class='two columns'>" +
        "<a class='button rolebuttons-buttoncopy'>Copy</a><br><a class='button rolebuttons-buttondelete'>Delete</a>" +
        "</div></li>";
}

function getEmojiShowHTML(emoji, label) {
    if (emoji === null || emoji === "") {
        return "<span>" + label.substring(0, 1) + "</span>";
    } else if (emoji.indexOf(":") === -1) {
        let em = modules.emoji.get(emoji);
        if (em === undefined) em = "X";
        return "<span>" + em + "</span>";
    } else {
        let id = emoji.split(":");
        let ext = (id[0] === "a" || id[0] === "<a") ? "gif" : "png";
        id = id[id.length - 1];
        if (id.endsWith(">")) id = id.substr(0, id.length - 1);
        return "<img src='https://cdn.discordapp.com/emojis/" + id + "." + ext + "' alt='" + label + "'>";
    }
}