let blockButtons = false;
let changed = false;

window.onbeforeunload = function (e) {
    if (changed) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
    }
};

function removeEmpty(obj) {
    const newObj = {};
    Object.entries(obj).forEach(([k, v]) => {
        if (Array.isArray(v)) {
            newObj[k] = v;
            if (newObj[k].length === 0) delete newObj[k];
        } else if (v === Object(v)) {
            newObj[k] = removeEmpty(v);
            if (Object.keys(obj).length === 0) delete newObj[k];
        } else if (v != null) {
            newObj[k] = obj[k];
        }
    });
    return newObj;
}

$(function () {
    counter = $(".rolebuttons-message, .rolebuttons-button").length;

    setUpEvents();
    $("#rolebuttons-messageadd").on("click", e => {
        let i = $("ol.rolebuttons-messagelist");
        let n = $(makeMessage({
            id: null,
            title: "",
            description: "",
            color: "",
            buttons: []
        }));
        i.append(n);
        setUpEvents(n);
        n.removeClass("collapsed");
    });
    $("#rolebuttons-save").on("click", (e) => {
        if (blockButtons) return;
        blockButtons = true;
        let bb = $(".blockbutton");
        bb.removeClass("button-primary");
        // noinspection JSJQueryEfficiency
        $(".rolebuttons-error").removeClass("rolebuttons-error");

        let res = $("ol.rolebuttons-messagelist").sortable("serialize")[0];
        // noinspection JSJQueryEfficiency
        if ($(".rolebuttons-error").length > 0) {
            bb.addClass("button-primary");
            blockButtons = false;
        } else {
            $.ajax({
                type: "PUT",
                url: "../save/",
                contentType: "application/json",
                data: JSON.stringify(removeEmpty(res))
            }).done((res) => {
                alert("Saved.");
                changed = false;
                if (group_id === null) window.location.href = "../" + res.id + "/";
                else window.location.reload();
            }).fail((jqxhr, textStatus, error) => {
                alert("Error while saving: " + error);
                bb.addClass("button-primary");
                blockButtons = false;
            });
        }
    });
    $("#rolebuttons-post").on("click", () => callBotPost(true));
    $("#rolebuttons-update").on("click", () => callBotPost(false));
    $("#rolebuttons-delete").on("click", () => deleteGroup());

    $("ol.rolebuttons-messagelist").sortable({
        group: 'nested',
        delay: 200,
        isValidTarget: function ($item, container) {
            if ($item.is(".rolebuttons-button")) {
                let c = $(container.el[0]);
                return c.is(".rolebuttons-buttonlist") && !c.parent().is(".collapsed");
            } else if ($item.is(".rolebuttons-message")) {
                return $(container.el[0]).is(".rolebuttons-messagelist");
            }
            return false;
        },
        onMousedown: function ($item, _super, event) {
            if (!event.target.nodeName.match(/^(input|select|textarea)$/i) && !event.target.className.match(/^(rolebuttons-toggle)$/i)) {
                event.preventDefault();
                return true;
            }
        },
        onDragStart: function() {
            changed = true;
        },
        serialize: function ($parent, $children, parentIsContainer) {
            if (!parentIsContainer) {
                if ($parent.is(".rolebuttons-button")) {
                    let label = $(".rolebuttons-label", $parent);
                    if (label.is(":valid")) {
                        label = label.val() || null;
                    } else {
                        pushError("Invalid label", $parent);
                    }

                    let emoji = $(".rolebuttons-emoji", $parent).val() || null;
                    if (getEmojiShowHTML(emoji, "") === "<span>X</span>") {
                        pushError("Invalid emoji", $parent);
                    }

                    if (label === null && emoji === null) {
                        pushError("Buttons must have either a Label, an Emoji or both", $parent);
                    }

                    let role = $(".rolebuttons-role", $parent).val() || null;
                    if (role === null) {
                        pushError("Buttons must have a Role ID set", $parent);
                    }

                    return {
                        id: Number($parent.data("id")) || null,
                        role_id: role,
                        label: label,
                        emoji: emoji
                    }
                } else if ($parent.is(".rolebuttons-message")) {
                    let col = $(".rolebuttons-color", $parent).val() || null;
                    if (col && (col.length !== 6 || col.match(/[^0-9a-fA-F]/i))) {
                        pushError("Invalid color", $parent);
                    }

                    let title = $(".rolebuttons-title", $parent);
                    if (title.is(":valid")) {
                        title = title.val() || null;
                    } else {
                        pushError("Invalid title", $parent);
                    }

                    let description = $(".rolebuttons-description", $parent);
                    if (description.is(":valid")) {
                        description = description.val() || null;
                    } else {
                        pushError("Invalid description", $parent);
                    }

                    return {
                        id: Number($parent.data("id")) || null,
                        title: title,
                        description: description,
                        color: col,
                        buttons: $children
                    }
                }
            } else {
                if ($parent.is(".rolebuttons-buttonlist")) {
                    let msg = $parent.parent();
                    if ($children.length > 25) {
                        pushError("Maximum amount of buttons is 25", msg);
                        return;
                    }

                    let widths = $(".rolebuttons-rownum", msg).toArray().map(i => Number($(i).val()) || 5);
                    widths.forEach(w => {
                        if (w < 1 || w > 5) pushError("Invalid row button limit", msg);
                    });
                    let i = 0;

                    return $children.map(c => {
                        c.message_id = Number(msg.data("id"));
                        c.display_order = i++;
                        c.display_row = 0;
                        while (widths[c.display_row] === 0) {
                            c.display_row++;
                            if (c.display_row > 4) {
                                pushError("Row button limits don't allow enough space for all the buttons", msg);
                                return;
                            }
                        }
                        widths[c.display_row]--;
                        return c;
                    });
                } else {
                    let gid = $(".rolebuttons-guild").val() || null;
                    if (gid === null) {
                        pushError("Server ID is required", $("#rolebuttons-header"));
                    }
                    let cid = $(".rolebuttons-channel").val() || null;
                    if (cid === null) {
                        pushError("Channel ID is required", $("#rolebuttons-header"));
                    }
                    let i = 0;
                    return {
                        id: group_id,
                        title: $(".rolebuttons-groupname").val() || null,
                        guild_id: gid,
                        channel_id: cid,
                        require_role_ids: $(".rolebuttons-require").val() || null,
                        send_reply: $("#rolebuttons-reply").is(":checked"),
                        delete_messages: messagesToDelete,
                        delete_buttons: buttonsToDelete,
                        messages: $children.map(c => {
                            c.group_id = group_id;
                            c.display_order = i++;
                            return c;
                        })
                    }
                }
            }
        }
    });

    window.onbeforeunload = function (e) {
        if (changed) {
            e.preventDefault();
            e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        }
    };
});

