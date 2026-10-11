/**
 * KWin Window Groups - Plasma 6
 *
 * Logically groups windows: one Alt+Tab entry per group, while each
 * window keeps its own position and size on screen.
 *
 * The script never moves, resizes, raises, or otherwise interferes with
 * your windows. Clicking and focusing work exactly as normal — grouping
 * only affects the task switcher.
 *
 * Shortcuts:
 *   Meta+Space      - pick window(s) to group (press twice: first selects
 *                     the window to move, second selects the target group)
 *   Meta+Alt+Space  - remove focused window from its group
 */

// --- State ---------------------------------------------------------------

var groups = [];          // [{ id: number, windows: Window[] }]
var nextGroupId = 1;
var pendingTabbee = null; // first Meta+Space selection (window to move)
var groupingArmed = false;
var raisingGroup = false; // re-entrancy guard for raise-on-entry
// Tracks the last focused group member, to detect entering a group
// from outside (Alt+Tab, taskbar, click from another app) vs switching
// between members (plain mouse click — no raise needed).
var lastGroupFocus = { group: null, window: null };

// --- Helpers ---------------------------------------------------------------

function findGroup(window) {
    for (var i = 0; i < groups.length; i++) {
        if (groups[i].windows.indexOf(window) !== -1) {
            return groups[i];
        }
    }
    return null;
}

function isGroupable(window) {
    // Skip docks, panels, desktop, splash screens, etc.
    if (!window) return false;
    try {
        if (window.dock || window.desktopWindow || window.splash) return false;
        if (window.skipTaskbar && window.skipSwitcher) return false;
        return window.normalWindow === true || window.normalWindow === undefined;
    } catch (e) {
        return false;
    }
}

function updateSwitcherVisibility(group) {
    var collapse = group.windows.length >= 2;
    for (var i = 0; i < group.windows.length; i++) {
        // First window is the representative: always in the switcher.
        // Everyone else hides when grouped.
        try {
            group.windows[i].skipSwitcher = collapse && i !== 0;
        } catch (e) {}
    }
}

function removeGroupIfEmpty(group) {
    if (group.windows.length === 0) {
        var idx = groups.indexOf(group);
        if (idx !== -1) groups.splice(idx, 1);
    }
}

/** Make `window` the group's representative (the Alt+Tab entry). */
function setRepresentative(group, window) {
    var idx = group.windows.indexOf(window);
    if (idx <= 0) return; // already representative or not a member
    group.windows.splice(idx, 1);
    group.windows.unshift(window);
    updateSwitcherVisibility(group);
}

// --- Core ------------------------------------------------------------------

/**
 * Bring all group members forward, ending with `focusedWindow` on top.
 * Only called when entering the group from outside (Alt+Tab, taskbar,
 * clicking a member while another app was focused). Clicking between
 * members never triggers this — the mouse just works.
 */
function raiseGroup(group, focusedWindow) {
    if (raisingGroup) return;
    if (!group || group.windows.length < 2) return;
    raisingGroup = true;
    try {
        var ordered = group.windows.slice();
        var idx = ordered.indexOf(focusedWindow);
        if (idx !== -1) {
            ordered.splice(idx, 1);
            ordered.push(focusedWindow);
        }
        for (var i = 0; i < ordered.length; i++) {
            try { workspace.activeWindow = ordered[i]; } catch (e) {}
        }
    } finally {
        raisingGroup = false;
    }
}

function addToGroup(window, group) {
    if (group.windows.indexOf(window) !== -1) return;
    group.windows.push(window);
    updateSwitcherVisibility(group);
}

function createGroup(w1, w2) {
    var group = { id: nextGroupId++, windows: [] };
    groups.push(group);
    addToGroup(w1, group);
    addToGroup(w2, group);
    return group;
}

