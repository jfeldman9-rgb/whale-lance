(() => {
  "use strict";

  const W = 1280;
  const H = 720;
  const RILEY_X = 290;
  const FLOOR_Y = 528;
  const CEIL_Y = 168;
  const SAFE_MS = 7000;
  const HOLD_JET_MS = 220;
  const WAYGATE_WARN_MS = 1500;
  const TUTORIAL_MS = 6200;
  const MAX_FOES = 5;
  const MAX_HP = 6;
  const START_HP = 3;
  const SHARDS_TO_LEVEL = [0, 3, 4];
  const RAND_MS = 10000;
  const WEAPONS = [
    null,
    { name: "FIREBALL", key: "fireball", damage: 1, speed: 560, pierce: 0, scale: 0.72, tint: 0xff8844 },
    { name: "LIGHTNING", key: "bolt", damage: 2, speed: 720, pierce: 1, scale: 0.78, tint: 0x9fd7ff },
    { name: "BALEFIRE", key: "balefire", damage: 4, speed: 640, pierce: 3, scale: 0.9, tint: 0xfff1b0 },
  ];
  const FOES = {
    trolloc: { hp: 2, score: 40, scale: 0.78, hit: 0.7 },
    brute: { hp: 5, score: 100, scale: 0.82, hit: 0.72 },
    fade: { hp: 4, score: 80, scale: 0.7, hit: 0.42 },
  };

  const KEYS = {
    best: "tkdRiley.best",
    last: "tkdRiley.last",
    mute: "tkdRiley.mute",
    learned: "tkdRiley.learned",
    seenIntro: "tkdRiley.seenIntro",
  };

  const JOKES = [
    "Level 1: fireballs. Level 3: the Pattern flinches.",
    "Trollocs have hit points now. Rude.",
    "Shards for the weapon. Hearts for the ninja.",
    "If the dragon ter'angreal shows up, duck and grin.",
    "Balefire is not a toy. Riley disagrees.",
    "The Dragon Reborn does not do homework.",
  ];

  function loadScores() {
    return {
      best: Number(localStorage.getItem(KEYS.best) || 0),
      last: JSON.parse(localStorage.getItem(KEYS.last) || "null"),
    };
  }

  function saveRun(run) {
    localStorage.setItem(KEYS.last, JSON.stringify(run));
    const best = Number(localStorage.getItem(KEYS.best) || 0);
    if (run.score > best) localStorage.setItem(KEYS.best, String(run.score));
  }

  function isMuted() {
    return localStorage.getItem(KEYS.mute) === "1";
  }

  function setMuted(on) {
    localStorage.setItem(KEYS.mute, on ? "1" : "0");
  }

  function hasLearned() {
    return localStorage.getItem(KEYS.learned) === "1";
  }

  function markLearned() {
    localStorage.setItem(KEYS.learned, "1");
  }

  function seenIntro() {
    return localStorage.getItem(KEYS.seenIntro) === "1";
  }

  function markIntro() {
    localStorage.setItem(KEYS.seenIntro, "1");
  }

  function isMagenta(r, g, b, a = 255) {
    if (a < 8) return true;
    const mag = r > 190 && b > 160 && g < 120 && (r + b) > g * 2.4;
    return mag;
  }

  function chromaKeyTexture(scene, key) {
    if (!scene.textures.exists(key)) return false;
    const tex = scene.textures.get(key);
    const src = tex.getSourceImage();
    if (!src || !src.width) return false;
    const w = src.width;
    const h = src.height;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    let found = false;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const a = d[i + 3];
      if (isMagenta(r, g, b, a)) {
        d[i + 3] = 0;
        found = true;
      } else if (a > 10) {
        const x = p % w;
        const y = (p / w) | 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (!found) return true;
    ctx.putImageData(img, 0, 0);
    const pad = 2;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const cw = Math.max(1, maxX - minX + 1);
    const ch = Math.max(1, maxY - minY + 1);
    const cropped = document.createElement("canvas");
    cropped.width = cw;
    cropped.height = ch;
    cropped.getContext("2d").drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
    scene.textures.remove(key);
    scene.textures.addCanvas(key, cropped);
    return true;
  }

  const AudioKit = {
    ctx: null,
    ensure() {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) this.ctx = new Ctx();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    beep(kind) {
      if (isMuted()) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (kind === "kick" || kind === "fire") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.17);
      } else if (kind === "jet") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.08);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (kind === "hit") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.1);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (kind === "power") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.24);
      } else if (kind === "oof") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.16);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (kind === "balefire") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.26);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (kind === "lightning") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.32);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (kind === "bonk") {
        osc.type = "square";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    },
  };

  class BootScene extends Phaser.Scene {
    constructor() {
      super("boot");
    }
    preload() {
      const bar = this.add.rectangle(W / 2, H / 2, 360, 18, 0x3a2a12);
      const fill = this.add.rectangle(W / 2 - 178, H / 2, 4, 12, 0xffe27a).setOrigin(0, 0.5);
      this.add.text(W / 2, H / 2 - 46, "The Wheel is turning…", {
        fontFamily: "Georgia, serif",
        fontSize: "28px",
        color: "#fff6d8",
      }).setOrigin(0.5);
      this.load.on("progress", (p) => {
        fill.width = 356 * p;
      });

      this.load.image("rileyIdle", "assets/riley-idle.png");
      this.load.image("rileyKick", "assets/riley-cast.png");
      this.load.image("rileyTitle", "assets/riley-title.png");
      this.load.image("trolloc", "assets/trolloc.png");
      this.load.image("brute", "assets/trolloc-brute.png");
      this.load.image("fade", "assets/fade.png");
      this.load.image("heart", "assets/heart-pickup.png");
      this.load.image("shard", "assets/weapon-shard.png");
      this.load.image("dragon", "assets/dragon-terangreal.png");
      this.load.image("fireball", "assets/fireball.png");
      this.load.image("bolt", "assets/lightning-bolt.png");
      this.load.image("balefire", "assets/balefire.png");
      this.load.image("rand", "assets/rand.png");
      this.load.image("waygate", "assets/waygate.png");
      this.load.image("bg", "assets/bg.jpg");
      this.load.image("bgFar", "assets/bg-far.jpg");
      this.load.image("bgRail", "assets/bg-rail.jpg");
      this.load.image("intro1", "assets/intro-1.jpg");
      this.load.image("intro2", "assets/intro-2.jpg");
      this.load.image("intro3", "assets/intro-3.jpg");
      this.load.image("creditsBg", "assets/credits-bg.jpg");
      this.load.image("cut1", "assets/cutscene-dragon-1.jpg");
      this.load.image("cut2", "assets/cutscene-dragon-2.jpg");
      this.load.image("cut3", "assets/cutscene-dragon-3.jpg");
      this.load.image("cut4", "assets/cutscene-dragon-4.jpg");
      this.load.on("loaderror", (file) => {
        console.warn("optional asset missed", file && file.key);
      });
    }
    create() {
      ["rileyIdle", "rileyKick", "rileyTitle", "trolloc", "brute", "fade", "heart", "shard", "dragon", "fireball", "bolt", "balefire", "rand", "waygate"]
        .forEach((key) => chromaKeyTexture(this, key));
      this.scene.start(seenIntro() ? "title" : "intro");
    }
  }

  function sweepHtmlVideos() {
    document.querySelectorAll("#tkd-video, #game video").forEach((el) => {
      try {
        if (el.tagName === "VIDEO") {
          el.pause();
          el.removeAttribute("src");
          el.load();
        }
        if (el.parentNode) el.parentNode.removeChild(el);
      } catch (_err) { /* ignore */ }
    });
  }

  function attachVideoOverlay(url, onDone) {
    sweepHtmlVideos();
    const root = document.getElementById("game");
    if (!root) {
      onDone();
      return { done: onDone };
    }
    root.style.position = "relative";
    const wrap = document.createElement("div");
    wrap.id = "tkd-video";
    wrap.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#0b1020;z-index:8;display:flex;align-items:center;justify-content:center;pointer-events:none;";
    const vid = document.createElement("video");
    vid.src = url;
    vid.muted = true;
    vid.autoplay = true;
    vid.playsInline = true;
    vid.setAttribute("playsinline", "");
    vid.setAttribute("muted", "");
    vid.style.cssText = "width:100%;height:100%;object-fit:contain;pointer-events:none;";
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      try {
        vid.pause();
        vid.removeAttribute("src");
        vid.load();
      } catch (_err) { /* ignore */ }
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      onDone();
    };
    vid.addEventListener("ended", done);
    vid.addEventListener("error", done);
    wrap.appendChild(vid);
    root.appendChild(wrap);
    const play = vid.play();
    if (play && play.catch) play.catch(() => done());
    return { wrap, done };
  }

  class VideoScene extends Phaser.Scene {
    constructor(key, videoKey, nextKey, frames) {
      super(key);
      this.videoKey = videoKey;
      this.nextKey = nextKey;
      this.frames = frames;
    }
    create() {
      this.done = false;
      this.overlay = null;
      sweepHtmlVideos();
      this.add.rectangle(W / 2, H / 2, W, H, 0x0b1020);
      this.overlay = attachVideoOverlay(`assets/${this.videoKey}.mp4`, () => this.finish());
      this.time.delayedCall(14000, () => this.finish());

      const skip = this.add.text(W - 28, 22, "SKIP", {
        fontFamily: "Impact, sans-serif",
        fontSize: "28px",
        color: "#fff8e0",
        stroke: "#123",
        strokeThickness: 5,
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(8);
      skip.on("pointerdown", (p) => {
        if (p.event && p.event.stopPropagation) p.event.stopPropagation();
        this.finish();
      });
      this.input.keyboard.once("keydown-SPACE", () => this.finish());
      this.input.keyboard.once("keydown-ENTER", () => this.finish());
      this.input.once("pointerdown", () => this.finish());
    }
    slideshow() {
      const keys = this.frames.filter((k) => this.textures.exists(k));
      if (!keys.length) {
        this.time.delayedCall(400, () => this.finish());
        return;
      }
      const img = this.add.image(W / 2, H / 2, keys[0]).setDisplaySize(W, H);
      let i = 0;
      this.time.addEvent({
        delay: 2200,
        repeat: keys.length - 1,
        callback: () => {
          i += 1;
          if (i >= keys.length) this.finish();
          else img.setTexture(keys[i]).setDisplaySize(W, H);
        },
      });
    }
    finish() {
      if (this.done) return;
      this.done = true;
      if (this.overlay && this.overlay.done) this.overlay.done();
      this.overlay = null;
      sweepHtmlVideos();
      markIntro();
      this.scene.start(this.nextKey);
    }
  }

  class IntroScene extends VideoScene {
    constructor() {
      super("intro", "intro", "title", ["intro1", "intro2", "intro3"]);
    }
  }

  class TitleScene extends Phaser.Scene {
    constructor() {
      super("title");
    }
    create() {
      sweepHtmlVideos();
      this.drawBackdrop();
      const riley = this.add.image(340, 400, "rileyTitle").setScale(0.92);
      this.tweens.add({
        targets: riley,
        y: 388,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });

      this.add.text(820, 96, "TAE KWON", {
        fontFamily: "Georgia, Impact, serif",
        fontSize: "58px",
        color: "#fff4c8",
        stroke: "#5a1e10",
        strokeThickness: 7,
      }).setOrigin(0.5);
      this.add.text(820, 164, "DOE RILEY", {
        fontFamily: "Georgia, Impact, serif",
        fontSize: "72px",
        color: "#ffe27a",
        stroke: "#5a1e10",
        strokeThickness: 8,
      }).setOrigin(0.5);

      this.add.text(820, 236, "Tap to fire. Upgrade the weapon. Call the Dragon Reborn.", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "24px",
        color: "#fff6d0",
        align: "center",
        wordWrap: { width: 560 },
      }).setOrigin(0.5);

      const { best, last } = loadScores();
      const lastLine = last ? `Last ${last.score}` : "Last —";
      this.add.text(820, 300, `Best ${best}   ·   ${lastLine}`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "24px",
        color: "#e8f6ff",
      }).setOrigin(0.5);

      this.add.text(820, 348, Phaser.Utils.Array.GetRandom(JOKES), {
        fontFamily: "Georgia, serif",
        fontSize: "22px",
        fontStyle: "italic",
        color: "#ffd7e8",
      }).setOrigin(0.5);

      const play = this.makeButton(820, 470, "PLAY", () => {
        AudioKit.ensure();
        this.scene.start("play");
      }, 420, 118, 64);
      this.tweens.add({
        targets: [play.bg, play.txt],
        scaleX: 1.04,
        scaleY: 1.04,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });

      this.addMute(40, 40);
      this.input.keyboard.once("keydown-SPACE", () => {
        AudioKit.ensure();
        this.scene.start("play");
      });
      this.input.keyboard.once("keydown-ENTER", () => {
        AudioKit.ensure();
        this.scene.start("play");
      });
    }

    drawBackdrop() {
      this.add.image(W / 2, H / 2, "bg").setDisplaySize(W, H).setAlpha(0.9);
      this.add.rectangle(W / 2, H / 2, W, H, 0x120818, 0.32);
    }

    makeButton(x, y, label, onClick, bw = 260, bh = 72, fontSize = 40) {
      const bg = this.add.rectangle(x, y, bw, bh, 0xc9a227, 1)
        .setStrokeStyle(5, 0xfff1b0)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(x, y, label, {
        fontFamily: "Impact, Georgia, serif",
        fontSize: `${fontSize}px`,
        color: "#1a1208",
      }).setOrigin(0.5);
      bg.on("pointerover", () => bg.setFillStyle(0xffd65c));
      bg.on("pointerout", () => bg.setFillStyle(0xc9a227));
      bg.on("pointerdown", onClick);
      return { bg, txt };
    }

    addMute(x, y) {
      const btn = this.add.text(x, y, isMuted() ? "🔇" : "🔊", { fontSize: "36px" }).setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => {
        setMuted(!isMuted());
        btn.setText(isMuted() ? "🔇" : "🔊");
      });
    }
  }

  class PlayScene extends Phaser.Scene {
    constructor() {
      super("play");
    }

    create() {
      sweepHtmlVideos();
      this.dead = false;
      this.cutscene = false;
      this.hp = START_HP;
      this.maxHp = START_HP;
      this.weaponLevel = 1;
      this.weaponXP = 0;
      this.distance = 0;
      this.score = 0;
      this.shots = 0;
      this.trollocsDown = 0;
      this.holdBoost = false;
      this.casting = false;
      this.castUntil = 0;
      this.dive = false;
      this.scroll = 86;
      this.pointerDownAt = 0;
      this.swipeStart = null;
      this.jetSfx = 0;
      this.runMs = 0;
      this.didTap = false;
      this.didHit = false;
      this.invuln = SAFE_MS;
      this.gateWarned = false;
      this.gateWarnUntil = 0;
      this.shownPowerPrompt = false;
      this.shownTrollocPrompt = false;
      this.showTutorial = !hasLearned();
      this.foodLane = 0;
      this.randUntil = 0;
      this.randClearAt = 0;
      this.dragonUsed = false;
      this.fireCool = 0;

      this.bgFar1 = this.add.image(0, H / 2, "bgFar").setOrigin(0, 0.5).setDisplaySize(W, H);
      this.bgFar2 = this.add.image(W, H / 2, "bgFar").setOrigin(0, 0.5).setDisplaySize(W, H);
      this.bg1 = this.add.image(0, H / 2, "bg").setOrigin(0, 0.5).setDisplaySize(W, H).setAlpha(0.92);
      this.bg2 = this.add.image(W, H / 2, "bg").setOrigin(0, 0.5).setDisplaySize(W, H).setAlpha(0.92);
      this.rail1 = this.add.image(0, H, "bgRail").setOrigin(0, 1).setDisplaySize(W, 210).setDepth(6);
      this.rail2 = this.add.image(W, H, "bgRail").setOrigin(0, 1).setDisplaySize(W, 210).setDepth(6);

      this.trollocs = this.physics.add.group();
      this.hazards = this.physics.add.group();
      this.pickups = this.physics.add.group();
      this.gates = this.physics.add.group();
      this.shotsGroup = this.physics.add.group();

      this.riley = this.physics.add.image(RILEY_X, 350, "rileyIdle");
      this.riley.body.allowGravity = true;
      this.riley.setMaxVelocity(0, 380);
      this.riley.setDepth(8);
      this.physics.world.setBounds(0, 0, W, H);
      this.physics.world.gravity.y = 90;
      window.TkdRiley = { play: this };

      this.rand = this.add.image(RILEY_X + 90, 320, "rand").setScale(0.58).setDepth(9).setAlpha(0);

      this.physics.add.overlap(this.riley, this.trollocs, this.onFoeTouch, null, this);
      this.physics.add.overlap(this.riley, this.hazards, this.onFoeTouch, null, this);
      this.physics.add.overlap(this.riley, this.pickups, this.onPickup, null, this);
      this.physics.add.overlap(this.riley, this.gates, this.onGate, null, this);
      this.physics.add.overlap(this.shotsGroup, this.trollocs, this.onShotHit, null, this);
      this.physics.add.overlap(this.shotsGroup, this.hazards, this.onShotHit, null, this);

      this.scoreText = this.add.text(28, 14, "Score 0", {
        fontFamily: "Impact, Trebuchet MS, sans-serif",
        fontSize: "36px",
        color: "#fff8dc",
        stroke: "#123",
        strokeThickness: 6,
      }).setDepth(20);

      this.heartText = this.add.text(28, 58, "", {
        fontFamily: "Impact, sans-serif",
        fontSize: "28px",
        color: "#ff6b7a",
        stroke: "#3a1010",
        strokeThickness: 4,
      }).setDepth(20);

      this.meterBack = this.add.rectangle(W / 2, 42, 520, 40, 0x173246).setStrokeStyle(4, 0xfff1b0).setDepth(20);
      this.meterFill = this.add.rectangle(W / 2 - 252, 42, 504, 28, 0xff7a3a).setOrigin(0, 0.5).setDepth(21);
      this.meterLabel = this.add.text(W / 2, 42, "FIREBALL", {
        fontFamily: "Impact, sans-serif",
        fontSize: "26px",
        color: "#1a1208",
      }).setOrigin(0.5).setDepth(22);

      this.warnText = this.add.text(W / 2, 92, "", {
        fontFamily: "Impact, Trebuchet MS, sans-serif",
        fontSize: "28px",
        color: "#ffe27a",
        stroke: "#3a1a10",
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(24).setAlpha(0);

      this.muteBtn = this.add.text(W - 58, 16, isMuted() ? "🔇" : "🔊", { fontSize: "38px" })
        .setInteractive({ useHandCursor: true })
        .setDepth(22);
      this.muteBtn.on("pointerdown", (p) => {
        if (p.event && p.event.stopPropagation) p.event.stopPropagation();
        setMuted(!isMuted());
        this.muteBtn.setText(isMuted() ? "🔇" : "🔊");
      });

      this.prompt = this.add.text(W / 2, 168, "", {
        fontFamily: "Impact, Georgia, serif",
        fontSize: "62px",
        color: "#fff4c8",
        stroke: "#8b1e2d",
        strokeThickness: 8,
        align: "center",
      }).setOrigin(0.5).setDepth(25).setAlpha(0);

      this.finger = this.add.text(RILEY_X + 170, 230, "👆", {
        fontSize: "72px",
      }).setOrigin(0.5).setDepth(25).setAlpha(0);
      this.fingerTween = this.tweens.add({
        targets: this.finger,
        y: 198,
        duration: 380,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
        paused: true,
      });

      this.cutLayer = this.add.container(0, 0).setDepth(50).setVisible(false);

      if (this.showTutorial) this.startTapTutorial();

      this.cursors = this.input.keyboard.addKeys({
        space: "SPACE",
        s: "S",
        down: "DOWN",
      });
      this.spaceHeld = false;
      this.input.keyboard.on("keydown-SPACE", () => {
        if (this.spaceHeld) return;
        this.spaceHeld = true;
        this.pointerDownAt = this.time.now;
        this.fire();
      });
      this.input.keyboard.on("keyup-SPACE", () => {
        this.spaceHeld = false;
        this.holdBoost = false;
      });
      this.input.keyboard.on("keydown-S", () => this.doDive());
      this.input.keyboard.on("keydown-DOWN", () => this.doDive());

      this.input.on("pointerdown", (p) => {
        if (this.dead || this.cutscene) return;
        if (p.y < 80 && p.x > W - 100) return;
        this.pointerDownAt = this.time.now;
        this.swipeStart = { x: p.x, y: p.y, t: this.time.now };
        this.holdBoost = true;
        this.fire();
      });
      this.input.on("pointerup", (p) => {
        this.holdBoost = false;
        if (this.swipeStart) {
          const dy = p.y - this.swipeStart.y;
          if (dy > 70) this.doDive();
        }
        this.swipeStart = null;
      });

      this.time.addEvent({ delay: 1180, loop: true, callback: () => this.spawnWave() });
      this.applyRileyLook();
      this.refreshHUD();
    }

    startTapTutorial() {
      this.prompt.setText("TAP TO FIRE").setAlpha(1);
      this.finger.setAlpha(1);
      this.fingerTween.play();
      this.tweens.add({
        targets: this.prompt,
        scale: 1.08,
        duration: 420,
        yoyo: true,
        repeat: 6,
      });
      this.time.delayedCall(TUTORIAL_MS, () => {
        if (this.prompt.text === "TAP TO FIRE") this.fadePrompt();
        this.tweens.add({
          targets: this.finger,
          alpha: 0,
          duration: 420,
          onComplete: () => this.fingerTween.pause(),
        });
      });
    }

    fadePrompt() {
      this.tweens.add({ targets: this.prompt, alpha: 0, duration: 400 });
    }

    flashPrompt(text, holdMs = 2200) {
      if (this.dead || !this.showTutorial) return;
      if (this.runMs < TUTORIAL_MS && text !== "TAP TO FIRE") {
        this.time.delayedCall(TUTORIAL_MS - this.runMs + 80, () => this.flashPrompt(text, holdMs));
        return;
      }
      this.prompt.setText(text).setAlpha(1).setScale(1);
      this.tweens.add({
        targets: this.prompt,
        scale: 1.06,
        duration: 180,
        yoyo: true,
        repeat: 3,
      });
      this.time.delayedCall(holdMs, () => {
        if (this.prompt.text === text) this.fadePrompt();
      });
    }

    flashWarn(text, holdMs = 2400) {
      this.warnText.setText(text).setAlpha(1);
      this.tweens.add({
        targets: this.warnText,
        alpha: 0.35,
        duration: 160,
        yoyo: true,
        repeat: 6,
      });
      this.time.delayedCall(holdMs, () => {
        if (this.warnText.text === text) {
          this.tweens.add({ targets: this.warnText, alpha: 0, duration: 280 });
        }
      });
    }

    fire() {
      if (this.dead || this.cutscene) return;
      this.didTap = true;
      this.maybeLearn();
      const hop = 1;
      this.riley.setVelocityY(-250 * hop);
      this.casting = true;
      this.castUntil = this.time.now + 280;
      if (this.fireCool <= 0) {
        this.spawnShot();
        this.fireCool = this.weaponLevel >= 3 ? 160 : this.weaponLevel === 2 ? 200 : 240;
      }
    }

    spawnShot() {
      const spec = WEAPONS[this.weaponLevel] || WEAPONS[1];
      const shot = this.shotsGroup.create(this.riley.x + 90, this.riley.y - 10, spec.key);
      shot.setScale(spec.scale);
      shot.body.allowGravity = false;
      shot.setVelocityX(spec.speed);
      shot.setVelocityY(0);
      shot.setDepth(10);
      shot.setData("damage", spec.damage);
      shot.setData("pierce", spec.pierce);
      shot.setData("hits", 0);
      this.shots += 1;
      AudioKit.beep(this.weaponLevel >= 3 ? "balefire" : this.weaponLevel === 2 ? "lightning" : "fire");
    }

    holdJet(dt) {
      if (this.dead || this.cutscene) return;
      if (this.time.now - this.pointerDownAt < HOLD_JET_MS) return;
      this.riley.setVelocityY(this.riley.body.velocity.y - 980 * (dt / 1000));
      this.jetSfx -= dt;
      if (this.jetSfx <= 0) {
        AudioKit.beep("jet");
        this.jetSfx = 90;
      }
    }

    doDive() {
      if (this.dead || this.cutscene) return;
      this.riley.setVelocityY(Math.max(this.riley.body.velocity.y, 0) + 280);
      this.dive = true;
      this.time.delayedCall(180, () => { this.dive = false; });
    }

    maybeLearn() {
      if (this.didTap && this.didHit) markLearned();
    }

    spawnWave() {
      if (this.dead || this.cutscene) return;
      const safe = this.runMs < SAFE_MS;
      const y = this.nextLaneY();
      const foeN = this.trollocs.countActive(true) + this.hazards.countActive(true);

      if (safe) {
        if (foeN < MAX_FOES) this.spawnFoe("trolloc", y);
        return;
      }

      const roll = Math.random();
      if (roll < 0.5) {
        if (foeN < MAX_FOES) this.spawnFoe("trolloc", y);
      } else if (roll < 0.62) {
        if (foeN < MAX_FOES) this.spawnFoe("brute", y);
      } else if (roll < 0.72) {
        if (foeN < MAX_FOES) this.spawnFoe("fade", Phaser.Math.Between(200, 460));
      } else if (roll < 0.84) {
        this.spawnItem(this.pickups, "heart", y, 0.88, { hit: 1.05 });
        this.maybePowerPrompt();
      } else if (roll < 0.95) {
        this.spawnItem(this.pickups, "shard", Phaser.Math.Between(220, 480), 0.88, { hit: 1.05 });
        this.maybePowerPrompt();
      } else if (!this.dragonUsed && this.runMs > 14000) {
        this.spawnItem(this.pickups, "dragon", Phaser.Math.Between(240, 420), 0.92, { hit: 1.1 });
      } else {
        this.spawnItem(this.gates, "waygate", Phaser.Math.Between(280, 470), 0.7, { hit: 0.36 });
      }
    }

    nextLaneY() {
      this.foodLane = (this.foodLane + 1) % 5;
      const lanes = [250, 340, 420, 300, 480];
      return Phaser.Math.Clamp(lanes[this.foodLane] + Phaser.Math.Between(-24, 24), 170, 560);
    }

    spawnFoe(kind, y) {
      const spec = FOES[kind];
      const group = kind === "fade" ? this.hazards : this.trollocs;
      const item = this.spawnItem(group, kind, y, spec.scale, { hit: spec.hit });
      item.setData("hp", spec.hp);
      item.setData("maxHp", spec.hp);
      item.setData("score", spec.score);
      const bar = this.add.rectangle(item.x, item.y - 70, 64, 8, 0xff4b4b).setDepth(12);
      item.setData("hpBar", bar);
      if (this.showTutorial && !this.shownTrollocPrompt) {
        this.shownTrollocPrompt = true;
        this.flashPrompt("BLAST THE TROLLOCS", 2600);
      }
      return item;
    }

    maybePowerPrompt() {
      if (this.showTutorial && !this.shownPowerPrompt) {
        this.shownPowerPrompt = true;
        this.flashPrompt("HEARTS HEAL  ·  SHARDS UPGRADE", 2800);
      }
    }

    spawnItem(group, key, y, scale, opts = {}) {
      const item = group.create(W + 90, y, key);
      item.setScale(scale);
      item.body.allowGravity = false;
      item.setVelocityX(this.itemSpeed());
      item.setImmovable(true);
      item.setDepth(3);
      item.setData("kind", key);
      const hit = opts.hit == null ? 1 : opts.hit;
      item.body.setSize(item.width * hit, item.height * hit);
      item.body.setOffset((item.width - item.body.width) / 2, (item.height - item.body.height) / 2);
      return item;
    }

    onShotHit(shot, foe) {
      if (!shot.active || !foe.active) return;
      const dmg = shot.getData("damage") || 1;
      const pierce = shot.getData("pierce") || 0;
      const hits = (shot.getData("hits") || 0) + 1;
      shot.setData("hits", hits);
      this.hurtFoe(foe, dmg);
      if (hits > pierce) shot.destroy();
    }

    hurtFoe(foe, dmg) {
      const hp = (foe.getData("hp") || 1) - dmg;
      foe.setData("hp", hp);
      this.didHit = true;
      this.maybeLearn();
      AudioKit.beep("hit");
      foe.setTint(0xffe0a0);
      this.time.delayedCall(80, () => { if (foe.active) foe.clearTint(); });
      this.floatLabel(foe.x, foe.y - 60, `-${dmg}`);
      if (hp <= 0) {
        this.trollocsDown += 1;
        this.score += foe.getData("score") || 40;
        const bar = foe.getData("hpBar");
        if (bar && bar.destroy) bar.destroy();
        foe.destroy();
      }
    }

    onFoeTouch(_riley, item) {
      if (this.randUntil > this.time.now) {
        this.hurtFoe(item, 99);
        return;
      }
      this.takeHit(item, item.getData("kind") === "fade"
        ? "The Fade asked for silence. Riley answered with a fireball… almost."
        : "A Trolloc wanted a hug. Riley offered a forehead.");
    }

    takeHit(item, reason) {
      if (this.invuln > 0 || this.cutscene) return;
      if (item && item.active) {
        const bar = item.getData("hpBar");
        if (bar && bar.destroy) bar.destroy();
        item.destroy();
      }
      this.hp -= 1;
      this.invuln = 1200;
      this.riley.setVelocityY(-180);
      this.riley.x = Math.max(180, this.riley.x - 36);
      this.floatLabel(this.riley.x, this.riley.y - 60, "oof");
      this.flashWarn(this.hp > 0 ? `oof — ${this.hp} heart${this.hp === 1 ? "" : "s"} left!` : "Last weave missed.", 1600);
      this.cameras.main.flash(180, 255, 230, 180);
      AudioKit.beep("oof");
      this.refreshHUD();
      if (this.hp <= 0) this.die(reason);
    }

    onPickup(_riley, item) {
      const kind = item.getData("kind");
      item.destroy();
      AudioKit.beep("power");
      if (kind === "heart") {
        if (this.hp < MAX_HP) {
          this.hp += 1;
          this.maxHp = Math.max(this.maxHp, this.hp);
        }
        this.score += 40;
        this.floatLabel(this.riley.x, this.riley.y - 80, "+1 HEART");
        this.flashWarn("Riley's health rises!", 1400);
      } else if (kind === "shard") {
        this.addWeaponXP(1);
        this.score += 50;
      } else if (kind === "dragon") {
        this.score += 200;
        this.startDragonCutscene();
      }
      this.refreshHUD();
    }

    addWeaponXP(n) {
      if (this.weaponLevel >= 3) {
        this.floatLabel(this.riley.x, this.riley.y - 80, "Balefire is already singing.");
        return;
      }
      this.weaponXP += n;
      const need = SHARDS_TO_LEVEL[this.weaponLevel] || 3;
      this.floatLabel(this.riley.x, this.riley.y - 80, `WEAPON ${this.weaponXP}/${need}`);
      if (this.weaponXP >= need) {
        this.weaponXP = 0;
        this.weaponLevel += 1;
        const name = WEAPONS[this.weaponLevel].name;
        this.flashWarn(`Weapon up! ${name}!`, 2000);
        this.cameras.main.flash(200, 255, 230, 160);
      }
    }

    startDragonCutscene() {
      if (this.dragonUsed || this.cutscene) return;
      this.dragonUsed = true;
      this.cutscene = true;
      this.riley.setVelocity(0, 0);
      this.trollocs.setVelocityX(0);
      this.hazards.setVelocityX(0);
      this.pickups.setVelocityX(0);
      this.gates.setVelocityX(0);
      this.shotsGroup.setVelocityX(0);

      this.cutLayer.removeAll(true);
      this.cutLayer.setVisible(true);
      const frames = ["cut1", "cut2", "cut3", "cut4"].filter((k) => this.textures.exists(k));
      const img = this.add.image(W / 2, H / 2, frames[0] || "bg").setDisplaySize(W, H);
      const cap = this.add.text(W / 2, H - 70, "The dragon ter'angreal answers…", {
        fontFamily: "Georgia, serif",
        fontSize: "32px",
        color: "#fff4c8",
        stroke: "#120818",
        strokeThickness: 6,
      }).setOrigin(0.5);
      const skip = this.add.text(W - 28, 22, "SKIP", {
        fontFamily: "Impact, sans-serif",
        fontSize: "28px",
        color: "#fff8e0",
        stroke: "#123",
        strokeThickness: 5,
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      this.cutLayer.add([img, cap, skip]);
      let i = 0;
      const captions = [
        "The dragon ter'angreal answers…",
        "A redhead steps out of the Light.",
        "The Dragon Reborn stands with Riley.",
        "THE DRAGON REBORN",
      ];
      const ev = this.time.addEvent({
        delay: 1400,
        repeat: Math.max(0, frames.length - 1),
        callback: () => {
          i += 1;
          if (i < frames.length) {
            img.setTexture(frames[i]).setDisplaySize(W, H);
            cap.setText(captions[i] || "");
          } else {
            this.endDragonCutscene();
          }
        },
      });
      const finish = () => {
        ev.remove(false);
        this.endDragonCutscene();
      };
      skip.on("pointerdown", (p) => {
        if (p.event && p.event.stopPropagation) p.event.stopPropagation();
        finish();
      });
      this.input.keyboard.once("keydown-SPACE", finish);
    }

    endDragonCutscene() {
      if (!this.cutscene) return;
      this.cutscene = false;
      this.cutLayer.setVisible(false);
      this.cutLayer.removeAll(true);
      this.randUntil = this.time.now + RAND_MS;
      this.tweens.add({ targets: this.rand, alpha: 1, duration: 280 });
      this.flashWarn("The Dragon Reborn clears the field!", 2200);
      this.cameras.main.flash(260, 255, 240, 180);
      AudioKit.beep("lightning");
    }

    tickRand() {
      if (this.randUntil <= this.time.now) {
        if (this.rand.alpha > 0) this.tweens.add({ targets: this.rand, alpha: 0, duration: 300 });
        return;
      }
      this.rand.x += ((this.riley.x + 110) - this.rand.x) * 0.2;
      this.rand.y += ((this.riley.y - 8) - this.rand.y) * 0.2;
      if (this.time.now < this.randClearAt) return;
      this.randClearAt = this.time.now + 180;
      const zap = (group) => {
        group.children.iterate((foe) => {
          if (foe && foe.active) this.hurtFoe(foe, 99);
        });
      };
      zap(this.trollocs);
      zap(this.hazards);
    }

    onGate(_riley, item) {
      if (this.weaponLevel >= 2 || this.randUntil > this.time.now) {
        this.gateWarned = false;
        return;
      }
      const now = this.time.now;
      if (!this.gateWarned) {
        this.gateWarned = true;
        this.gateWarnUntil = now + WAYGATE_WARN_MS;
        this.riley.setVelocityY(-80);
        this.riley.x = Math.max(170, this.riley.x - 48);
        this.flashWarn("Need a stronger weave for the Waygate!", 1600);
        AudioKit.beep("oof");
        return;
      }
      if (now < this.gateWarnUntil) return;
      this.die("The Waygate wanted more of the One Power than Riley had on hand.");
    }

    floatLabel(x, y, text) {
      const t = this.add.text(x, y, text, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "24px",
        color: "#fff4c2",
        stroke: "#222",
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(30);
      this.tweens.add({
        targets: t,
        y: y - 50,
        alpha: 0,
        duration: 700,
        onComplete: () => t.destroy(),
      });
    }

    refreshHUD() {
      const hearts = "♥".repeat(this.hp) + "♡".repeat(Math.max(0, this.maxHp - this.hp));
      this.heartText.setText(hearts);
      const spec = WEAPONS[this.weaponLevel] || WEAPONS[1];
      const need = SHARDS_TO_LEVEL[this.weaponLevel] || 3;
      const t = this.weaponLevel >= 3 ? 1 : (this.weaponXP / need);
      this.meterFill.width = 504 * Math.max(0.06, t);
      this.meterFill.setFillStyle(this.weaponLevel >= 3 ? 0xfff1b0 : this.weaponLevel === 2 ? 0x6ec8ff : 0xff7a3a);
      this.meterLabel.setText(this.randUntil > this.time.now ? "DRAGON REBORN" : spec.name);
    }

    applyRileyLook() {
      const key = this.casting ? "rileyKick" : "rileyIdle";
      if (this.riley.texture.key !== key) this.riley.setTexture(key);
      let sx = key === "rileyKick" ? 0.6 : 0.7;
      let sy = sx;
      if (this.dive) sy *= 0.86;
      this.riley.setScale(sx, sy);
      const bw = 90;
      const bh = 110;
      this.riley.body.setSize(bw, bh);
      this.riley.body.setOffset((this.riley.width - bw) / 2, (this.riley.height - bh) / 2);
    }

    softBounds() {
      if (this.riley.y > FLOOR_Y) {
        this.riley.y = FLOOR_Y;
        const vy = this.riley.body.velocity.y;
        this.riley.setVelocityY(vy > 40 ? -vy * 0.3 : Math.min(vy, 0));
      }
      if (this.riley.y < CEIL_Y) {
        this.riley.y = CEIL_Y;
        const vy = this.riley.body.velocity.y;
        this.riley.setVelocityY(vy < -40 ? -vy * 0.3 : Math.max(vy, 0));
      }
      this.riley.x += (RILEY_X - this.riley.x) * 0.08;
      this.riley.setVelocityX(0);
    }

    update(_t, dt) {
      if (this.dead) return;
      this.runMs += dt;
      this.invuln = Math.max(0, this.invuln - dt);
      this.fireCool = Math.max(0, this.fireCool - dt);
      if (this.time.now >= this.castUntil) this.casting = false;

      if (this.cutscene) return;

      const spaceDown = this.cursors.space.isDown;
      if (spaceDown) this.holdBoost = true;
      if (spaceDown || this.holdBoost) this.holdJet(dt);

      if (this.weaponLevel >= 2) this.gateWarned = false;
      if (this.gateWarned && this.time.now >= this.gateWarnUntil && this.weaponLevel < 2) {
        let stuck = false;
        this.gates.children.iterate((gate) => {
          if (gate && gate.active && this.physics.overlap(this.riley, gate)) stuck = true;
        });
        if (stuck) {
          this.die("The Waygate wanted more of the One Power than Riley had on hand.");
          return;
        }
      }

      const targetY = 348 + Math.sin(this.runMs / 520) * 22;
      this.riley.body.velocity.y += (targetY - this.riley.y) * 0.055;

      const ramp = Math.min(92, this.runMs / 1000 * 1.15);
      this.scroll = 86 + ramp;
      this.distance += (this.scroll * dt) / 1000;
      this.score += dt * 0.018;

      const wrapPair = (a, b) => {
        if (a.x <= -W) a.x = b.x + W;
        if (b.x <= -W) b.x = a.x + W;
      };
      const far = this.scroll * 0.18 * (dt / 1000);
      const mid = this.scroll * 0.34 * (dt / 1000);
      const near = this.scroll * 0.92 * (dt / 1000);
      this.bgFar1.x -= far;
      this.bgFar2.x -= far;
      this.bg1.x -= mid;
      this.bg2.x -= mid;
      this.rail1.x -= near;
      this.rail2.x -= near;
      wrapPair(this.bgFar1, this.bgFar2);
      wrapPair(this.bg1, this.bg2);
      wrapPair(this.rail1, this.rail2);

      this.tickRand();
      this.softBounds();
      this.applyRileyLook();
      this.refreshHUD();
      this.syncHpBars();
      this.sweep(this.trollocs);
      this.sweep(this.hazards);
      this.sweep(this.pickups);
      this.sweep(this.gates);
      this.shotsGroup.children.iterate((shot) => {
        if (shot && shot.x > W + 160) shot.destroy();
      });

      if (this.invuln > 0) this.riley.setAlpha(0.55 + 0.45 * Math.sin(this.runMs / 40));
      else this.riley.setAlpha(1);

      this.scoreText.setText(`Score ${Math.floor(this.score)}`);
      this.syncScrollVelocities();
    }

    syncHpBars() {
      const sync = (group) => {
        group.children.iterate((foe) => {
          if (!foe || !foe.active) return;
          const bar = foe.getData("hpBar");
          if (!bar || !bar.active) return;
          const hp = foe.getData("hp") || 0;
          const max = foe.getData("maxHp") || 1;
          bar.x = foe.x;
          bar.y = foe.y - Math.max(58, foe.displayHeight * 0.42);
          bar.width = 64 * Math.max(0, hp / max);
        });
      };
      sync(this.trollocs);
      sync(this.hazards);
    }

    itemSpeed() {
      return -(this.scroll + 128);
    }

    syncScrollVelocities() {
      const vx = this.itemSpeed();
      const setVx = (group) => {
        group.children.iterate((child) => {
          if (child && child.body) child.setVelocityX(vx);
        });
      };
      setVx(this.trollocs);
      setVx(this.hazards);
      setVx(this.pickups);
      setVx(this.gates);
    }

    sweep(group) {
      group.children.iterate((child) => {
        if (child && child.x < -180) {
          const bar = child.getData && child.getData("hpBar");
          if (bar && bar.destroy) bar.destroy();
          child.destroy();
        }
      });
    }

    die(reason) {
      if (this.dead) return;
      this.dead = true;
      AudioKit.beep("bonk");
      this.riley.setVelocity(0, 0);
      this.riley.body.allowGravity = false;
      this.trollocs.setVelocityX(0);
      this.hazards.setVelocityX(0);
      this.pickups.setVelocityX(0);
      this.gates.setVelocityX(0);

      const prevLast = loadScores().last;
      const run = {
        score: Math.floor(this.score),
        distance: Math.floor(this.distance),
        kicks: this.shots,
        trollocs: this.trollocsDown,
        reason,
        prevLast: prevLast ? prevLast.score : null,
      };
      saveRun(run);
      this.scene.launch("over", run);
    }
  }

  class OverScene extends Phaser.Scene {
    constructor() {
      super("over");
    }
    create(run) {
      this.run = run;
      this.phase = "over";
      this.layer = this.add.container(0, 0).setDepth(40);
      this.blocker = this.add.rectangle(W / 2, H / 2, W, H, 0x120818, 0.55)
        .setInteractive()
        .setDepth(39);

      this.drawOverCard(true);
      this.overTimer = this.time.delayedCall(2400, () => this.showCredits());
      this.input.keyboard.on("keydown-SPACE", this.onSpace, this);
      this.input.keyboard.on("keydown-ENTER", this.onSpace, this);
      this.time.delayedCall(450, () => {
        this.input.on("pointerdown", this.onTap, this);
      });
      this.events.once("shutdown", () => {
        if (this.creditsOverlay && this.creditsOverlay.done) this.creditsOverlay.done();
        sweepHtmlVideos();
      });
    }

    drawOverCard(first) {
      const { best } = loadScores();
      const run = this.run;
      const hi = run.score >= best && run.score > 0 ? "  ★ new best!" : "";
      const lastLine = run.prevLast == null ? "Last — first Pattern!" : `Last ${run.prevLast}`;
      this.layer.add(this.add.rectangle(W / 2, H / 2, 680, 420, 0x1a1430, 0.94).setStrokeStyle(5, 0xffe08a));
      this.layer.add(this.add.text(W / 2, 210, "GAME OVER", {
        fontFamily: "Impact, Georgia, serif",
        fontSize: "56px",
        color: "#fff2c4",
      }).setOrigin(0.5));
      this.layer.add(this.add.text(W / 2, 292, run.reason, {
        fontFamily: "Georgia, serif",
        fontSize: "24px",
        color: "#ffe7d0",
        align: "center",
        wordWrap: { width: 600 },
      }).setOrigin(0.5));
      this.layer.add(this.add.text(W / 2, 400, first
        ? `Score ${run.score}${hi}\nBest ${best}\n${lastLine}`
        : `Score ${run.score}${hi}   ·   Best ${best}`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: first ? "26px" : "24px",
        color: "#e8f6ff",
        align: "center",
        lineSpacing: 8,
      }).setOrigin(0.5));
    }

    onSpace() {
      if (this.phase === "over") this.showCredits();
      else if (this.phase === "credits") this.showMenu();
      else if (this.phase === "menu") this.goRetry();
    }

    onTap() {
      if (this.phase === "over") this.showCredits();
      else if (this.phase === "credits") this.showMenu();
    }

    clearLayer() {
      this.layer.removeAll(true);
    }

    showCredits() {
      if (this.phase !== "over") return;
      this.phase = "credits";
      if (this.overTimer) this.overTimer.remove(false);
      this.clearLayer();
      this.blocker.setFillStyle(0x120818, 0.15);

      this.creditsOverlay = attachVideoOverlay("assets/credits.mp4", () => this.showMenu());

      const skip = this.add.text(W - 28, 22, "SKIP", {
        fontFamily: "Impact, sans-serif",
        fontSize: "28px",
        color: "#fff8e0",
        stroke: "#123",
        strokeThickness: 5,
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      skip.on("pointerdown", (p) => {
        if (p.event && p.event.stopPropagation) p.event.stopPropagation();
        this.showMenu();
      });
      this.layer.add(skip);
      this.cutTimer = this.time.delayedCall(12500, () => this.showMenu());
    }

    showMenu() {
      if (this.phase === "menu") return;
      this.phase = "menu";
      if (this.cutTimer) this.cutTimer.remove(false);
      if (this.creditsOverlay && this.creditsOverlay.done) this.creditsOverlay.done();
      this.creditsOverlay = null;
      sweepHtmlVideos();
      this.clearLayer();
      this.blocker.setFillStyle(0x120818, 0.55);
      this.drawOverCard(false);

      const retry = this.add.rectangle(W / 2 - 140, 460, 240, 72, 0xc9a227)
        .setStrokeStyle(4, 0xfff1b0)
        .setInteractive({ useHandCursor: true });
      const retryTxt = this.add.text(W / 2 - 140, 460, "RETRY", {
        fontFamily: "Impact, sans-serif",
        fontSize: "36px",
        color: "#1a1208",
      }).setOrigin(0.5);
      const title = this.add.rectangle(W / 2 + 140, 460, 240, 72, 0x3a2a62)
        .setStrokeStyle(4, 0xfff1b0)
        .setInteractive({ useHandCursor: true });
      const titleTxt = this.add.text(W / 2 + 140, 460, "TITLE", {
        fontFamily: "Impact, sans-serif",
        fontSize: "36px",
        color: "#fff8e0",
      }).setOrigin(0.5);
      retry.on("pointerdown", (p) => {
        if (p.event && p.event.stopPropagation) p.event.stopPropagation();
        this.goRetry();
      });
      title.on("pointerdown", (p) => {
        if (p.event && p.event.stopPropagation) p.event.stopPropagation();
        this.goTitle();
      });
      this.layer.add([retry, retryTxt, title, titleTxt]);
    }

    goRetry() {
      if (this.creditsOverlay && this.creditsOverlay.done) this.creditsOverlay.done();
      this.creditsOverlay = null;
      sweepHtmlVideos();
      this.scene.stop("over");
      this.scene.stop("play");
      this.scene.start("play");
    }

    goTitle() {
      if (this.creditsOverlay && this.creditsOverlay.done) this.creditsOverlay.done();
      this.creditsOverlay = null;
      sweepHtmlVideos();
      this.scene.stop("over");
      this.scene.stop("play");
      this.scene.start("title");
    }
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: W,
    height: H,
    backgroundColor: "#120c1c",
    pixelArt: false,
    antialias: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { y: 90 }, fps: 60, debug: false },
    },
    fps: { target: 60, forceSetTimeOut: false },
    scene: [BootScene, IntroScene, TitleScene, PlayScene, OverScene],
    input: { activePointers: 3 },
  });
})();
