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

    // GoldenEye draws a black bar between the halves at rows 236-239 of 480.
    const bar = Math.max(row(118, 8, 312), row(119, 8, 312));
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
    `;
    document.head.append(style);
  }

  const CONTROLS_HELP =
    "Keyboard: T F G H move · X = A · S = B · Tab = Z (fire) · Q / E = L / R · " +
    "I J K L = C buttons · Enter = Start. Gamepads work too.";

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
          ? `Start when everyone has a green dot. In GoldenEye, pick 2. MULTIPLAYER and set Players to ${Math.max(online, 2)}.`
          : `Waiting for ${host ? host.name : "the host"} to start the game.`);

      const keys = document.createElement("p");
      keys.className = "tg-keys";
      keys.textContent = CONTROLS_HELP;

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
      help.textContent = CONTROLS_HELP;
      setTimeout(() => {
        help.style.opacity = "0";
      }, 9000);

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

      const stopWatching = watchLayout(video, (next) => {
        crop = region(next, slot);
        layout();
      });

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
        destroy() {
          stopWatching();
          resize.disconnect();
          view.remove();
        }
      };
    }

    // -------------------------------------------------------------- host

    const host = (() => {
      const peers = new Map(); // guest id -> { pc, slot, held, seq }
      let stream = null;
      let view = null;
      let booting = false;

      function release(entry) {
        const gm = window.EJS_emulator?.gameManager;
        if (!gm) return;
        const player = entry.slot - 1;
        for (const id of DIGITAL) {
          if (entry.held[id]) gm.simulateInput(player, id, 0);
        }
        for (const id of Object.values(STICK)) {
          if (entry.held[id]) gm.simulateInput(player, id, 0);
        }
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

        const gm = window.EJS_emulator?.gameManager;
        // Never let a guest drive player 1 (the host).
        if (!gm || entry.slot < 2 || entry.slot > 4) return;
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
      }

      function close(id) {
        const entry = peers.get(id);
        if (!entry) return;
        peers.delete(id);
        release(entry);
        try {
          entry.pc.close();
        } catch {}
      }

      async function connectGuest(player) {
        const pc = new RTCPeerConnection({ iceServers });
        const entry = { pc, slot: player.slot, held: {}, seq: -1 };
        peers.set(player.id, entry);

        for (const track of stream.getTracks()) pc.addTrack(track, stream);

        const channel = pc.createDataChannel("input", { ordered: false, maxRetransmits: 0 });
        channel.onmessage = (event) => apply(entry, event.data);
        channel.onclose = () => release(entry);

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
            parameters.encodings[0].maxBitrate = 2_500_000;
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

      async function capture() {
        const emulator = window.EJS_emulator;
        const video = emulator.canvas.captureStream(60);
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
      }

      function begin() {
        if (booting) return;
        booting = true;
        say("Starting the game…");

        bootEmulator({
          onStart: async () => {
            try {
              stream = await capture();
            } catch (error) {
              console.warn("Capture failed", error);
              return end("Could not share the game from this browser.");
            }
            view = createView(state.you.slot);
            const local = new MediaStream(stream.getVideoTracks());
            view.video.muted = true; // the host hears the emulator directly
            view.video.srcObject = local;
            view.video.play().catch(() => {});
            // Keep keyboard focus on the emulator for the host's own controls.
            const game = document.getElementById("game");
            const focusGame = () => game?.focus({ preventScroll: true });
            view.view.addEventListener("pointerdown", focusGame);
            view.view.style.pointerEvents = "auto";
            focusGame();
            statusBox.hidden = true;
            sync();
          }
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
      const keys = new Set();

      function input() {
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

      function tick() {
        if (!channel || channel.readyState !== "open") return;
        const now = performance.now();
        const value = input();
        const key = `${value.b}|${value.x}|${value.y}`;
        // Send changes right away, and repeat the current state as a heartbeat.
        if (key !== lastSent || now - lastTime > 100) {
          channel.send(JSON.stringify({ s: ++seq, ...value }));
          lastSent = key;
          lastTime = now;
        }
      }

      const onKey = (event) => {
        if (!(event.code in KEYS) && !(event.code in STICK_KEYS)) return;
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

      function begin() {
        statusBox.hidden = true;
        view = createView(state.you.slot);
        view.note("The host is starting the game…");
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

  window.TokenGroup = { start, classifyFrame, region };
})();