let messagesToDelete = [];
let buttonsToDelete = [];

function setUpEvents(parent) {
    $(".rolebuttons-toggle", parent).on("click", e => $(e.currentTarget).parent().toggleClass("collapsed"));
    $(".rolebuttons-color", parent).on("change", e => {
        let i = $(e.currentTarget);
        i.next().css("background-color", "#" + i.val());
    });
    $(".rolebuttons-label", parent).on("change", e => {
        let i = $(e.currentTarget);
        $(".rolebuttons-emoji-show", i.parent().parent()).html(getEmojiShowHTML($(".rolebuttons-emoji", i.parent().parent()).val(), i.val()));
    });
    $(".rolebuttons-emoji", parent).on("change", e => {
        let i = $(e.currentTarget);
        $(".rolebuttons-emoji-show", i.parent().parent()).html(getEmojiShowHTML(i.val(), $(".rolebuttons-label", i.parent().parent()).val()));
    });
    $(".rolebuttons-messagecopy", parent).on("click", e => {
        let i = $(e.currentTarget).parent();
        let n = $(makeMessage({
            id: null,
            title: $(".rolebuttons-title", i).val() || "",
            description: $(".rolebuttons-description", i).val() || "",
            color: $(".rolebuttons-color", i).val() || "",
            buttons: $(".rolebuttons-button", i).toArray().map(e => {
                return {
                    id: null,
                    role_id: $(".rolebuttons-role", e).val() || "",
                    label: $(".rolebuttons-label", e).val() || "",
                    emoji: $(".rolebuttons-emoji", e).val() || ""
                }
            })
        }));
        i.after(n);
        setUpEvents(n);
        i.addClass("collapsed");
        changed = true;
    });
    $(".rolebuttons-messagedelete", parent).on("click", e => {
        if (!confirm("Are you sure you want to delete this message?")) return;
        let i = $(e.currentTarget).parent();
        let n = Number(i.data("id"));
        if (n) {
            messagesToDelete.push(n);
            changed = true;
        }
        i.remove();
    });
    $(".rolebuttons-buttonadd", parent).on("click", e => {
        let i = $("ol.rolebuttons-buttonlist", $(e.currentTarget).parent());
        let n = $(makeButton({
            id: null, role_id: "", label: "", emoji: ""
        }));
        i.append(n);
        setUpEvents(n);
    });
    $(".rolebuttons-buttoncopy", parent).on("click", e => {
        let i = $(e.currentTarget).parent().parent();
        let n = $(makeButton({
            id: null,
            role_id: $(".rolebuttons-role", i).val() || "",
            label: $(".rolebuttons-label", i).val() || "",
            emoji: $(".rolebuttons-emoji", i).val() || ""
        }));
        i.after(n);
        setUpEvents(n);
        changed = true;
    });
    $(".rolebuttons-buttondelete", parent).on("click", e => {
        if (!confirm("Are you sure you want to delete this button?")) return;
        let i = $(e.currentTarget).parent().parent();
        let n = Number(i.data("id"));
        if (n) {
            buttonsToDelete.push(n);
            changed = true;
        }
        i.remove();
    });
    $("input,textarea,select").on("change", () => {
        changed = true;
    });
}