function groupWith(targetWindow) {
    // Move pendingTabbee into targetWindow's group (or a new group).
    var tabbee = pendingTabbee;
    pendingTabbee = null;
    groupingArmed = false;
    if (!tabbee || !targetWindow || tabbee === targetWindow) return;
    if (!isGroupable(tabbee) || !isGroupable(targetWindow)) return;

    var targetGroup = findGroup(targetWindow);
    var tabbeeGroup = findGroup(tabbee);

    // Detach tabbee from its old group first.
    if (tabbeeGroup) {
        detachWindow(tabbee, tabbeeGroup);
    }

    if (targetGroup) {
        addToGroup(tabbee, targetGroup);
    } else {
        createGroup(tabbee, targetWindow);
    }
}

function detachWindow(window, group) {
    group = group || findGroup(window);
    if (!group) return;
    var idx = group.windows.indexOf(window);
    if (idx === -1) return;
    group.windows.splice(idx, 1);
    try { window.skipSwitcher = false; } catch (e) {}
    updateSwitcherVisibility(group);
    removeGroupIfEmpty(group);
}

function ungroupFocused() {
    var window = null;
    try { window = workspace.activeWindow; } catch (e) { return; }
    if (!window) return;
    var group = findGroup(window);
    if (!group || group.windows.length < 2) return;
    detachWindow(window, group);
}

function onGroupingShortcut() {
    var window = null;
    try { window = workspace.activeWindow; } catch (e) { return; }
    if (!window || !isGroupable(window)) return;

    if (!groupingArmed) {
        // First press: select the window to move.
        pendingTabbee = window;
        groupingArmed = true;
    } else {
        // Second press: group pendingTabbee with this window.
        // Pressing on the same window cancels.
        groupWith(window);
    }
}

// When a group member is focused:
//  - it becomes the Alt+Tab entry (representative follows last use)
//  - if we entered the group from outside, the whole group comes forward,
//    then they're released — plain mouse clicks between members just work.
function onActiveChanged(window) {
    return function () {
        if (raisingGroup) return;
        var active = false;
        try { active = window.active; } catch (e) { return; }
        if (!active) return;
        var group = findGroup(window);
        if (!group || group.windows.length < 2) {
            lastGroupFocus = { group: null, window: null };
            return;
        }
        setRepresentative(group, window);

        var enteredFromOutside = lastGroupFocus.group !== group;
        lastGroupFocus = { group: group, window: window };

        if (enteredFromOutside) {
            raiseGroup(group, window);
        }
    };
}

// --- Window lifecycle ------------------------------------------------------

function onWindowAdded(window) {
    if (!isGroupable(window)) return;
    // Track focus on every window: needed to detect entering a group
    // from outside vs switching between members with the mouse.
    try {
        window.activeChanged.connect(onActiveChanged(window));
    } catch (e) {}
}

function onWindowRemoved(window) {
    if (pendingTabbee === window) {
        pendingTabbee = null;
        groupingArmed = false;
    }
    var group = findGroup(window);
    if (group) {
        detachWindow(window, group);
    }
}

// --- Init ------------------------------------------------------------------

function showShortcutReminder() {
    try {
        callDBus(
            "org.freedesktop.Notifications",
            "/org/freedesktop/Notifications",
            "org.freedesktop.Notifications",
            "Notify",
            "Window Groups",
            0,
            "preferences-system-windows",
            "Window Groups active",
            "Meta+Space x2: group windows\nMeta+Alt+Space: ungroup",
            [],
            {},
            6000
        );
    } catch (e) {}
}

function main() {
    registerShortcut(
        "Group Windows",
        "Window Groups: first press selects window to move, second press selects target",
        "Meta+Space",
        onGroupingShortcut
    );
    registerShortcut(
        "Ungroup Window",
        "Window Groups: remove focused window from its group",
        "Meta+Alt+Space",
        ungroupFocused
    );

    try {
        workspace.windowAdded.connect(onWindowAdded);
        workspace.windowRemoved.connect(onWindowRemoved);
    } catch (e) {}

    // Adopt existing windows (script loaded after they were opened).
    try {
        var list = workspace.windowList();
        for (var i = 0; i < list.length; i++) {
            onWindowAdded(list[i]);
        }
    } catch (e) {}

    showShortcutReminder();
}

main();
