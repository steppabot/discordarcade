/*
 * Token Arcade multiplayer groups.
 *
 * The host's browser runs the emulator and streams it over WebRTC to the
 * other players (up to 3). Each guest sends its controller state back over a
 * data channel, and the host feeds it to emulated controllers 2-4.
 * Everyone, host included, sees only their own part of the split screen.
 *
 * The arcade API keeps the lobby and relays WebRTC signaling; no game video
 * or audio passes through it.
 */
(() => {
  "use strict";

  const API = "https://api.discordarcade.com/api/arcade";
  const SOCKET = "wss://api.discordarcade.com/api/arcade";

  // N64 controller ids used by EmulatorJS's simulateInput.
  const DIGITAL = [0, 1, 3, 4, 5, 6, 7, 10, 11, 12, 20, 21, 22, 23];
  const STICK = { right: 16, left: 17, down: 18, up: 19 };
  const FULL = 0x7fff;

  // Guest keyboard: the same keys EmulatorJS uses for player 1.
  const KEYS = {
    KeyX: 0, KeyS: 1, Enter: 3,
    ArrowUp: 4, ArrowDown: 5, ArrowLeft: 6, ArrowRight: 7,
    KeyQ: 10, KeyE: 11, Tab: 12,
    KeyL: 20, KeyJ: 21, KeyK: 22, KeyI: 23
  };
  const STICK_KEYS = { KeyH: [1, 0], KeyF: [-1, 0], KeyG: [0, 1], KeyT: [0, -1] };

  // Guest gamepad (standard layout): A=A, B/X=B, bumpers=L/R,
  // triggers=Z, Start, D-pad; left stick=stick; right stick=C buttons.
  const PAD = { 0: 0, 1: 1, 2: 1, 4: 10, 5: 11, 6: 12, 7: 12, 9: 3, 12: 4, 13: 5, 14: 6, 15: 7 };

  // N64 controller bits, as the GoldenEye PC version takes them.
  const N64 = {
    A: 0x8000, B: 0x4000, Z: 0x2000, START: 0x1000,
    DU: 0x0800, DD: 0x0400, DL: 0x0200, DR: 0x0100,
    L: 0x0020, R: 0x0010, CU: 0x0008, CD: 0x0004, CL: 0x0002, CR: 0x0001
  };
  // EmulatorJS id -> N64 bit (ids as in DIGITAL above).
  const EJS_N64 = [[0, N64.A], [1, N64.B], [3, N64.START], [4, N64.DU], [5, N64.DD], [6, N64.DL],
    [7, N64.DR], [10, N64.L], [11, N64.R], [12, N64.Z], [20, N64.CR], [21, N64.CL], [22, N64.CD], [23, N64.CU]];
  const STICK_MAX = 80; // full N64 stick deflection

  // EmulatorJS state ({b, x, y}, y down) <-> N64 state ({n, nx, ny}, up positive).
  function ejsToN64(b, x, y) {
    let n = 0;
    for (const [id, bit] of EJS_N64) if ((b >>> id) & 1) n |= bit;
    return { n, nx: Math.round(x * STICK_MAX), ny: Math.round(-y * STICK_MAX) };
  }
  function n64ToEjs(n, nx, ny) {
    let b = 0;
    for (const [id, bit] of EJS_N64) if (n & bit) b |= 1 << id;
    const round = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 100) / 100;
    return { b: b >>> 0, x: round(nx / STICK_MAX), y: round(-ny / STICK_MAX) };
  }

  // The GoldenEye PC version's multiplayer control style: the stick looks and
  // aims, the C buttons walk and strafe. Guest keyboards and gamepads follow it.
  const PC_KEYS = {
    KeyW: N64.CU, KeyS: N64.CD, KeyA: N64.CL, KeyD: N64.CR,
    Space: N64.Z, Tab: N64.Z, ShiftLeft: N64.R, ShiftRight: N64.R,
    KeyQ: N64.A, KeyE: N64.B, KeyR: N64.B, Enter: N64.START
  };
  const PC_LOOK = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  const PC_LOOK_SPEED = 60; // arrow keys: most of the stick, so turning stays controllable
  // Standard gamepad: A = A (weapon / accept), B or X = B (use / back),
  // Y = A, LT or LB = aim (R), RT or RB = fire (Z), Start, D-pad.
  const PC_PAD = { 0: N64.A, 1: N64.B, 2: N64.B, 3: N64.A, 4: N64.R, 5: N64.Z, 6: N64.R, 7: N64.Z,
    9: N64.START, 12: N64.DU, 13: N64.DD, 14: N64.DL, 15: N64.DR };

  // The WCW/nWo Revenge PC version (revenge-pc/), same keys as its own page: the
  // d-pad moves, the stick taunts. Gamepad: left stick or d-pad moves, right stick
  // taunts, A grapple, X strike, B run, Y climb, bumpers focus, triggers duck/block.
  const RV_KEYS = {
    KeyW: N64.DU, ArrowUp: N64.DU, KeyS: N64.DD, ArrowDown: N64.DD,
    KeyA: N64.DL, ArrowLeft: N64.DL, KeyD: N64.DR, ArrowRight: N64.DR,
    KeyJ: N64.A, KeyK: N64.B, KeyL: N64.R, ShiftLeft: N64.L, ShiftRight: N64.L,
    Space: N64.CD, KeyI: N64.CU, KeyQ: N64.CL, KeyE: N64.CR, KeyZ: N64.Z, Enter: N64.START
  };
  const RV_TAUNT = { KeyT: [0, 1], KeyG: [0, -1], KeyF: [-1, 0], KeyH: [1, 0] };
  const RV_PAD = { 0: N64.A, 1: N64.CD, 2: N64.B, 3: N64.CU, 4: N64.CL, 5: N64.CR, 6: N64.L, 7: N64.R,
    8: N64.Z, 9: N64.START, 10: N64.Z, 12: N64.DU, 13: N64.DD, 14: N64.DL, 15: N64.DR };
  const MOVE = N64.DU | N64.DD | N64.DL | N64.DR;
  // A stick offset as d-pad directions (8 ways, small dead zone); y is screen-down.
  function stickToDpad(dx, dy, radius) {
    if (Math.hypot(dx, dy) < radius * 0.3) return 0;
    const sector = Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) + 4; // 0..8, 4 = right
    return [N64.DL, N64.DL | N64.DD, N64.DD, N64.DD | N64.DR, N64.DR, N64.DR | N64.DU, N64.DU, N64.DU | N64.DL, N64.DL][sector];
  }

  const TOUCH = matchMedia("(pointer: coarse)").matches;

  // Where each player's view sits in GoldenEye's 4:3 frame (fractions),
  // measured from the game's 2, 3 and 4 player split screens.
  const TOP = [0.0375, 0.4917];
  const BOTTOM = [0.5, 0.9542];
  const LEFT = [0.0125, 0.4969];
  const RIGHT = [0.5031, 0.9906];
  const WIDE = [0.0125, 0.9906];

  function region(mode, slot) {
    const rect = (x, y) => ({ x: x[0], y: y[0], w: x[1] - x[0], h: y[1] - y[0] });

    if (mode === "quads" && slot >= 1 && slot <= 4) {
      return rect(slot % 2 ? LEFT : RIGHT, slot <= 2 ? TOP : BOTTOM);
    }

    if (mode === "halves" && (slot === 1 || slot === 2)) {
      return rect(WIDE, slot === 1 ? TOP : BOTTOM);
    }

    return { x: 0, y: 0, w: 1, h: 1 };
  }

  // Classify a 320x240 RGBA frame: "quads", "halves", "full", or null when
  // the frame is too dark to tell (fades, loading).
  function classifyFrame(data) {
    const lum = (x, y) => {
      const i = (y * 320 + x) * 4;
      return (data[i] * 2 + data[i + 1] * 5 + data[i + 2]) / 8;
    };
    const row = (y, x0, x1) => {
      let sum = 0;
      for (let x = x0; x < x1; x += 2) sum += lum(x, y);
      return sum / ((x1 - x0) / 2);
    };
    const column = (x, y0, y1) => {
      let sum = 0;
      for (let y = y0; y < y1; y += 2) sum += lum(x, y);
      return sum / ((y1 - y0) / 2);
    };
    const area = (x0, y0, x1, y1) => {
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1; y += 4) {
        for (let x = x0; x < x1; x += 4) {
          sum += lum(x, y);
          count++;
        }
      }
      return sum / count;
    };

    const whole = area(8, 12, 312, 228);
    if (whole < 12) return null;

    // GoldenEye draws a black bar between the halves at rows 236-239 of 480
    // on the N64 (118-119 here); the PC version's is one row lower (119-120).
    const pair = (a, b) => Math.max(a, b);
    const r118 = row(118, 8, 312);
    const r119 = row(119, 8, 312);
    const r120 = row(120, 8, 312);
    const bar = Math.min(pair(r118, r119), pair(r119, r120));
    const top = area(8, 14, 312, 114);
    const bottom = area(8, 124, 312, 226);

    if (!(bar < 16 && top > bar + 10 && bottom > bar + 10)) return "full";

    const divider = Math.max(column(159, 12, 226), column(160, 12, 226));
    const topLeft = area(8, 14, 150, 114);
    const topRight = area(170, 14, 312, 114);

    return divider < 16 && topLeft > divider + 10 && topRight > divider + 10
      ? "quads"
      : "halves";
  }

  // Watch a video and report the split-screen layout, ignoring brief fades.
  function watchLayout(video, onChange) {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    let mode = "full";
    let candidate = null;
    let streak = 0;

    const timer = setInterval(() => {
      if (video.readyState < 2 || !video.videoWidth) return;

      context.drawImage(video, 0, 0, 320, 240);
      const next = classifyFrame(context.getImageData(0, 0, 320, 240).data);

      if (!next || next === mode) {
        candidate = null;
        streak = 0;
        return;
      }

      streak = next === candidate ? streak + 1 : 1;
      candidate = next;

      // Enter a split quickly; fall back to full screen more cautiously.
      if (streak >= (next === "full" ? 4 : 2)) {
        mode = next;
        candidate = null;
        streak = 0;
        onChange(mode);
      }
    }, 300);

    return () => clearInterval(timer);
  }

  // ---------------------------------------------------------------- styles

  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #status { overflow-y: auto; place-content: safe center; }
      .tg-view { position: absolute; inset: 0; z-index: 4; display: grid; place-items: center; background: #000; overflow: hidden; outline: none; }
      .tg-frame { position: relative; overflow: hidden; background: #000; max-width: 100%; max-height: 100%; }
      .tg-frame video { position: absolute; display: block; object-fit: fill; }
      .tg-badge { position: absolute; top: 10px; left: 10px; z-index: 6; padding: 4px 9px; border-radius: 6px;
        background: #15102ecc; color: #2ed7e9; font: 700 12px system-ui, sans-serif; letter-spacing: .04em; pointer-events: none; }
      .tg-tools { position: absolute; top: 8px; right: 8px; z-index: 6; display: flex; gap: 6px; }
      .tg-tools button, .tg-panel button { border: 0; border-radius: 8px; font: 700 13px system-ui, sans-serif; cursor: pointer; }
      .tg-tools button { padding: 6px 10px; background: #15102ecc; color: #f4f1fc; }
      .tg-sound { position: absolute; z-index: 7; left: 50%; bottom: 18px; transform: translateX(-50%);
        padding: 10px 16px; background: #2ed7e9; color: #15102e; }
      .tg-note { position: absolute; z-index: 6; left: 50%; top: 50%; transform: translate(-50%, -50%);
        color: #bcb3ce; font: 15px system-ui, sans-serif; text-align: center; pointer-events: none; }
      .tg-help { position: absolute; z-index: 6; left: 10px; bottom: 10px; max-width: calc(100% - 20px); padding: 8px 10px;
        border-radius: 8px; background: #15102ee6; color: #bcb3ce; font: 12px/1.5 system-ui, sans-serif; pointer-events: none;
        transition: opacity .6s; }
      .tg-panel { width: min(420px, 100%); text-align: left; }
      .tg-panel h1 { margin: 0 0 2px; text-align: center; }
      .tg-panel .tg-sub { margin: 0 0 10px; text-align: center; color: #bcb3ce; }
      .tg-players { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 4px; }
      .tg-players li { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 8px; background: #221a45; }
      .tg-players li.open { opacity: .45; }
      .tg-players b { min-width: 26px; color: #2ed7e9; }
      .tg-players img, .tg-players .tg-avatar { width: 24px; height: 24px; border-radius: 50%; background: #3a2f6b; flex: none; }
      .tg-players .tg-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tg-dot { width: 8px; height: 8px; border-radius: 50%; background: #5b5277; flex: none; }
      .tg-dot.on { background: #7dff9b; }
      .tg-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
      .tg-actions .tg-primary { padding: 10px 20px; background: #2ed7e9; color: #15102e; }
      .tg-actions .tg-primary:disabled { opacity: .45; cursor: default; }
      .tg-actions .tg-secondary { padding: 10px 16px; background: #2a2150; color: #f4f1fc; }
      .tg-panel .tg-keys { margin: 10px 0 0; font-size: 12px; line-height: 1.5; color: #8f86a6; text-align: center; }
      .tg-view.tg-pass { pointer-events: none; }
      .tg-view.tg-pass .tg-tools { pointer-events: auto; }
      .tg-view.tg-touch .tg-badge { left: 50%; transform: translateX(-50%); }
      .tg-view.tg-touch .tg-help { display: none; }
      .tg-view.tg-touch .tg-sound { bottom: auto; top: 50%; }
      ${PAD_CSS}
    `;
    document.head.append(style);
  }

  // ------------------------------------------------------- on-screen pad
  // An N64 pad for phones and tablets, the same as the GoldenEye PC page's:
  // monochrome outlines, a floating stick, C arrows, Fire / Aim / A / B,
  // Start and fullscreen. "pc" puts the arrows (walk) left and the stick
  // (look) right; "classic" is the N64 layout, stick left and arrows right.

  const PAD_CSS = `
    .tg-pad { position: absolute; inset: 0; z-index: 5; pointer-events: none; touch-action: none;
      -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; --u: min(1vmin, 4.4px); }
    .tg-pad .tg-zone { position: absolute; right: 0; top: 0; bottom: 0; width: 48%; pointer-events: auto; touch-action: none; }
    .tg-pad.classic .tg-zone { right: auto; left: 0; }
    .tg-pad .tg-stick { position: absolute; left: calc(100% - var(--u) * 22); top: calc(100% - var(--u) * 67);
      width: calc(var(--u) * 32); height: calc(var(--u) * 32); margin: calc(var(--u) * -16) 0 0 calc(var(--u) * -16);
      border-radius: 50%; border: 1.5px solid rgba(255,255,255,.28); background: rgba(0,0,0,.3); opacity: .75; }
    .tg-pad.classic .tg-stick { left: calc(var(--u) * 22); top: calc(100% - var(--u) * 28); }
    .tg-pad .tg-stick.on { opacity: 1; }
    .tg-pad .tg-knob { position: absolute; left: 50%; top: 50%; width: calc(var(--u) * 13); height: calc(var(--u) * 13);
      margin: calc(var(--u) * -6.5) 0 0 calc(var(--u) * -6.5); border-radius: 50%;
      background: rgba(255,255,255,.14); border: 1.5px solid rgba(255,255,255,.5); }
    .tg-pad button { position: absolute; pointer-events: auto; touch-action: none; display: flex; align-items: center;
      justify-content: center; padding: 0; margin: 0; border-radius: calc(var(--u) * 2.6);
      border: 1.5px solid rgba(255,255,255,.3); background: rgba(0,0,0,.4); color: rgba(255,255,255,.9);
      font: italic 800 max(11px, calc(var(--u) * 4.4))/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      text-shadow: 0 1px 2px rgba(0,0,0,.5); -webkit-tap-highlight-color: transparent; cursor: default; }
    .tg-pad button.on, .tg-pad .tg-fs:active { background: rgba(255,255,255,.2); border-color: rgba(255,255,255,.7); color: #fff; }
    .tg-pad .pill { border-radius: 999px; }
    .tg-pad button svg { width: 30%; height: 30%; fill: currentColor; }
    .tg-pad .fire { right: calc(var(--u) * 3); bottom: calc(var(--u) * 4); width: calc(var(--u) * 38); height: calc(var(--u) * 15); }
    .tg-pad .aim { right: calc(var(--u) * 3); bottom: calc(var(--u) * 21); width: calc(var(--u) * 38); height: calc(var(--u) * 11); }
    .tg-pad .a { right: calc(var(--u) * 3); bottom: calc(var(--u) * 34); width: calc(var(--u) * 18.5); height: calc(var(--u) * 11); }
    .tg-pad .b { right: calc(var(--u) * 22.5); bottom: calc(var(--u) * 34); width: calc(var(--u) * 18.5); height: calc(var(--u) * 11); }
    .tg-pad .sq { width: calc(var(--u) * 12); height: calc(var(--u) * 12); }
    .tg-pad .cu { left: calc(var(--u) * 16); bottom: calc(var(--u) * 35); }
    .tg-pad .cl { left: calc(var(--u) * 3); bottom: calc(var(--u) * 22); }
    .tg-pad .cr { left: calc(var(--u) * 29); bottom: calc(var(--u) * 22); }
    .tg-pad .cd { left: calc(var(--u) * 16); bottom: calc(var(--u) * 9); }
    .tg-pad.classic .cu { left: auto; right: calc(var(--u) * 16); bottom: calc(var(--u) * 74); }
    .tg-pad.classic .cl { left: auto; right: calc(var(--u) * 29); bottom: calc(var(--u) * 61); }
    .tg-pad.classic .cr { left: auto; right: calc(var(--u) * 3); bottom: calc(var(--u) * 61); }
    .tg-pad.classic .cd { left: auto; right: calc(var(--u) * 16); bottom: calc(var(--u) * 48); }
    .tg-pad.rv .ga { right: calc(var(--u) * 3); bottom: calc(var(--u) * 4); width: calc(var(--u) * 19); height: calc(var(--u) * 14); }
    .tg-pad.rv .st { right: calc(var(--u) * 24); bottom: calc(var(--u) * 4); width: calc(var(--u) * 19); height: calc(var(--u) * 14); }
    .tg-pad.rv .bl { right: calc(var(--u) * 3); bottom: calc(var(--u) * 20); width: calc(var(--u) * 19); height: calc(var(--u) * 12); }
    .tg-pad.rv .ru { right: calc(var(--u) * 24); bottom: calc(var(--u) * 20); width: calc(var(--u) * 19); height: calc(var(--u) * 12); }
    .tg-pad.rv .du { right: calc(var(--u) * 3); bottom: calc(var(--u) * 34); width: calc(var(--u) * 19); height: calc(var(--u) * 9.5); }
    .tg-pad.rv .cl2 { right: calc(var(--u) * 24); bottom: calc(var(--u) * 34); width: calc(var(--u) * 19); height: calc(var(--u) * 9.5); }
    .tg-pad.rv .fo { right: calc(var(--u) * 3); bottom: calc(var(--u) * 45.5); width: calc(var(--u) * 19); height: calc(var(--u) * 9.5); }
    .tg-pad.rv .ta { right: calc(var(--u) * 24); bottom: calc(var(--u) * 45.5); width: calc(var(--u) * 19); height: calc(var(--u) * 9.5); }
    .tg-pad.rv .sm { font-size: max(10px, calc(var(--u) * 3.4)); }
    .tg-pad .cd svg { transform: rotate(180deg); } .tg-pad .cl svg { transform: rotate(-90deg); } .tg-pad .cr svg { transform: rotate(90deg); }
    .tg-pad .tg-fs { left: calc(var(--u) * 3); top: calc(var(--u) * 3); width: max(34px, calc(var(--u) * 10)); height: max(34px, calc(var(--u) * 10)); }
    .tg-pad .tg-fs svg { width: 55%; height: 55%; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .tg-pad .tg-fs .out, .tg-pad.full .tg-fs .in { display: none; } .tg-pad.full .tg-fs .out { display: block; }
    .tg-pad .start { left: calc(var(--u) * 5 + max(34px, calc(var(--u) * 10))); top: calc(var(--u) * 3);
      width: calc(var(--u) * 19); height: max(34px, calc(var(--u) * 10)); }
  `;

  const TRIANGLE = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 2.4 8.6 7.6H1.4z"/></svg>';
  const FULLSCREEN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="in" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>' +
    '<path class="out" d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>';

  // Builds the pad over `host` (an element). onChange({n, x, y}) gets the
  // N64 state on every change; onTouch() runs on each touch (sound unlock).
  function createPad(hostElement, layout, onChange, onTouch) {
    const pad = document.createElement("div");
    pad.className = "tg-pad" + (layout === "classic" ? " classic" : layout === "rv" ? " classic rv" : "");
    pad.innerHTML = layout === "rv"
      ? '<div class="tg-zone"><div class="tg-stick"><div class="tg-knob"></div></div></div>' +
        `<button class="tg-fs" aria-label="Fullscreen">${FULLSCREEN_ICON}</button>` +
        `<button class="pill start" data-b="${N64.START}">Start</button>` +
        `<button class="pill ga" data-b="${N64.A}">Grapple</button>` +
        `<button class="pill st" data-b="${N64.B}">Strike</button>` +
        `<button class="pill bl" data-b="${N64.R}">Block</button>` +
        `<button class="pill ru" data-b="${N64.CD}">Run</button>` +
        `<button class="pill sm du" data-b="${N64.L}">Duck</button>` +
        `<button class="pill sm cl2" data-b="${N64.CU}">Climb</button>` +
        `<button class="pill sm fo" data-b="${N64.CR}">Focus</button>` +
        `<button class="pill sm ta" data-b="0" data-ty="${STICK_MAX}">Taunt</button>`
      :
      '<div class="tg-zone"><div class="tg-stick"><div class="tg-knob"></div></div></div>' +
      `<button class="tg-fs" aria-label="Fullscreen">${FULLSCREEN_ICON}</button>` +
      `<button class="pill start" data-b="${N64.START}">Start</button>` +
      `<button class="sq cu" data-b="${N64.CU}" aria-label="C up">${TRIANGLE}</button>` +
      `<button class="sq cl" data-b="${N64.CL}" aria-label="C left">${TRIANGLE}</button>` +
      `<button class="sq cr" data-b="${N64.CR}" aria-label="C right">${TRIANGLE}</button>` +
      `<button class="sq cd" data-b="${N64.CD}" aria-label="C down">${TRIANGLE}</button>` +
      `<button class="pill b" data-b="${N64.B}">B</button>` +
      `<button class="pill a" data-b="${N64.A}">A</button>` +
      `<button class="pill aim" data-b="${N64.R}">Aim</button>` +
      `<button class="pill fire" data-b="${N64.Z}">Fire</button>`;
    hostElement.append(pad);

    const state = { n: 0, x: 0, y: 0 };
    const changed = () => onChange({ ...state });
    const zone = pad.querySelector(".tg-zone");
    const stick = pad.querySelector(".tg-stick");
    const knob = pad.querySelector(".tg-knob");
    let sid = null;
    let ox = 0;
    let oy = 0;
    let radius = 55;

    pad.addEventListener("pointerdown", () => onTouch?.(), true);
    zone.addEventListener("pointerdown", (event) => {
      if (sid !== null) return;
      sid = event.pointerId;
      zone.setPointerCapture(sid);
      const rect = zone.getBoundingClientRect();
      ox = event.clientX;
      oy = event.clientY;
      radius = Math.max(30, stick.offsetWidth * 0.42); // full tilt near the ring's edge
      stick.style.left = (ox - rect.left) + "px";
      stick.style.top = (oy - rect.top) + "px";
      stick.classList.add("on");
      knob.style.transform = "";
      event.preventDefault();
    });
    zone.addEventListener("pointermove", (event) => {
      if (event.pointerId !== sid) return;
      let dx = event.clientX - ox;
      let dy = event.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > radius) {
        dx *= radius / d;
        dy *= radius / d;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      if (layout === "rv") {
        state.n = (state.n & ~MOVE) | stickToDpad(dx, dy, radius);
      } else {
        state.x = Math.round(dx / radius * STICK_MAX);
        state.y = Math.round(-dy / radius * STICK_MAX);
      }
      changed();
    });
    const end = (event) => {
      if (event.pointerId !== sid) return;
      sid = null;
      stick.style.left = stick.style.top = "";
      stick.classList.remove("on");
      knob.style.transform = "";
      if (layout === "rv") state.n &= ~MOVE;
      else state.x = state.y = 0;
      changed();
    };
    zone.addEventListener("pointerup", end);
    zone.addEventListener("pointercancel", end);

    for (const button of pad.querySelectorAll("button[data-b]")) {
      const bit = Number(button.dataset.b);
      const ty = Number(button.dataset.ty || 0); // Revenge's Taunt: the stick pushed up
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        button.classList.add("on");
        state.n |= bit;
        if (ty) state.y = ty;
        changed();
      });
      const off = () => {
        button.classList.remove("on");
        state.n &= ~bit;
        if (ty) state.y = 0;
        changed();
      };
      button.addEventListener("pointerup", off);
      button.addEventListener("pointercancel", off);
      button.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    const fullscreen = pad.querySelector(".tg-fs");
    fullscreen.addEventListener("pointerdown", (event) => event.preventDefault());
    fullscreen.onclick = () => toggleFullscreen();
    const syncFull = (on) => pad.classList.toggle("full", on);
    const stopFull = watchFullscreen(syncFull);

    return {
      state,
      destroy() {
        stopFull();
        pad.remove();
      }
    };
  }

  // Fullscreen for the group view: the real thing where the browser allows it,
  // otherwise (iPhone) the arcade page stretches its game frame over the page.
  let filled = false;
  const fullListeners = new Set();
  const fullElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const fullNotify = () => {
    for (const fn of fullListeners) fn(Boolean(fullElement()) || filled);
  };
  document.addEventListener("fullscreenchange", fullNotify);
  document.addEventListener("webkitfullscreenchange", fullNotify);
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== "token-fullscreen") return;
    filled = Boolean(event.data.on);
    fullNotify();
  });
  function watchFullscreen(fn) {
    fullListeners.add(fn);
    fn(Boolean(fullElement()) || filled);
    return () => fullListeners.delete(fn);
  }
  async function toggleFullscreen() {
    if (fullElement()) {
      try {
        await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } catch {}
      return;
    }
    if (filled) {
      parent.postMessage({ type: "token-fullscreen", on: false }, location.origin);
      return;
    }
    const root = document.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (request && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
      try {
        await request.call(root, { navigationUI: "hide" });
        screen.orientation?.lock?.("landscape")?.catch(() => {});
        return;
      } catch {}
    }
    if (parent !== window) parent.postMessage({ type: "token-fullscreen", on: true }, location.origin);
  }

  const CONTROLS_HELP =
    "Keyboard: T F G H move · X = A · S = B · Tab = Z · Q / E = L / R · " +
    "I J K L = C buttons · Enter = Start. Gamepads work too.";
  const PC_HELP =
    "Keyboard: W A S D move · arrow keys look · Space fire · Shift aim · " +
    "Q = A (weapon, accept) · E = B (use, back) · Enter = Start. " +
    "Gamepad: left stick moves, right stick looks, triggers aim and fire.";

  const RV_HELP =
    "Keyboard: W A S D move · J grapple · K strike · L block · Space run · " +
    "Shift duck · I climb · Q / E focus · T F G H taunt · Enter = Start. " +
    "Gamepad: left stick moves, A grapple, X strike, B run, triggers duck and block.";

  // How each group game is shown and set up. Keys match games.json ids.
  //  view "split":  the game splits the screen; each player sees their part.
  //  view "shared": one screen for everyone.
  //  fps: the stream's frame rate (lower = less work for the host).
  const GAME_INFO = {
    goldeneye007: {
      view: "split",
      fps: 60,
      hint: (players) =>
        `In GoldenEye, pick 2. MULTIPLAYER and set Players to ${players}.`
    },
    wcwvsnworevenge: {
      view: "shared",
      fps: 30, // Revenge draws 30 frames per second
      hint: () =>
        "In Revenge, pick Exhibition or Special Match and a mode with human " +
        "players (like 1P vs 2P). Each player picks their own wrestler."
    }
  };
  const DEFAULT_GAME = { view: "shared", fps: 60, hint: () => "" };

  // --------------------------------------------------------------- engines
  // What the host runs. Each engine boots the game, captures it for the
  // stream, feeds guests' controls in, and wires up the host's own controls.

  // EmulatorJS (N64 and other consoles).
  function emulatorEngine(bootEmulator) {
    let hostKeys = null;

    return {
      boot: (onStart) => bootEmulator({ onStart }),

      async capture(fps) {
        const emulator = window.EJS_emulator;
        // Each guest gets its own encoded stream, so match the game's frame
        // rate instead of always encoding 60.
        const video = emulator.canvas.captureStream(fps);
        video.getVideoTracks().forEach((track) => {
          track.contentHint = "motion";
        });

        // The emulator's sound runs through one OpenAL gain node.
        for (let i = 0; i < 100 && !emulator.Module?.AL?.currentCtx; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const al = emulator.Module?.AL?.currentCtx;
        if (al?.gain && al.audioCtx) {
          const destination = al.audioCtx.createMediaStreamDestination();
          al.gain.connect(destination);
          destination.stream.getAudioTracks().forEach((track) => video.addTrack(track));
        }
        return video;
      },

      input(entry, input) {
        const gm = window.EJS_emulator?.gameManager;
        if (!gm) return;
        const player = entry.slot - 1;
        const set = (id, value) => {
          if ((entry.held[id] || 0) !== value) {
            entry.held[id] = value;
            gm.simulateInput(player, id, value);
          }
        };

        const buttons = Number(input.b) >>> 0;
        for (const id of DIGITAL) set(id, (buttons >>> id) & 1);

        const clamp = (v) => Math.max(-1, Math.min(1, Number(v) || 0));
        const x = clamp(input.x);
        const y = clamp(input.y);
        set(STICK.right, x > 0 ? Math.round(x * FULL) : 0);
        set(STICK.left, x < 0 ? Math.round(-x * FULL) : 0);
        set(STICK.down, y > 0 ? Math.round(y * FULL) : 0);
        set(STICK.up, y < 0 ? Math.round(-y * FULL) : 0);
      },

      release(entry) {
        const gm = window.EJS_emulator?.gameManager;
        if (!gm) return;
        const player = entry.slot - 1;
        for (const id of DIGITAL) {
          if (entry.held[id]) gm.simulateInput(player, id, 0);
        }
        for (const id of Object.values(STICK)) {
          if (entry.held[id]) gm.simulateInput(player, id, 0);
        }
      },

      attach(view) {
        // The host plays on the emulator's keyboard controls, but EmulatorJS
        // only hears keys sent to its own element, and the shared view sits
        // on top of it. A click on the view would move focus to the page,
        // so keep focus on the emulator and hand it any key that lands
        // elsewhere.
        const game = document.getElementById("game");
        const focusGame = () => game?.focus({ preventScroll: true });
        view.view.addEventListener("mousedown", (event) => {
          if (event.target.closest("button")) return;
          event.preventDefault(); // stops the browser moving focus
          focusGame();
        });
        view.view.addEventListener("pointerdown", focusGame);
        view.view.style.pointerEvents = "auto";
        hostKeys = (event) => {
          const emulator = window.EJS_emulator;
          if (!emulator?.started || game.contains(event.target)) return;
          if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;
          emulator.keyChange(event);
          if (event.type === "keydown") focusGame();
        };
        document.addEventListener("keydown", hostKeys, true);
        document.addEventListener("keyup", hostKeys, true);
        focusGame();
      },

      detach() {
        if (!hostKeys) return;
        document.removeEventListener("keydown", hostKeys, true);
        document.removeEventListener("keyup", hostKeys, true);
        hostKeys = null;
      }
    };
  }

  // A native PC version (goldeneye-pc/, revenge-pc/), in a frame of its own under
  // the shared view. The frame is always 960x720 inside, so every player's part of
  // GoldenEye's split screen streams at 480x360 however big the host's window is;
  // it is scaled to sit exactly under the view's picture. Both pages offer the
  // same host API (window.geGroup).
  const PC_SIZE = [960, 720];
  const PC_PORTS = {
    goldeneye: { page: "goldeneye-pc/", title: "GoldenEye 007", engine: "pc" },
    revenge: { page: "revenge-pc/", title: "WCW/nWo Revenge", engine: "rv" }
  };

  function pcEngine(container, id = "goldeneye") {
    const port = PC_PORTS[id] || PC_PORTS.goldeneye;
    let frame = null;
    let pad = null;
    const game = () => frame?.contentWindow?.geGroup;
    const resume = () => game()?.resumeAudio();

    function fit() {
      const scale = Math.min(innerWidth / PC_SIZE[0], innerHeight / PC_SIZE[1]);
      Object.assign(container.style, {
        left: (innerWidth - PC_SIZE[0] * scale) / 2 + "px",
        top: (innerHeight - PC_SIZE[1] * scale) / 2 + "px",
        transform: `scale(${scale})`
      });
    }

    return {
      hello: { e: port.engine },
      bitrate: 3_000_000,

      async boot(onStart) {
        Object.assign(container.style, {
          position: "absolute", width: PC_SIZE[0] + "px", height: PC_SIZE[1] + "px", transformOrigin: "0 0"
        });
        frame = document.createElement("iframe");
        frame.src = port.page + "?embed=1&group=host";
        frame.allow = "autoplay; fullscreen; gamepad";
        frame.title = port.title;
        frame.style.cssText = "display:block;width:100%;height:100%;border:0;background:#000";
        container.replaceChildren(frame);
        fit();
        addEventListener("resize", fit);

        // The page downloads the game (once), then starts it on its own.
        for (let waited = 0; ; waited += 200) {
          const g = game();
          if (g?.error) throw new Error(g.error);
          if (g?.running) break;
          if (waited > 300000) throw new Error(port.title + " took too long to start. Try again.");
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        await onStart();
      },

      capture: (fps) => game().capture(fps),

      input(entry, input) {
        let state;
        if (typeof input.n === "number") {
          const stick = (v) => Math.max(-STICK_MAX, Math.min(STICK_MAX, Math.round(Number(v) || 0)));
          state = { n: input.n & 0xffff, nx: stick(input.nx), ny: stick(input.ny) };
        } else {
          // An older guest page: EmulatorJS-style state.
          const clamp = (v) => Math.max(-1, Math.min(1, Number(v) || 0));
          state = ejsToN64(Number(input.b) >>> 0, clamp(input.x), clamp(input.y));
        }
        const key = `${state.n}|${state.nx}|${state.ny}`;
        if (entry.held.key === key) return;
        entry.held.key = key;
        game()?.setPad(entry.slot - 1, state.n, state.nx, state.ny);
      },

      release(entry) {
        game()?.releasePad(entry.slot - 1);
      },

      attach(view) {
        // Mouse and keyboard reach the game straight through the view (its
        // picture lines up with the game's own canvas); sound starts on the
        // host's first click or tap there. A phone host gets the on-screen pad.
        view.view.classList.add("tg-pass");
        document.addEventListener("pointerdown", resume, true);
        document.addEventListener("keydown", resume, true);
        if (TOUCH) {
          view.view.classList.add("tg-touch");
          pad = createPad(view.view, port.engine, (s) => game()?.setPad(0, s.n, s.x, s.y), resume);
        } else {
          frame.focus();
        }
      },

      detach() {
        document.removeEventListener("pointerdown", resume, true);
        document.removeEventListener("keydown", resume, true);
        removeEventListener("resize", fit);
        pad?.destroy();
        pad = null;
      }
    };
  }

  // ------------------------------------------------------------------ main

  async function start(options) {
    const { groupId, statusBox, message, game, bootEmulator } = options;
    addStyles();

    // The status box keeps its title/message for plain notices; the lobby
    // gets its own container so both can take turns.
    const original = [...statusBox.children];
    const lobbyBox = document.createElement("div");
    lobbyBox.hidden = true;
    statusBox.append(lobbyBox);

    function say(text) {
      lobbyBox.hidden = true;
      for (const el of original) {
        if (el.id !== "retry") el.hidden = false;
      }
      message.textContent = text;
      statusBox.hidden = false;
    }

    function showLobby(panel) {
      for (const el of original) el.hidden = true;
      lobbyBox.replaceChildren(panel);
      lobbyBox.hidden = false;
      statusBox.hidden = false;
    }

    async function api(path, init = {}) {
      const response = await fetch(API + path, {
        credentials: "include",
        cache: "no-store",
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers || {}) }
      });
      let data = {};
      try {
        data = await response.json();
      } catch {}
      if (!response.ok) {
        const error = new Error(data.detail || "The arcade is unavailable. Try again.");
        error.status = response.status;
        throw error;
      }
      return data;
    }

    say("Joining your group…");

    const session = await api("/me");
    const csrf = session.csrf;
    let joined;

    try {
      joined = await api(`/groups/${encodeURIComponent(groupId)}/join`, {
        method: "POST",
        headers: { "X-CSRF-Token": csrf },
        body: "{}"
      });
    } catch (error) {
      if (error.status === 404 || error.status === 410) {
        throw new Error("This group has ended. Start a new one with /group in Discord.");
      }
      throw error;
    }

    const { iceServers } = await api("/groups/ice");
    const myId = String(joined.you.id);

    let state = { group: joined.group, you: joined.you };
    const gameInfo = () => GAME_INFO[state.group.game] || DEFAULT_GAME;
    let socket = null;
    let retry = 0;
    let finished = false;
    let mode = null; // "host" | "guest" once the game starts

    // -------------------------------------------------------- signaling

    function send(value) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(value));
      }
    }

    function connect() {
      const url = `${SOCKET}/groups/${encodeURIComponent(groupId)}/live?csrf=${encodeURIComponent(csrf)}`;
      const ws = new WebSocket(url);
      socket = ws;

      ws.onopen = () => {
        retry = 0;
      };

      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.type === "state") {
          state = { group: data.group, you: data.you };
          onState(data.event);
        } else if (data.type === "signal") {
          onSignal(String(data.from), data.data || {});
        } else if (data.type === "error") {
          lobbyNote(data.detail);
        }
      };

      ws.onclose = (event) => {
        if (socket !== ws || finished) return;

        if (event.code === 4410) return end("This group has ended.");
        if (event.code === 4404) return end("You're not in this group anymore.");
        if (event.code === 4403) return end("Premium is required to play in a group.");
        if (event.code === 4409) return end("This group is open in another tab.");

        retry = Math.min(retry + 1, 6);
        setTimeout(connect, 500 * 2 ** retry);
      };
    }

    function leave() {
      send({ type: "leave" });
      end("You left the group.");
    }

    function end(text) {
      if (finished) return;
      finished = true;
      try {
        socket?.close();
      } catch {}
      host.stop();
      guest.stop();
      parent.postMessage({ type: "token-group", state: "ended", groupId }, location.origin);
      document.querySelector(".tg-view")?.remove();
      say(text);
    }

    // ------------------------------------------------------------ lobby

    let lobbyNoteText = "";

    function lobbyNote(text) {
      lobbyNoteText = text || "";
      renderLobby();
    }

    function renderLobby() {
      if (mode || finished) return;
      const { group, you } = state;
      const host = group.players.find((p) => p.id === group.host);
      const online = group.players.filter((p) => p.online).length;

      const panel = document.createElement("div");
      panel.className = "tg-panel";

      const h1 = document.createElement("h1");
      h1.textContent = group.title || game.title;

      const sub = document.createElement("p");
      sub.className = "tg-sub";
      sub.textContent = `Multiplayer group · You are Player ${you.slot}`;

      const list = document.createElement("ul");
      list.className = "tg-players";
      const bySlot = new Map(group.players.map((p) => [p.slot, p]));

      for (let slot = 1; slot <= group.max; slot++) {
        const player = bySlot.get(slot);
        const item = document.createElement("li");
        const label = document.createElement("b");
        label.textContent = "P" + slot;
        item.append(label);

        if (player) {
          if (player.avatar) {
            const img = document.createElement("img");
            img.src = player.avatar;
            img.alt = "";
            img.referrerPolicy = "no-referrer";
            item.append(img);
          } else {
            const blank = document.createElement("span");
            blank.className = "tg-avatar";
            item.append(blank);
          }
          const name = document.createElement("span");
          name.className = "tg-name";
          name.textContent = player.name + (player.id === group.host ? " (host)" : "") +
            (player.id === myId ? " · you" : "");
          const dot = document.createElement("span");
          dot.className = "tg-dot" + (player.online ? " on" : "");
          dot.title = player.online ? "In the arcade" : "Not in the arcade yet";
          item.append(name, dot);
        } else {
          item.className = "open";
          const name = document.createElement("span");
          name.className = "tg-name";
          name.textContent = "Open — Join from the group card in Discord";
          item.append(name);
        }
        list.append(item);
      }

      const actions = document.createElement("div");
      actions.className = "tg-actions";

      if (you.host) {
        const startButton = document.createElement("button");
        startButton.type = "button";
        startButton.className = "tg-primary";
        startButton.disabled = online < 2;
        startButton.textContent = online < 2 ? "Waiting for players…" : `Start game (${online} players)`;
        startButton.onclick = () => {
          startButton.disabled = true;
          send({ type: "start" });
        };
        actions.append(startButton);
      }

      const leaveButton = document.createElement("button");
      leaveButton.type = "button";
      leaveButton.className = "tg-secondary";
      leaveButton.textContent = you.host ? "End group" : "Leave group";
      leaveButton.onclick = leave;
      actions.append(leaveButton);

      const note = document.createElement("p");
      note.className = "tg-keys";
      note.textContent = lobbyNoteText ||
        (you.host
          ? `Start when everyone has a green dot. ${gameInfo().hint(Math.max(online, 2))}`.trim()
          : `Waiting for ${host ? host.name : "the host"} to start the game.`);

      const keys = document.createElement("p");
      keys.className = "tg-keys";
      // GoldenEye runs the PC version when the host's browser can, and its
      // controls differ; the game view shows the right ones once it starts.
      keys.textContent = ["goldeneye007", "wcwvsnworevenge"].includes(state.group.game)
        ? "Keyboard, gamepad or the on-screen pad on phones: the controls show when the game starts."
        : CONTROLS_HELP;

      panel.append(h1, sub, list, actions, note, keys);
      showLobby(panel);
    }

    function onState(event) {
      if (finished) return;
      const { group, you } = state;

      if (group.status === "ended") return end("The host ended this group.");
      if (!you.slot) return end("You're not in this group anymore.");

      if (group.status === "playing" && !mode) {
        mode = you.host ? "host" : "guest";
        if (mode === "host") host.begin();
        else guest.begin();
      }

      if (mode === "host") host.sync();
      else if (mode === "guest") guest.sync();
      else renderLobby();
    }

    function onSignal(from, data) {
      if (mode === "host") host.signal(from, data);
      else guest.signal(from, data);
    }

    // ------------------------------------------------------- shared view

    function createView(slot) {
      const view = document.createElement("div");
      view.className = "tg-view";

      const frame = document.createElement("div");
      frame.className = "tg-frame";

      const video = document.createElement("video");
      video.playsInline = true;
      video.autoplay = true;
      frame.append(video);

      const badge = document.createElement("div");
      badge.className = "tg-badge";
      badge.textContent = "PLAYER " + slot;

      const tools = document.createElement("div");
      tools.className = "tg-tools";
      const leaveButton = document.createElement("button");
      leaveButton.type = "button";
      leaveButton.textContent = state.you.host ? "End group" : "Leave";
      leaveButton.onclick = leave;
      tools.append(leaveButton);

      const help = document.createElement("div");
      help.className = "tg-help";
      let helpTimer = 0;
      function showHelp(text) {
        help.textContent = text;
        help.style.opacity = "1";
        clearTimeout(helpTimer);
        helpTimer = setTimeout(() => {
          help.style.opacity = "0";
        }, 9000);
      }
      showHelp(CONTROLS_HELP);

      view.append(frame, badge, tools, help);
      document.body.append(view);

      let crop = region("full", slot);

      function layout() {
        const width = view.clientWidth;
        const height = view.clientHeight;
        const aspect = (crop.w * 4) / (crop.h * 3);
        let w = width;
        let h = width / aspect;
        if (h > height) {
          h = height;
          w = height * aspect;
        }
        frame.style.width = w + "px";
        frame.style.height = h + "px";
        Object.assign(video.style, {
          width: (100 / crop.w) + "%",
          height: (100 / crop.h) + "%",
          left: (-crop.x / crop.w * 100) + "%",
          top: (-crop.y / crop.h * 100) + "%"
        });
      }

      const resize = new ResizeObserver(layout);
      resize.observe(view);
      layout();

      // Split-screen games crop to this player's part; others show it all.
      const stopWatching = gameInfo().view === "split"
        ? watchLayout(video, (next) => {
          crop = region(next, slot);
          layout();
        })
        : () => {};

      return {
        view,
        video,
        note(text) {
          view.querySelector(".tg-note")?.remove();
          if (!text) return;
          const el = document.createElement("div");
          el.className = "tg-note";
          el.textContent = text;
          view.append(el);
        },
        setSlot(next) {
          slot = next;
          badge.textContent = "PLAYER " + slot;
        },
        help: showHelp,
        destroy() {
          stopWatching();
          resize.disconnect();
          view.remove();
        }
      };
    }

    // -------------------------------------------------------------- host

    const host = (() => {
      const peers = new Map(); // guest id -> { pc, slot, held, seq, hello }
      const engine = options.engine || emulatorEngine(bootEmulator);
      let stream = null;
      let view = null;
      let booting = false;

      function release(entry) {
        engine.release(entry);
        entry.held = {};
      }

      function apply(entry, raw) {
        let input;
        try {
          input = JSON.parse(raw);
        } catch {
          return;
        }
        if (!input || typeof input.s !== "number" || input.s <= entry.seq) return;
        entry.seq = input.s;
        // Never let a guest drive player 1 (the host).
        if (entry.slot < 2 || entry.slot > 4) return;
        engine.input(entry, input);
      }

      function close(id) {
        const entry = peers.get(id);
        if (!entry) return;
        peers.delete(id);
        clearInterval(entry.hello);
        release(entry);
        try {
          entry.pc.close();
        } catch {}
      }

      async function connectGuest(player) {
        const pc = new RTCPeerConnection({ iceServers });
        const entry = { pc, slot: player.slot, held: {}, seq: -1, hello: null };
        peers.set(player.id, entry);

        for (const track of stream.getTracks()) pc.addTrack(track, stream);

        const channel = pc.createDataChannel("input", { ordered: false, maxRetransmits: 0 });
        channel.onmessage = (event) => apply(entry, event.data);
        channel.onclose = () => {
          clearInterval(entry.hello);
          release(entry);
        };
        // Tell the guest which version runs here, so its controls match.
        // Repeated, since this channel may drop messages.
        if (engine.hello) {
          const hello = JSON.stringify(engine.hello);
          channel.onopen = () => {
            channel.send(hello);
            entry.hello = setInterval(() => {
              if (channel.readyState === "open") channel.send(hello);
            }, 1000);
          };
        }

        pc.onicecandidate = (event) => {
          if (event.candidate) send({ type: "signal", to: player.id, data: { candidate: event.candidate.toJSON() } });
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed" && peers.get(player.id) === entry) {
            close(player.id);
            setTimeout(sync, 1500); // try again
          }
        };

        try {
          await pc.setLocalDescription(await pc.createOffer());
          send({ type: "signal", to: player.id, data: { description: pc.localDescription.toJSON() } });
          // Favor smooth motion over sharpness, and cap each guest's stream.
          for (const sender of pc.getSenders()) {
            if (sender.track?.kind !== "video") continue;
            const parameters = sender.getParameters();
            parameters.degradationPreference = "maintain-framerate";
            parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
            parameters.encodings[0].maxBitrate = engine.bitrate || 2_500_000;
            await sender.setParameters(parameters).catch(() => {});
          }
        } catch (error) {
          console.warn("Offer failed", error);
          close(player.id);
        }
      }

      function sync() {
        if (finished || mode !== "host") return;
        const players = state.group.players;

        for (const [id, entry] of peers) {
          const player = players.find((p) => p.id === id);
          if (!player || !player.online) close(id);
          else if (player.slot !== entry.slot) {
            release(entry);
            entry.slot = player.slot;
          }
        }

        if (!stream) return;
        for (const player of players) {
          if (player.id !== myId && player.online && !peers.has(player.id)) connectGuest(player);
        }
      }

      function begin() {
        if (booting) return;
        booting = true;
        say("Starting the game…");

        Promise.resolve(engine.boot(async () => {
          try {
            stream = await engine.capture(gameInfo().fps);
          } catch (error) {
            console.warn("Capture failed", error);
            return end("Could not share the game from this browser.");
          }
          view = createView(state.you.slot);
          const local = new MediaStream(stream.getVideoTracks());
          view.video.muted = true; // the host hears the game directly
          view.video.srcObject = local;
          view.video.play().catch(() => {});
          engine.attach(view);
          statusBox.hidden = true;
          sync();
        })).catch((error) => {
          console.warn("Game failed to start", error);
          end(error?.message || "The game could not start.");
        });
      }

      function signal(from, data) {
        const entry = peers.get(from);
        if (!entry) return;
        if (data.description?.type === "answer") {
          entry.pc.setRemoteDescription(data.description).catch((error) => console.warn(error));
        } else if (data.candidate) {
          entry.pc.addIceCandidate(data.candidate).catch(() => {});
        }
      }

      function stop() {
        for (const id of [...peers.keys()]) close(id);
        engine.detach();
        view?.destroy();
        view = null;
      }

      return { begin, sync, signal, stop };
    })();

    // ------------------------------------------------------------- guest

    const guest = (() => {
      let pc = null;
      let channel = null;
      let view = null;
      let pending = [];
      let timer = null;
      let seq = 0;
      let lastSent = "";
      let lastTime = 0;
      let engine = "classic"; // "pc" / "rv" once the host says it runs the GoldenEye / Revenge PC version
      let pad = null;
      const keys = new Set();

      // The N64 classic mapping (EmulatorJS hosts), as {b, x, y}.
      function classicInput() {
        let buttons = 0;
        let x = 0;
        let y = 0;

        for (const code of keys) {
          if (code in KEYS) buttons |= 1 << KEYS[code];
          if (code in STICK_KEYS) {
            x += STICK_KEYS[code][0];
            y += STICK_KEYS[code][1];
          }
        }

        for (const pad of navigator.getGamepads ? navigator.getGamepads() : []) {
          if (!pad || !pad.connected) continue;
          pad.buttons.forEach((button, index) => {
            if (button.pressed && index in PAD) buttons |= 1 << PAD[index];
          });
          const dead = (v) => (Math.abs(v) < 0.15 ? 0 : v);
          x += dead(pad.axes[0] || 0);
          y += dead(pad.axes[1] || 0);
          const cx = pad.axes[2] || 0;
          const cy = pad.axes[3] || 0;
          if (cx > 0.5) buttons |= 1 << 20;
          if (cx < -0.5) buttons |= 1 << 21;
          if (cy > 0.5) buttons |= 1 << 22;
          if (cy < -0.5) buttons |= 1 << 23;
        }

        const round = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 100) / 100;
        return { b: buttons >>> 0, x: round(x), y: round(y) };
      }

      // The GoldenEye PC version's mapping, as N64 state: walk and strafe on
      // W A S D / the left stick (C buttons), look and aim on the arrow keys /
      // the right stick (the N64 stick).
      function pcInput() {
        let n = 0;
        let nx = 0;
        let ny = 0;

        for (const code of keys) {
          if (code in PC_KEYS) n |= PC_KEYS[code];
          if (code in PC_LOOK) {
            nx += PC_LOOK[code][0] * PC_LOOK_SPEED;
            ny += PC_LOOK[code][1] * PC_LOOK_SPEED;
          }
        }

        for (const gp of navigator.getGamepads ? navigator.getGamepads() : []) {
          if (!gp || !gp.connected) continue;
          gp.buttons.forEach((button, index) => {
            if (button.pressed && index in PC_PAD) n |= PC_PAD[index];
          });
          const dead = (v) => (Math.abs(v) < 0.15 ? 0 : v);
          nx += dead(gp.axes[2] || 0) * STICK_MAX;
          ny -= dead(gp.axes[3] || 0) * STICK_MAX;
          const mx = gp.axes[0] || 0;
          const my = gp.axes[1] || 0;
          if (my < -0.5) n |= N64.CU;
          if (my > 0.5) n |= N64.CD;
          if (mx < -0.5) n |= N64.CL;
          if (mx > 0.5) n |= N64.CR;
        }

        const clamp = (v) => Math.round(Math.max(-STICK_MAX, Math.min(STICK_MAX, v)));
        return { n, nx: clamp(nx), ny: clamp(ny) };
      }

      // The Revenge PC version's mapping, as N64 state (see RV_KEYS).
      function rvInput() {
        let n = 0;
        let nx = 0;
        let ny = 0;

        for (const code of keys) {
          if (code in RV_KEYS) n |= RV_KEYS[code];
          if (code in RV_TAUNT) {
            nx += RV_TAUNT[code][0] * STICK_MAX;
            ny += RV_TAUNT[code][1] * STICK_MAX;
          }
        }

        for (const gp of navigator.getGamepads ? navigator.getGamepads() : []) {
          if (!gp || !gp.connected) continue;
          gp.buttons.forEach((button, index) => {
            if ((button.pressed || button.value > 0.5) && index in RV_PAD) n |= RV_PAD[index];
          });
          const mx = gp.axes[0] || 0;
          const my = gp.axes[1] || 0;
          if (my < -0.5) n |= N64.DU;
          if (my > 0.5) n |= N64.DD;
          if (mx < -0.5) n |= N64.DL;
          if (mx > 0.5) n |= N64.DR;
          const dead = (v) => (Math.abs(v) < 0.2 ? 0 : v);
          nx += dead(gp.axes[2] || 0) * STICK_MAX;
          ny -= dead(gp.axes[3] || 0) * STICK_MAX;
        }

        const clamp = (v) => Math.round(Math.max(-STICK_MAX, Math.min(STICK_MAX, v)));
        return { n, nx: clamp(nx), ny: clamp(ny) };
      }

      // Both forms go out: an EmulatorJS host reads {b, x, y}, the PC host {n, nx, ny}.
      function input() {
        let state;
        if (engine === "pc") {
          state = pcInput();
        } else if (engine === "rv") {
          state = rvInput();
        } else {
          const c = classicInput();
          state = ejsToN64(c.b, c.x, c.y);
        }
        if (pad) {
          state.n |= pad.state.n;
          if (pad.state.x || pad.state.y) {
            state.nx = pad.state.x;
            state.ny = pad.state.y;
          }
        }
        return { ...n64ToEjs(state.n, state.nx, state.ny), ...state };
      }

      function tick() {
        if (!channel || channel.readyState !== "open") return;
        const now = performance.now();
        const value = input();
        const key = `${value.n}|${value.nx}|${value.ny}`;
        // Send changes right away, and repeat the current state as a heartbeat.
        if (key !== lastSent || now - lastTime > 100) {
          channel.send(JSON.stringify({ s: ++seq, ...value }));
          lastSent = key;
          lastTime = now;
        }
      }

      const onKey = (event) => {
        const known = engine === "pc"
          ? event.code in PC_KEYS || event.code in PC_LOOK
          : engine === "rv"
            ? event.code in RV_KEYS || event.code in RV_TAUNT
            : event.code in KEYS || event.code in STICK_KEYS;
        if (!known) return;
        event.preventDefault();
        if (event.type === "keydown") keys.add(event.code);
        else keys.delete(event.code);
        tick();
      };
      const onBlur = () => {
        keys.clear();
        tick();
      };

      function soundButton(video) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tg-sound";
        button.textContent = "🔊 Turn on game sound";
        button.onclick = () => {
          video.muted = false;
          video.play().catch(() => {});
          button.remove();
        };
        view.view.append(button);
      }

      // The host's hello: switch to its version's controls and help.
      function setEngine(next) {
        if ((next !== "pc" && next !== "rv") || engine === next) return;
        engine = next;
        keys.clear();
        view?.help(next === "pc" ? PC_HELP : RV_HELP);
        if (pad) {
          pad.destroy();
          pad = createPad(view.view, next, tick, unmute);
        }
      }

      // A tap on the pad counts as the click that sound needs.
      function unmute() {
        view?.view.querySelector(".tg-sound")?.click();
      }

      function begin() {
        statusBox.hidden = true;
        view = createView(state.you.slot);
        view.note("The host is starting the game…");
        if (TOUCH) {
          view.view.classList.add("tg-touch");
          pad = createPad(view.view, engine, tick, unmute);
        }
        document.addEventListener("keydown", onKey, true);
        document.addEventListener("keyup", onKey, true);
        window.addEventListener("blur", onBlur);
        view.view.tabIndex = 0;
        view.view.focus({ preventScroll: true });
        view.view.addEventListener("pointerdown", () => view.view.focus({ preventScroll: true }));
        timer = setInterval(tick, 16);
      }

      function sync() {
        view?.setSlot(state.you.slot);
        const hostPlayer = state.group.players.find((p) => p.id === state.group.host);
        if (view && hostPlayer && !hostPlayer.online) view.note("Waiting for the host to reconnect…");
      }

      async function signal(from, data) {
        if (from !== state.group.host) return;

        if (data.description?.type === "offer") {
          try {
            pc?.close();
          } catch {}
          pending = [];
          const connection = new RTCPeerConnection({ iceServers });
          pc = connection;

          connection.ontrack = (event) => {
            const video = view.video;
            if (video.srcObject !== event.streams[0]) {
              video.srcObject = event.streams[0];
              video.muted = false;
              video.play().then(() => view.note("")).catch(() => {
                // Autoplay with sound needs a click in this frame first.
                video.muted = true;
                video.play().catch(() => {});
                view.note("");
                soundButton(video);
              });
            }
          };
          connection.ondatachannel = (event) => {
            channel = event.channel;
            channel.onmessage = (message) => {
              try {
                setEngine(JSON.parse(message.data).e);
              } catch {}
            };
          };
          connection.onicecandidate = (event) => {
            if (event.candidate) send({ type: "signal", to: from, data: { candidate: event.candidate.toJSON() } });
          };
          connection.onconnectionstatechange = () => {
            if (connection !== pc) return;
            if (connection.connectionState === "failed") view?.note("Connection lost. Reconnecting…");
            if (connection.connectionState === "connected") view?.note("");
          };

          await connection.setRemoteDescription(data.description);
          await connection.setLocalDescription(await connection.createAnswer());
          send({ type: "signal", to: from, data: { description: connection.localDescription.toJSON() } });
          for (const candidate of pending) connection.addIceCandidate(candidate).catch(() => {});
          pending = [];
        } else if (data.candidate) {
          if (pc?.remoteDescription) pc.addIceCandidate(data.candidate).catch(() => {});
          else pending.push(data.candidate);
        }
      }

      function stop() {
        clearInterval(timer);
        pad?.destroy();
        pad = null;
        document.removeEventListener("keydown", onKey, true);
        document.removeEventListener("keyup", onKey, true);
        window.removeEventListener("blur", onBlur);
        try {
          pc?.close();
        } catch {}
        view?.destroy();
        view = null;
      }

      return { begin, sync, signal, stop };
    })();

    window.addEventListener("pagehide", () => {
      finished = true;
      try {
        socket?.close();
      } catch {}
    });

    renderLobby();
    connect();
  }

  window.TokenGroup = { start, pcEngine, classifyFrame, region };
})();