function pushError(text, element) {
    element.attr("data-error", text).addClass("rolebuttons-error");
    element.parents(".rolebuttons-message").attr("data-error", "").addClass("rolebuttons-error");
}

function callBotPost(deleteMessages) {
    if (blockButtons) return;
    if (changed) {
        alert("You have made changes that you haven't saved yet. Please save them first, then post the messages!");
        return;
    }
    if (!confirm("Do you really want to " + (deleteMessages ? "delete and repost" : "update") + " all messages? (OK for Yes, Cancel for No)")) return;
    blockButtons = true;

    let bb = $(".blockbutton");
    bb.removeClass("button-primary");

    $.ajax({
        type: "PUT",
        url: "../" + (deleteMessages ? "post" : "update") + "/",
        contentType: "application/json",
        data: JSON.stringify({id: group_id})
    }).done((res) => {
        alert("Finished!");
        bb.addClass("button-primary");
        blockButtons = false;
    }).fail((jqxhr, textStatus, error) => {
        alert("Error while posting: " + error);
        bb.addClass("button-primary");
        blockButtons = false;
    });
}

function deleteGroup() {
    if (blockButtons) return;
    if (!confirm("Do you really want to to delete this entire group? (OK for Yes, Cancel for No)")) return;
    if (!confirm("Actually really seriously? This group can not be recovered. All messages will be deleted. One final time, do you want to delete this role button group? (OK for Yes, Cancel for No)")) return;
    blockButtons = true;

    let bb = $(".blockbutton");
    bb.removeClass("button-primary");

    $.ajax({
        type: "DELETE",
        url: "../delete/",
        contentType: "application/json",
        data: JSON.stringify({id: group_id})
    }).done((res) => {
        window.location.href = "..";
    }).fail((jqxhr, textStatus, error) => {
        alert("Error while deleting: " + error);
        bb.addClass("button-primary");
        blockButtons = false;
    });
}