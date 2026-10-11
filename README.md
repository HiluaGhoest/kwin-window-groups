# KWin Window Groups

Group windows logically on KDE Plasma 6: one Alt+Tab entry per group, while
each window keeps its own position and size on screen. Activating any member
brings the whole group forward together.

Built because Plasma 6 removed KWin's old window tabbing. Sometimes you just want
Firefox and your textbook to travel together without being glued together.

## What it does

- **Group windows** with `Meta+Space` (press twice: first press selects the
  window to move, second press selects the target window/group)
- **Ungroup** the focused window with `Meta+Alt+Space`
- Grouped windows collapse into a **single Alt+Tab entry** — always showing
  the member you used last
- **Alt+Tab into a group brings all its windows forward** together; then
  they're released — clicking between members works like normal windows
- The script **never moves or resizes** your windows. Clicking and focusing
  work exactly as normal.
- Windows never move or resize. Ever. Positions are sacred.
- Closing a window removes it from its group automatically

## What it doesn't do

- No visual tab bar (unlike the old tabbing feature — this is intentional)
- No minimize-together yet (minimizing the representative won't minimize
  the rest; this may come later)
- Groups don't survive logout/restart

## Install

Refer to releases folder, or:

Requires KDE Plasma 6 with KWin on Wayland (tested on 6.7).

```bash
git clone https://github.com/YOUR_USERNAME/kwin-window-groups.git
cd kwin-window-groups
kpackagetool6 --type KWin/Script -i .
```

Then enable it in **System Settings → Window Management → KWin Scripts**,
or from the terminal:

```bash
kwriteconfig6 --file kwinrc --group Plugins --key kwin-window-groupsEnabled true
qdbus org.kde.KWin /KWin reconfigure
```

If KWin doesn't pick it up, log out and back in.

## Uninstall

```bash
kpackagetool6 --type KWin/Script -r kwin-window-groups
```

## How it works

A single self-contained KWin script (`contents/code/main.js`, ~250 lines,
no dependencies). It tracks groups in memory, sets `skipSwitcher` on
non-representative members to collapse them in Alt+Tab, and listens for
window activation to raise group members together. That's the whole trick.

## On the Alt+F3 menu

The window operations menu (Alt+F3) is hardcoded in KWin's C++ — scripts
can't add entries to it. The `Meta+Space` / `Meta+Alt+Space` shortcuts are
the interface. If you want this as a native KWin feature, that's a feature
request for the KDE folks, not something a script can do.

## License

GPL-2.0-only
