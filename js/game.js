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
  const KICK_MAGNET = 150;
  const MAX_TROLLOCS = 4;
  const LIGHTNING_NEED = 0.78;
  const WARDER_NEED = 0.54;
  const KICK_BASE_MS = 340;

  const KEYS = {
    best: "tkdRiley.best",
    last: "tkdRiley.last",
    mute: "tkdRiley.mute",
    learned: "tkdRiley.learned",
    seenIntro: "tkdRiley.seenIntro",
  };

  const TERANGREAL = [
    { id: "shield", label: "Air shield!", ms: 3600 },
    { id: "slow", label: "Slow weave!", ms: 4200 },
    { id: "fire", label: "Fire kick!", ms: 6200 },
    { id: "hop", label: "Folded air!", ms: 5000 },
    { id: "heal", label: "Second chance!", ms: 0 },
  ];

  const JOKES = [
    "The Wheel weaves as he kicks.",
    "Trollocs hate homework and high kicks.",
    "Saidin first. Then lightning.",
    "A Warder is just a very serious spotter.",
    "Ter'angreal: shake well before kicking.",
    "Angreal: for when one kick is not enough.",
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
      if (kind === "kick") {
        osc.type = "square";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.15);
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
      this.load.image("rileyKick", "assets/riley-kick.png");
      this.load.image("rileyTitle", "assets/riley-title.png");
      this.load.image("trolloc", "assets/trolloc.png");
      this.load.image("eye", "assets/eye-of-world.png");
      this.load.image("terangreal", "assets/terangreal.png");
      this.load.image("angreal", "assets/angreal.png");
      this.load.image("warder", "assets/warder.png");
      this.load.image("fade", "assets/fade.png");
      this.load.image("slash", "assets/kick-slash.png");
      this.load.image("waygate", "assets/waygate.png");
      this.load.image("bg", "assets/bg.jpg");
      this.load.image("bgFar", "assets/bg-far.jpg");
      this.load.image("bgRail", "assets/bg-rail.jpg");
      this.load.image("intro1", "assets/intro-1.jpg");
      this.load.image("intro2", "assets/intro-2.jpg");
      this.load.image("intro3", "assets/intro-3.jpg");
      this.load.image("creditsBg", "assets/credits-bg.jpg");
      this.load.video("intro", "assets/intro.mp4");
      this.load.video("credits", "assets/credits.mp4");
      this.load.on("loaderror", (file) => {
        console.warn("optional asset missed", file && file.key);
      });
    }
    create() {
      ["rileyIdle", "rileyKick", "rileyTitle", "trolloc", "eye", "terangreal", "angreal", "warder", "fade", "slash", "waygate"]
        .forEach((key) => chromaKeyTexture(this, key));
      this.scene.start(seenIntro() ? "title" : "intro");
    }
  }

  function stopVideo(vid) {
    if (!vid) return;
    try { vid.stop(); } catch (_err) { /* ignore */ }
    try { vid.destroy(); } catch (_err) { /* ignore */ }
  }

  function sweepHtmlVideos() {
    document.querySelectorAll("#game video, video").forEach((el) => {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
        if (el.parentNode) el.parentNode.removeChild(el);
      } catch (_err) { /* ignore */ }
    });
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
      this.vid = null;
      sweepHtmlVideos();
      this.add.rectangle(W / 2, H / 2, W, H, 0x0b1020);
      let played = false;
      if (this.cache.video && this.cache.video.exists(this.videoKey)) {
        try {
          this.vid = this.add.video(W / 2, H / 2, this.videoKey);
          this.vid.setDisplaySize(W, H);
          this.vid.setMute(true);
          this.vid.play(false);
          this.vid.once("complete", () => this.finish());
          this.time.delayedCall(14000, () => this.finish());
          played = true;
        } catch (_err) {
          played = false;
        }
      }
      if (!played) this.slideshow();

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
      stopVideo(this.vid);
      this.vid = null;
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

      this.add.text(820, 236, "Tap to kick. Scatter the Trollocs. Gather the One Power.", {
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
      this.saidin = 0.22;
      this.saidar = 0.18;
      this.distance = 0;
      this.score = 0;
      this.kickCount = 0;
      this.trollocsDown = 0;
      this.holdBoost = false;
      this.kicking = false;
      this.kickUntil = 0;
      this.dive = false;
      this.scroll = 86;
      this.pointerDownAt = 0;
      this.swipeStart = null;
      this.jetSfx = 0;
      this.runMs = 0;
      this.didTap = false;
      this.didKickEnemy = false;
      this.freeHitUsed = false;
      this.invuln = 0;
      this.gateWarned = false;
      this.gateWarnUntil = 0;
      this.shownPowerPrompt = false;
      this.shownTrollocPrompt = false;
      this.showTutorial = !hasLearned();
      this.foodLane = 0;
      this.kickSpeed = 1;
      this.fireKick = 0;
      this.slowWeave = 0;
      this.hopBoost = 0;
      this.shieldMs = 0;
      this.warderOn = false;
      this.warderKickAt = 0;
      this.lightningFlash = 0;
      this.lightningArmed = false;

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

      this.riley = this.physics.add.image(RILEY_X, 350, "rileyIdle");
      this.riley.body.allowGravity = true;
      this.riley.setMaxVelocity(0, 380);
      this.riley.setDepth(8);
      this.physics.world.setBounds(0, 0, W, H);
      this.physics.world.gravity.y = 90;
      window.TkdRiley = { play: this };

      this.warder = this.add.image(RILEY_X - 110, 360, "warder").setScale(0.52).setDepth(7).setAlpha(0);
      this.warderKickPose = false;

      this.physics.add.overlap(this.riley, this.trollocs, this.onTrolloc, null, this);
      this.physics.add.overlap(this.riley, this.hazards, this.onHazard, null, this);
      this.physics.add.overlap(this.riley, this.pickups, this.onPickup, null, this);
      this.physics.add.overlap(this.riley, this.gates, this.onGate, null, this);

      this.scoreText = this.add.text(28, 18, "Score 0", {
        fontFamily: "Impact, Trebuchet MS, sans-serif",
        fontSize: "40px",
        color: "#fff8dc",
        stroke: "#123",
        strokeThickness: 6,
      }).setDepth(20);

      this.meterBack = this.add.rectangle(W / 2, 42, 520, 40, 0x173246).setStrokeStyle(4, 0xfff1b0).setDepth(20);
      this.meterFill = this.add.rectangle(W / 2 - 252, 42, 504, 28, 0x6ec8ff).setOrigin(0, 0.5).setDepth(21);
      this.meterLabel = this.add.text(W / 2, 42, "SAIDIN", {
        fontFamily: "Impact, sans-serif",
        fontSize: "26px",
        color: "#14301c",
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
        this.kick();
      });
      this.input.keyboard.on("keyup-SPACE", () => {
        this.spaceHeld = false;
        this.holdBoost = false;
      });
      this.input.keyboard.on("keydown-S", () => this.doDive());
      this.input.keyboard.on("keydown-DOWN", () => this.doDive());

      this.input.on("pointerdown", (p) => {
        if (this.dead) return;
        if (p.y < 80 && p.x > W - 100) return;
        this.pointerDownAt = this.time.now;
        this.swipeStart = { x: p.x, y: p.y, t: this.time.now };
        this.holdBoost = true;
        this.kick();
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
    }

    startTapTutorial() {
      this.prompt.setText("TAP TO KICK").setAlpha(1);
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
        if (this.prompt.text === "TAP TO KICK") this.fadePrompt();
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
      if (this.runMs < TUTORIAL_MS && text !== "TAP TO KICK") {
        this.time.delayedCall(TUTORIAL_MS - this.runMs + 80, () => this.flashPrompt(text, holdMs));
        return;
      }
      if (text !== "TAP TO KICK") {
        this.tweens.add({
          targets: this.finger,
          alpha: 0,
          duration: 240,
          onComplete: () => this.fingerTween.pause(),
        });
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

    power() {
      return (this.saidin + this.saidar) * 0.5;
    }

    kickDuration() {
      const fire = this.fireKick > 0 ? 1.25 : 1;
      return KICK_BASE_MS * this.kickSpeed * fire;
    }

    kick() {
      if (this.dead) return;
      this.didTap = true;
      this.maybeLearn();
      if (this.lightningArmed || this.saidin >= LIGHTNING_NEED) {
        this.castLightning();
      }
      const hop = this.hopBoost > 0 ? 1.28 : 1;
      this.riley.setVelocityY(-270 * hop);
      this.kicking = true;
      this.kickUntil = this.time.now + this.kickDuration();
      this.kickCount += 1;
      this.kickSlash();
      AudioKit.beep("kick");
    }

    holdJet(dt) {
      if (this.dead) return;
      if (this.time.now - this.pointerDownAt < HOLD_JET_MS) return;
      const hop = this.hopBoost > 0 ? 1.2 : 1;
      this.riley.setVelocityY(this.riley.body.velocity.y - 980 * hop * (dt / 1000));
      this.jetSfx -= dt;
      if (this.jetSfx <= 0) {
        AudioKit.beep("jet");
        this.jetSfx = 90;
      }
    }

    doDive() {
      if (this.dead) return;
      this.riley.setVelocityY(Math.max(this.riley.body.velocity.y, 0) + 280);
      this.dive = true;
      this.kicking = true;
      this.kickUntil = Math.max(this.kickUntil, this.time.now + 220);
      this.time.delayedCall(180, () => { this.dive = false; });
    }

    addSaidin(n) {
      this.saidin = Math.min(1, this.saidin + n);
    }

    addSaidar(n) {
      this.saidar = Math.min(1, this.saidar + n);
    }

    maybeLearn() {
      if (this.didTap && this.didKickEnemy) markLearned();
    }

    kickSlash() {
      const slash = this.add.image(this.riley.x + 120, this.riley.y + 10, "slash")
        .setScale(this.fireKick > 0 ? 1.15 : 0.82)
        .setAlpha(0.92)
        .setDepth(9)
        .setTint(this.fireKick > 0 ? 0xff8844 : 0xfff1b0);
      this.tweens.add({
        targets: slash,
        x: slash.x + 90,
        alpha: 0,
        scale: 1.25,
        duration: 280,
        onComplete: () => slash.destroy(),
      });
    }

    castLightning() {
      this.lightningArmed = false;
      this.lightningFlash = 420;
      this.saidin = Math.max(0.16, this.saidin - 0.62);
      this.saidar = Math.max(0.12, this.saidar - 0.18);
      AudioKit.beep("lightning");
      this.cameras.main.flash(220, 220, 240, 255);
      this.cameras.main.shake(180, 0.006);
      this.flashWarn("Callandor crackles!", 1600);
      let n = 0;
      const zap = (group) => {
        group.children.iterate((child) => {
          if (!child || !child.active) return;
          n += 1;
          this.drawBolt(this.riley.x + 40, this.riley.y - 20, child.x, child.y);
          child.destroy();
        });
      };
      zap(this.trollocs);
      zap(this.hazards);
      this.trollocsDown += n;
      this.score += n * 40 + 80;
      this.floatLabel(this.riley.x, this.riley.y - 90, `LIGHTNING ×${n}`);
    }

    drawBolt(x1, y1, x2, y2) {
      const g = this.add.graphics().setDepth(18);
      g.lineStyle(4, 0xfff6b0, 1);
      g.beginPath();
      g.moveTo(x1, y1);
      const steps = 6;
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        g.lineTo(
          x1 + (x2 - x1) * t + Phaser.Math.Between(-18, 18),
          y1 + (y2 - y1) * t + Phaser.Math.Between(-12, 12),
        );
      }
      g.strokePath();
      this.tweens.add({
        targets: g,
        alpha: 0,
        duration: 280,
        onComplete: () => g.destroy(),
      });
    }

    spawnWave() {
      if (this.dead) return;
      const safe = this.runMs < SAFE_MS;
      const y = this.nextLaneY();
      const trollN = this.trollocs.countActive(true);

      if (safe) {
        if (trollN < MAX_TROLLOCS) this.spawnTrolloc(y);
        return;
      }

      const roll = Math.random();
      if (roll < 0.58) {
        if (trollN < MAX_TROLLOCS) this.spawnTrolloc(y);
      } else if (roll < 0.7) {
        this.spawnItem(this.pickups, "eye", y, 0.92, { hit: 1.05 });
        this.maybePowerPrompt();
      } else if (roll < 0.8) {
        this.spawnItem(this.pickups, "terangreal", Phaser.Math.Between(220, 480), 0.88, { hit: 1.05 });
        this.maybePowerPrompt();
      } else if (roll < 0.88) {
        this.spawnItem(this.pickups, "angreal", Phaser.Math.Between(220, 480), 0.9, { hit: 1.05 });
        this.maybePowerPrompt();
      } else if (roll < 0.94) {
        this.spawnItem(this.hazards, "fade", Phaser.Math.Between(200, 460), 0.72, { hit: 0.42 });
      } else {
        this.spawnItem(this.gates, "waygate", Phaser.Math.Between(280, 470), 0.7, { hit: 0.36 });
      }
    }

    nextLaneY() {
      this.foodLane = (this.foodLane + 1) % 5;
      const lanes = [250, 340, 420, 300, 480];
      return Phaser.Math.Clamp(lanes[this.foodLane] + Phaser.Math.Between(-24, 24), 170, 560);
    }

    spawnTrolloc(y) {
      const item = this.spawnItem(this.trollocs, "trolloc", y, 0.78, { hit: 0.72 });
      if (this.showTutorial && !this.shownTrollocPrompt) {
        this.shownTrollocPrompt = true;
        this.flashPrompt("KICK THE TROLLOCS", 2600);
      }
      return item;
    }

    maybePowerPrompt() {
      if (this.showTutorial && !this.shownPowerPrompt) {
        this.shownPowerPrompt = true;
        this.flashPrompt("GRAB THE ONE POWER", 2600);
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

    canStrike() {
      return this.kicking || this.lightningFlash > 0 || this.warderKickPose;
    }

    onTrolloc(_riley, item) {
      if (this.canStrike()) {
        this.defeatEnemy(item, 50, "KIAI!");
        return;
      }
      this.takeHit(item, "A Trolloc wanted a hug. Riley offered a forehead.");
    }

    onHazard(_riley, item) {
      if (this.canStrike() && this.kicking) {
        this.defeatEnemy(item, 90, "Fade down!");
        return;
      }
      this.takeHit(item, "The Fade asked for silence. Riley answered with a kick… almost.");
    }

    defeatEnemy(item, points, label) {
      item.destroy();
      this.trollocsDown += 1;
      this.score += points;
      this.addSaidin(0.035);
      this.didKickEnemy = true;
      this.maybeLearn();
      AudioKit.beep("hit");
      this.floatLabel(this.riley.x, this.riley.y - 70, label);
    }

    takeHit(item, reason) {
      if (this.invuln > 0 || this.shieldMs > 0) {
        if (item && item.active) item.destroy();
        return;
      }
      if (item && item.active) item.destroy();
      if (!this.freeHitUsed) {
        this.freeHitUsed = true;
        this.invuln = 1400;
        this.riley.setVelocityY(-180);
        this.riley.x = Math.max(180, this.riley.x - 36);
        this.floatLabel(this.riley.x, this.riley.y - 60, "oof");
        this.flashWarn("oof — still kicking!", 1600);
        this.cameras.main.flash(180, 255, 230, 180);
        AudioKit.beep("oof");
        return;
      }
      this.die(reason);
    }

    onPickup(_riley, item) {
      const kind = item.getData("kind");
      item.destroy();
      AudioKit.beep("power");
      if (kind === "eye") {
        this.addSaidin(0.3);
        this.addSaidar(0.3);
        this.score += 80;
        this.floatLabel(this.riley.x, this.riley.y - 80, "Eye of the World!");
        this.flashWarn("Pure saidin and saidar!", 1800);
      } else if (kind === "angreal") {
        this.kickSpeed = Math.min(2.15, this.kickSpeed + 0.22);
        this.addSaidin(0.08);
        this.score += 60;
        this.floatLabel(this.riley.x, this.riley.y - 80, "Angreal — faster kicks!");
      } else if (kind === "terangreal") {
        this.score += 55;
        this.addSaidar(0.1);
        this.rollTerangreal();
      }
    }

    rollTerangreal() {
      const pick = Phaser.Utils.Array.GetRandom(TERANGREAL);
      this.floatLabel(this.riley.x, this.riley.y - 80, pick.label);
      if (pick.id === "shield") {
        this.shieldMs = pick.ms;
        this.invuln = Math.max(this.invuln, pick.ms);
        this.flashWarn("Air shield holds!", 1600);
      } else if (pick.id === "slow") {
        this.slowWeave = pick.ms;
        this.flashWarn("The Pattern slows…", 1600);
      } else if (pick.id === "fire") {
        this.fireKick = pick.ms;
        this.flashWarn("Kicks burn brighter!", 1600);
      } else if (pick.id === "hop") {
        this.hopBoost = pick.ms;
        this.flashWarn("Folded air underfoot!", 1600);
      } else if (pick.id === "heal") {
        this.freeHitUsed = false;
        this.flashWarn("The Power mends a bruise.", 1600);
      }
    }

    onGate(_riley, item) {
      if (this.saidin >= 0.38) {
        this.gateWarned = false;
        return;
      }
      const now = this.time.now;
      if (!this.gateWarned) {
        this.gateWarned = true;
        this.gateWarnUntil = now + WAYGATE_WARN_MS;
        this.bounceGate(item);
        this.flashWarn("Too little of the Power — gather saidin!", 1600);
        return;
      }
      if (now < this.gateWarnUntil) return;
      this.die("The Waygate wanted more of the One Power than Riley had on hand.");
    }

    bounceGate(item) {
      this.riley.setVelocityY(-80);
      this.riley.x = Math.max(170, this.riley.x - 48);
      if (item && item.body) item.setVelocityX(-(this.scroll + 8));
      AudioKit.beep("oof");
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

    applyRileyLook() {
      const key = this.kicking ? "rileyKick" : "rileyIdle";
      if (this.riley.texture.key !== key) this.riley.setTexture(key);
      let sx = key === "rileyKick" ? 0.62 : 0.7;
      let sy = key === "rileyKick" ? 0.62 : 0.7;
      if (this.dive) sy *= 0.86;
      if (this.fireKick > 0) {
        sx *= 1.06;
        sy *= 1.06;
      }
      this.riley.setScale(sx, sy);
      const bw = key === "rileyKick" ? 110 : 88;
      const bh = 110;
      this.riley.body.setSize(bw, bh);
      this.riley.body.setOffset((this.riley.width - bw) / 2, (this.riley.height - bh) / 2);

      const ready = this.saidin >= LIGHTNING_NEED;
      this.lightningArmed = ready;
      this.meterFill.width = 504 * Math.max(0.04, Phaser.Math.Clamp(this.saidin, 0, 1));
      this.meterFill.setFillStyle(ready ? 0xffe27a : this.saidin < 0.25 ? 0x7aa0c8 : 0x6ec8ff);
      this.meterLabel.setText(ready ? "LIGHTNING READY" : "SAIDIN");

      if (this.power() >= WARDER_NEED && !this.warderOn) {
        this.warderOn = true;
        this.flashWarn("A Warder joins the kick!", 1800);
        this.tweens.add({ targets: this.warder, alpha: 1, duration: 400 });
      }
      if (this.power() < WARDER_NEED - 0.12 && this.warderOn) {
        this.warderOn = false;
        this.tweens.add({ targets: this.warder, alpha: 0, duration: 300 });
      }
    }

    magnetKicks(dt) {
      if (!this.kicking) return;
      const range = KICK_MAGNET * (this.fireKick > 0 ? 1.25 : 1);
      this.trollocs.children.iterate((foe) => {
        if (!foe || !foe.active) return;
        const dx = (this.riley.x + 70) - foe.x;
        const dy = this.riley.y - foe.y;
        const dist = Math.hypot(dx, dy);
        if (dist < range && dist > 8) {
          const pull = ((range - dist) / range) * 240 * (dt / 1000);
          foe.x += (dx / dist) * pull;
          foe.y += (dy / dist) * pull;
        }
      });
    }

    tickWarder() {
      const targetX = this.riley.x - 108;
      const targetY = this.riley.y + 8;
      this.warder.x += (targetX - this.warder.x) * 0.18;
      this.warder.y += (targetY - this.warder.y) * 0.18;
      if (!this.warderOn) return;
      if (this.time.now < this.warderKickAt) return;
      this.warderKickAt = this.time.now + Math.max(260, 420 / this.kickSpeed);
      let best = null;
      let bestD = 190;
      this.trollocs.children.iterate((foe) => {
        if (!foe || !foe.active) return;
        const d = Math.hypot(foe.x - this.warder.x, foe.y - this.warder.y);
        if (d < bestD) {
          best = foe;
          bestD = d;
        }
      });
      if (best) {
        this.warderKickPose = true;
        this.defeatEnemy(best, 40, "Warder!");
        this.time.delayedCall(140, () => { this.warderKickPose = false; });
      }
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
      this.fireKick = Math.max(0, this.fireKick - dt);
      this.slowWeave = Math.max(0, this.slowWeave - dt);
      this.hopBoost = Math.max(0, this.hopBoost - dt);
      this.shieldMs = Math.max(0, this.shieldMs - dt);
      this.lightningFlash = Math.max(0, this.lightningFlash - dt);

      if (this.time.now >= this.kickUntil) this.kicking = false;

      const spaceDown = this.cursors.space.isDown;
      if (spaceDown) this.holdBoost = true;
      if (spaceDown || this.holdBoost) this.holdJet(dt);

      if (this.saidin >= 0.38) this.gateWarned = false;
      if (this.gateWarned && this.time.now >= this.gateWarnUntil && this.saidin < 0.38) {
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
      const slow = this.slowWeave > 0 ? 0.58 : 1;
      this.scroll = (86 + ramp) * slow;
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

      this.magnetKicks(dt);
      this.tickWarder();
      this.softBounds();
      this.applyRileyLook();
      this.sweep(this.trollocs);
      this.sweep(this.hazards);
      this.sweep(this.pickups);
      this.sweep(this.gates);

      if (this.invuln > 0 || this.shieldMs > 0) this.riley.setAlpha(0.55 + 0.45 * Math.sin(this.runMs / 40));
      else this.riley.setAlpha(1);

      this.scoreText.setText(`Score ${Math.floor(this.score)}`);
      this.syncScrollVelocities();
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
        if (child && child.x < -180) child.destroy();
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
        kicks: this.kickCount,
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
      this.overTimer = this.time.delayedCall(1600, () => this.showCredits());
      this.input.keyboard.on("keydown-SPACE", this.onSpace, this);
      this.input.keyboard.on("keydown-ENTER", this.onSpace, this);
      this.input.on("pointerdown", this.onTap, this);
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

      let played = false;
      this.creditsVid = null;
      if (this.cache.video && this.cache.video.exists("credits")) {
        try {
          this.creditsVid = this.add.video(W / 2, H / 2, "credits");
          this.creditsVid.setDisplaySize(W, H);
          this.creditsVid.setMute(true);
          this.creditsVid.play(false);
          this.creditsVid.once("complete", () => this.showMenu());
          this.layer.add(this.creditsVid);
          played = true;
        } catch (_err) {
          played = false;
        }
      }
      if (!played) {
        if (this.textures.exists("creditsBg")) {
          this.layer.add(this.add.image(W / 2, H / 2, "creditsBg").setDisplaySize(W, H));
        }
        const names = this.add.text(W / 2, H + 20, [
          "TAE KWON DOE RILEY",
          "",
          "Starring Riley",
          "Trollocs of the Blight",
          "A Warder with excellent timing",
          "Saidin  ·  Saidar",
          "The Eye of the World",
          "",
          "The Wheel weaves as he kicks.",
          "Thanks for playing.",
        ].join("\n"), {
          fontFamily: "Georgia, serif",
          fontSize: "32px",
          color: "#fff4c8",
          align: "center",
          lineSpacing: 10,
        }).setOrigin(0.5, 0);
        this.layer.add(names);
        this.tweens.add({
          targets: names,
          y: -420,
          duration: 9000,
          ease: "Linear",
        });
      }

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
      stopVideo(this.creditsVid);
      this.creditsVid = null;
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
      stopVideo(this.creditsVid);
      this.creditsVid = null;
      sweepHtmlVideos();
      this.scene.stop("over");
      this.scene.stop("play");
      this.scene.start("play");
    }

    goTitle() {
      stopVideo(this.creditsVid);
      this.creditsVid = null;
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
