(() => {
  "use strict";

  const W = 1280;
  const H = 720;
  const LANCE_X = 300;
  const FLOOR_Y = 508;
  const CEIL_Y = 168;
  const SAFE_MS = 9000;
  const HOLD_JET_MS = 220;
  const DOOR_WARN_MS = 1500;
  const PANCAKE_LOSE_MS = 2500;
  const TUTORIAL_MS = 6200;
  const FOOD_MAGNET = 128;
  const MAX_FOOD = 4;
  const PUFFY = 0.88;
  const FROYO_DRAIN = 0.4;
  const FROYO_EMPTY = 0.28;

  const KEYS = {
    best: "whaleLance.best",
    last: "whaleLance.last",
    mute: "whaleLance.mute",
    learned: "whaleLance.learned",
  };

  const FOOD = {
    spaghetti: { inflate: 0.14, score: 50, bonus: true },
    poi: { inflate: 0.08, score: 22 },
    musubi: { inflate: 0.09, score: 24 },
    pineapple: { inflate: 0.07, score: 18 },
    chocolate: { inflate: 0.15, score: 28, overfill: true },
    froyo: { drain: FROYO_DRAIN, score: 0, trap: true },
  };

  const JOKES = [
    "He's not late. He's buffet-paced.",
    "Whale Lance: professionally snack-loaded.",
    "One more plate. For science.",
    "The lei stayed home. The towel did not.",
    "Aim away from the omelet station, pops.",
    "Frozen yogurt is not a protein, pops.",
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

  function isMagenta(r, g, b, a = 255) {
    if (a < 8) return true;
    const mag = r > 200 && b > 200 && g < 90 && (r + b) > g * 4;
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

  function makeFroyoCup(scene) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xf4c4c8, 1);
    g.fillRoundedRect(36, 118, 128, 150, 18);
    g.lineStyle(6, 0x3a1a16, 1);
    g.strokeRoundedRect(36, 118, 128, 150, 18);
    g.fillStyle(0xfff6ea, 1);
    g.fillEllipse(100, 118, 132, 36);
    g.fillStyle(0xffe6ee, 1);
    g.fillCircle(78, 78, 38);
    g.fillStyle(0xfff8f2, 1);
    g.fillCircle(108, 58, 34);
    g.fillStyle(0xf7d0d8, 1);
    g.fillCircle(130, 86, 28);
    g.fillStyle(0x6aa34a, 1);
    g.fillCircle(148, 176, 22);
    g.generateTexture("froyo", 200, 280);
    g.destroy();
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
      if (kind === "toot") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.exponentialRampToValueAtTime(46, now + 0.16);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (kind === "jet") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(70, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.08);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (kind === "eat") {
        osc.type = "square";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.1);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.13);
      } else if (kind === "stud") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.16);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (kind === "oof") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.16);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (kind === "bleh") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(210, now);
        osc.frequency.exponentialRampToValueAtTime(64, now + 0.28);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.32);
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
      const bar = this.add.rectangle(W / 2, H / 2, 360, 18, 0x1b6b8a);
      const fill = this.add.rectangle(W / 2 - 178, H / 2, 4, 12, 0xffe27a).setOrigin(0, 0.5);
      this.add.text(W / 2, H / 2 - 46, "Warming up the buffet…", {
        fontFamily: "Georgia, serif",
        fontSize: "28px",
        color: "#fff6d8",
      }).setOrigin(0.5);
      this.load.on("progress", (p) => {
        fill.width = 356 * p;
      });

      this.load.image("titleLance", "assets/title.png");
      this.load.image("idleInflated", "assets/idle-inflated.png");
      this.load.image("idleDeflated", "assets/idle-deflated.png");
      this.load.image("eatLance", "assets/eat.png");
      this.load.image("fartBlast", "assets/fart-blast.png");
      this.load.image("spaghetti", "assets/spaghetti.png");
      this.load.image("poi", "assets/poi.png");
      this.load.image("musubi", "assets/musubi.png");
      this.load.image("pineapple", "assets/pineapple.png");
      this.load.image("chocolate", "assets/chocolate.png");
      this.load.image("froyo", "assets/froyo.png");
      this.load.image("froyoSrc", "art/sprites/froyo.png");
      this.load.image("gym", "assets/gym.png");
      this.load.image("door", "assets/door.png");
      this.load.image("cloud", "assets/cloud.png");
      this.load.image("stud", "assets/stud.png");
      this.load.image("seagull", "assets/seagull.png");
      this.load.image("sign", "assets/sign.png");
      this.load.image("cutsceneGym", "assets/cutscene-gym.png");
      this.load.image("cutsceneGymSrc", "art/sprites/cutscene-gym.png");
      this.load.image("bg", "assets/bg.jpg");
      this.load.image("bgFar", "assets/bg-far.jpg");
      this.load.image("bgRail", "assets/bg-rail.png");
    }
    create() {
      const froyoKey = this.textures.exists("froyo") ? "froyo" : (this.textures.exists("froyoSrc") ? "froyoSrc" : null);
      if (froyoKey) {
        chromaKeyTexture(this, froyoKey);
        if (froyoKey !== "froyo") this.cloneTexture(froyoKey, "froyo");
      } else {
        makeFroyoCup(this);
      }
      if (!this.textures.exists("cutsceneGym") && this.textures.exists("cutsceneGymSrc")) {
        this.cloneTexture("cutsceneGymSrc", "cutsceneGym");
      }
      this.scene.start("title");
    }
    cloneTexture(fromKey, toKey) {
      const img = this.textures.get(fromKey).getSourceImage();
      if (!img) return;
      if (img instanceof HTMLCanvasElement) this.textures.addCanvas(toKey, img);
      else this.textures.addImage(toKey, img);
    }
  }

  class TitleScene extends Phaser.Scene {
    constructor() {
      super("title");
    }
    create() {
      this.drawBackdrop();
      const lance = this.add.image(340, 400, "titleLance").setScale(0.72);
      this.tweens.add({
        targets: lance,
        y: 388,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });

      this.add.text(820, 108, "WHALE LANCE", {
        fontFamily: "Georgia, Impact, serif",
        fontSize: "76px",
        color: "#fff4c8",
        stroke: "#8b1e2d",
        strokeThickness: 8,
      }).setOrigin(0.5);

      this.add.text(820, 198, "Tap to hop. Eat the buffet. Skip the frozen yogurt.", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "26px",
        color: "#fff6d0",
        align: "center",
        wordWrap: { width: 560 },
      }).setOrigin(0.5);

      const { best, last } = loadScores();
      const lastLine = last
        ? `Last ${last.score}`
        : "Last —";
      this.add.text(820, 268, `Best ${best}   ·   ${lastLine}`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "24px",
        color: "#e8f6ff",
      }).setOrigin(0.5);

      this.add.text(820, 318, Phaser.Utils.Array.GetRandom(JOKES), {
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
      this.add.image(W / 2, H / 2, "bg").setDisplaySize(W, H).setAlpha(0.85);
      this.add.rectangle(W / 2, H / 2, W, H, 0x04283c, 0.28);
    }

    makeButton(x, y, label, onClick, bw = 260, bh = 72, fontSize = 40) {
      const bg = this.add.rectangle(x, y, bw, bh, 0xe31c3d, 1)
        .setStrokeStyle(5, 0xfff1b0)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(x, y, label, {
        fontFamily: "Impact, Georgia, serif",
        fontSize: `${fontSize}px`,
        color: "#fff8e0",
      }).setOrigin(0.5);
      bg.on("pointerover", () => bg.setFillStyle(0xff4b62));
      bg.on("pointerout", () => bg.setFillStyle(0xe31c3d));
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
      this.dead = false;
      this.fullness = 0.56;
      this.shownPuffyHint = false;
      this.distance = 0;
      this.score = 0;
      this.tootCount = 0;
      this.studs = 0;
      this.holdToot = false;
      this.jetting = false;
      this.eatFlash = 0;
      this.squashFlash = 0;
      this.dive = false;
      this.scroll = 86;
      this.pointerDownAt = 0;
      this.swipeStart = null;
      this.jetSfx = 0;
      this.runMs = 0;
      this.didTap = false;
      this.didEat = false;
      this.freeHitUsed = false;
      this.invuln = 0;
      this.puffyWarned = false;
      this.doorWarnUntil = 0;
      this.emptySince = 0;
      this.froyoEaten = 0;
      this.froyoWobble = 0;
      this.froyoLook = 0;
      this.shownEatPrompt = false;
      this.shownGymPrompt = false;
      this.showTutorial = !hasLearned();
      this.tapPromptUntil = 0;
      this.foodLane = 0;

      this.bgFar1 = this.add.image(0, H / 2, "bgFar").setOrigin(0, 0.5).setDisplaySize(W, H);
      this.bgFar2 = this.add.image(W, H / 2, "bgFar").setOrigin(0, 0.5).setDisplaySize(W, H);
      this.bg1 = this.add.image(0, H / 2, "bg").setOrigin(0, 0.5).setDisplaySize(W, H).setAlpha(0.92);
      this.bg2 = this.add.image(W, H / 2, "bg").setOrigin(0, 0.5).setDisplaySize(W, H).setAlpha(0.92);
      this.rail1 = this.add.image(0, H, "bgRail").setOrigin(0, 1).setDisplaySize(W, 168).setDepth(6);
      this.rail2 = this.add.image(W, H, "bgRail").setOrigin(0, 1).setDisplaySize(W, 168).setDepth(6);

      this.foods = this.physics.add.group();
      this.hazards = this.physics.add.group();
      this.pickups = this.physics.add.group();
      this.doors = this.physics.add.group();

      this.lance = this.physics.add.image(LANCE_X, 350, "idleInflated");
      this.lance.body.allowGravity = true;
      this.lance.setMaxVelocity(0, 380);
      this.lance.setDepth(8);
      this.physics.world.setBounds(0, 0, W, H);
      this.physics.world.gravity.y = 90;
      window.WhaleLance = { play: this };

      this.physics.add.overlap(this.lance, this.foods, this.onFood, null, this);
      this.physics.add.overlap(this.lance, this.hazards, this.onHazard, null, this);
      this.physics.add.overlap(this.lance, this.pickups, this.onStud, null, this);
      this.physics.add.overlap(this.lance, this.doors, this.onDoor, null, this);

      this.scoreText = this.add.text(28, 18, "Score 0", {
        fontFamily: "Impact, Trebuchet MS, sans-serif",
        fontSize: "40px",
        color: "#fff8dc",
        stroke: "#123",
        strokeThickness: 6,
      }).setDepth(20);

      this.meterBack = this.add.rectangle(W / 2, 42, 520, 40, 0x173246).setStrokeStyle(4, 0xfff1b0).setDepth(20);
      this.meterFill = this.add.rectangle(W / 2 - 252, 42, 504, 28, 0x7ad36a).setOrigin(0, 0.5).setDepth(21);
      this.meterLabel = this.add.text(W / 2, 42, "BUFFET FUEL", {
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

      this.finger = this.add.text(LANCE_X + 170, 230, "👆", {
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
        this.hop();
      });
      this.input.keyboard.on("keyup-SPACE", () => {
        this.spaceHeld = false;
        this.holdToot = false;
      });
      this.input.keyboard.on("keydown-S", () => this.doDive());
      this.input.keyboard.on("keydown-DOWN", () => this.doDive());

      this.input.on("pointerdown", (p) => {
        if (this.dead) return;
        if (p.y < 80 && p.x > W - 100) return;
        this.pointerDownAt = this.time.now;
        this.swipeStart = { x: p.x, y: p.y, t: this.time.now };
        this.holdToot = true;
        this.hop();
      });
      this.input.on("pointerup", (p) => {
        this.holdToot = false;
        if (this.swipeStart) {
          const dy = p.y - this.swipeStart.y;
          if (dy > 70) this.doDive();
        }
        this.swipeStart = null;
      });

      this.time.addEvent({ delay: 1250, loop: true, callback: () => this.spawnWave() });
      this.applyLanceLook();
    }

    startTapTutorial() {
      this.tapPromptUntil = this.time.now + TUTORIAL_MS;
      this.prompt.setText("TAP TO HOP").setAlpha(1);
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
        if (this.prompt.text === "TAP TO HOP") this.fadePrompt();
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
      if (this.runMs < TUTORIAL_MS && text !== "TAP TO HOP") {
        this.time.delayedCall(TUTORIAL_MS - this.runMs + 80, () => this.flashPrompt(text, holdMs));
        return;
      }
      if (text !== "TAP TO HOP") {
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

    hop() {
      if (this.dead) return;
      this.didTap = true;
      this.maybeLearn();
      const power = this.fullness < 0.2 ? 0.42 : 1;
      this.lance.setVelocityY(-260 * power);
      this.spendFuel(0.055);
      this.tootCount += 1;
      this.jetting = true;
      this.time.delayedCall(200, () => { if (!this.holdToot) this.jetting = false; });
      this.greenPuff();
      AudioKit.beep("toot");
    }

    holdJet(dt) {
      if (this.dead) return;
      if (this.time.now - this.pointerDownAt < HOLD_JET_MS) return;

      const power = this.fullness < 0.2 ? 0.34 : 1;
      this.lance.setVelocityY(this.lance.body.velocity.y - 980 * power * (dt / 1000));
      this.spendFuel(0.16 * (dt / 1000));
      this.jetting = true;
      this.jetSfx -= dt;
      if (this.jetSfx <= 0) {
        AudioKit.beep("jet");
        this.jetSfx = 90;
        this.greenPuff(0.7);
      }
    }

    doDive() {
      if (this.dead) return;
      this.lance.setVelocityY(Math.max(this.lance.body.velocity.y, 0) + 280);
      this.dive = true;
      this.time.delayedCall(180, () => { this.dive = false; });
    }

    spendFuel(amount) {
      this.fullness = Math.max(0, this.fullness - amount);
    }

    addFuel(amount) {
      this.fullness = Math.min(1.16, this.fullness + amount);
    }

    maybeLearn() {
      if (this.didTap && this.didEat) markLearned();
    }

    greenPuff(scale = 1) {
      const puff = this.add.image(this.lance.x - 96, this.lance.y + 36, "cloud")
        .setScale(0.42 * scale)
        .setAlpha(0.9)
        .setTint(0x7dff6a)
        .setDepth(4);
      this.tweens.add({
        targets: puff,
        x: puff.x - 130,
        alpha: 0,
        scale: 0.85 * scale,
        duration: 400,
        onComplete: () => puff.destroy(),
      });
    }

    spawnWave() {
      if (this.dead) return;
      const safe = this.runMs < SAFE_MS;
      const yFood = this.nextFoodY();
      const foodN = this.foods.countActive(true);

      if (safe) {
        if (foodN < MAX_FOOD) this.spawnFood(yFood, false);
        if (foodN < 2 && Math.random() < 0.25) {
          this.spawnFood(Phaser.Math.Clamp(yFood + Phaser.Math.Between(-80, 80), 190, 500), false);
        }
        return;
      }

      const roll = Math.random();
      if (roll < 0.62) {
        if (foodN < MAX_FOOD) this.spawnFood(yFood, true);
      } else if (roll < 0.7) {
        this.spawnItem(this.pickups, "stud", yFood, 0.42, { hit: 1.05 });
      } else if (roll < 0.8) {
        this.spawnItem(this.doors, "door", Phaser.Math.Between(280, 470), 0.64, { hit: 0.3 });
      } else if (roll < 0.88) {
        const gym = this.spawnItem(this.hazards, "gym", yFood, 0.38, { hit: 0.4 });
        this.maybeGymPrompt(gym);
      } else if (roll < 0.94) {
        this.spawnItem(this.hazards, "seagull", Phaser.Math.Between(140, 230), 0.34, { hit: 0.38 });
      } else {
        this.spawnItem(this.hazards, "sign", Phaser.Math.Between(220, 460), 0.42, { hit: 0.42 });
      }
    }

    nextFoodY() {
      this.foodLane = (this.foodLane + 1) % 5;
      const lanes = [250, 340, 420, 300, 480];
      return Phaser.Math.Clamp(lanes[this.foodLane] + Phaser.Math.Between(-24, 24), 170, 560);
    }

    spawnFood(y, allowFroyo) {
      const r = Math.random();
      let kind;
      if (allowFroyo && r < 0.18) kind = "froyo";
      else if (r < 0.3) kind = "spaghetti";
      else if (r < 0.48) kind = "poi";
      else if (r < 0.66) kind = "musubi";
      else if (r < 0.84) kind = "pineapple";
      else kind = "chocolate";
      const scale = kind === "froyo" ? 0.82 : 0.74;
      const item = this.spawnItem(this.foods, kind, y, scale, { hit: kind === "froyo" ? 1.15 : 1.4 });
      if (this.showTutorial && !this.shownEatPrompt && kind !== "froyo") {
        this.shownEatPrompt = true;
        this.flashPrompt("EAT THE BUFFET", 2600);
      }
      return item;
    }

    maybeGymPrompt(gym) {
      if (this.showTutorial && !this.shownGymPrompt && gym) {
        this.shownGymPrompt = true;
        this.flashPrompt("AVOID THE GYM", 2600);
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

    onFood(lance, item) {
      const kind = item.getData("kind");
      if (kind === "froyo") {
        this.onFroyo(lance, item);
        return;
      }
      const spec = FOOD[kind] || FOOD.poi;
      item.destroy();
      this.addFuel(spec.inflate);
      this.score += spec.score + (spec.bonus ? 20 : 0);
      this.eatFlash = kind === "spaghetti" ? 720 : 520;
      this.jetting = false;
      this.didEat = true;
      this.maybeLearn();
      AudioKit.beep("eat");
      if (spec.overfill) {
        this.squashFlash = 420;
        this.floatLabel(lance.x, lance.y - 70, "Chocolate fountain!");
      } else {
        this.floatLabel(lance.x, lance.y - 70, spec.bonus ? "Fried spaghetti!" : "Yum");
      }
    }

    onFroyo(lance, item) {
      item.destroy();
      const alreadyEmpty = this.fullness <= FROYO_EMPTY;
      this.froyoEaten += 1;
      this.spendFuel(FROYO_DRAIN);
      this.froyoWobble = 900;
      this.froyoLook = 1400;
      this.squashFlash = 640;
      this.eatFlash = 0;
      this.jetting = false;
      this.didEat = true;
      this.maybeLearn();
      this.scroll = Math.max(54, this.scroll * 0.62);
      this.floatLabel(lance.x, lance.y - 70, "Froyo?! Gross.");
      this.flashWarn("Lance hates frozen yogurt!", 2000);
      AudioKit.beep("bleh");
      this.cameras.main.shake(180, 0.004);
      if (this.froyoEaten >= 2) {
        this.die("Two cups of frozen yogurt. The gym just sent a calendar invite.");
        return;
      }
      if (alreadyEmpty || this.fullness <= 0.02) {
        this.die("Pancake whale. Should've skipped the frozen yogurt.");
      }
    }

    onStud(lance, item) {
      item.destroy();
      this.studs += 1;
      this.score += 160;
      AudioKit.beep("stud");
      this.floatLabel(lance.x, lance.y - 80, "STUD +160");
    }

    onHazard(lance, item) {
      if (this.invuln > 0) return;
      const kind = item.getData("kind");
      item.destroy();
      if (!this.freeHitUsed) {
        this.freeHitUsed = true;
        this.invuln = 1400;
        this.lance.setVelocityY(-180);
        this.lance.x = Math.max(180, this.lance.x - 36);
        this.floatLabel(lance.x, lance.y - 60, "oof");
        this.flashWarn("oof — still swimming!", 1600);
        this.cameras.main.flash(180, 255, 230, 180);
        AudioKit.beep("oof");
        return;
      }
      const reasons = {
        gym: "The gym asked for one sit-up. Lance offered a hug instead.",
        seagull: "A seagull wanted leftovers. Lance shared… with his forehead.",
        sign: "The No Farting sign asked nicely. Lance saluted and sat this one out.",
      };
      this.die(reasons[kind] || "Bonk. The buffet will keep a plate warm.");
    }

    onDoor(lance, item) {
      if (this.fullness < PUFFY) {
        this.puffyWarned = false;
        return;
      }
      const now = this.time.now;
      if (!this.puffyWarned) {
        this.puffyWarned = true;
        this.doorWarnUntil = now + DOOR_WARN_MS;
        item.setData("warned", true);
        this.bounceDoor(item);
        this.flashWarn("Too full — toot to shrink!", 1600);
        return;
      }
      if (now < this.doorWarnUntil) return;
      this.die("Too puffy for the cabin door. A polite toot and he'll slip right through.");
    }

    bounceDoor(item) {
      this.lance.setVelocityY(-80);
      this.lance.x = Math.max(170, this.lance.x - 48);
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

    applyLanceLook() {
      const f = Phaser.Math.Clamp(this.fullness, 0, 1.16);
      let key = "idleInflated";
      if (this.froyoLook > 0 || f <= 0.02) key = "idleDeflated";
      else if (this.eatFlash > 0) key = "eatLance";
      else if (this.jetting) key = "fartBlast";
      else if (f < 0.38) key = "idleDeflated";
      if (this.lance.texture.key !== key) this.lance.setTexture(key);

      const t = Phaser.Math.Clamp(f, 0, 1);
      const over = Math.max(0, f - PUFFY);
      let sx;
      let sy;
      if (key === "idleDeflated") {
        sx = 0.58;
        sy = 0.7;
      } else {
        sx = Phaser.Math.Linear(0.46, 0.58, t) + over * 0.22;
        sy = Phaser.Math.Linear(0.46, 0.6, t) + over * 0.18;
      }
      if (this.squashFlash > 0) {
        sx *= this.froyoLook > 0 ? 0.78 : 1.18;
        sy *= this.froyoLook > 0 ? 0.52 : 0.74;
      }
      if (this.froyoWobble > 0) {
        const wob = Math.sin(this.runMs / 40) * 0.06;
        sx *= 1 + wob;
        sy *= 1 - wob;
        this.lance.setAngle(Math.sin(this.runMs / 50) * 8);
      } else {
        this.lance.setAngle(0);
      }
      if (this.dive) sy *= 0.86;
      this.lance.setScale(sx, sy);

      const bw = 88 + t * 46 + over * 36;
      const bh = 64 + t * 58 + over * 28;
      this.lance.body.setSize(bw, bh);
      this.lance.body.setOffset((this.lance.width - bw) / 2, (this.lance.height - bh) / 2);

      const meterT = Phaser.Math.Clamp(f, 0, 1);
      this.meterFill.width = 504 * Math.max(0.04, meterT);
      this.meterFill.setFillStyle(f > PUFFY ? 0xff5b7a : f < 0.2 ? 0xf0d35a : 0x7ad36a);
      this.meterLabel.setText("BUFFET FUEL");
      if (f > PUFFY && !this.shownPuffyHint) {
        this.shownPuffyHint = true;
        this.flashWarn("Too full — toot to shrink!", 2600);
      }
    }

    magnetFoods(dt) {
      this.foods.children.iterate((food) => {
        if (!food || !food.active) return;
        if (food.getData("kind") === "froyo") return;
        const dx = this.lance.x - food.x;
        const dy = this.lance.y - food.y;
        const dist = Math.hypot(dx, dy);
        if (dist < FOOD_MAGNET && dist > 8) {
          const pull = ((FOOD_MAGNET - dist) / FOOD_MAGNET) * 210 * (dt / 1000);
          food.x += (dx / dist) * pull;
          food.y += (dy / dist) * pull;
        }
      });
    }

    softBounds() {
      if (this.lance.y > FLOOR_Y) {
        this.lance.y = FLOOR_Y;
        const vy = this.lance.body.velocity.y;
        this.lance.setVelocityY(vy > 40 ? -vy * 0.3 : Math.min(vy, 0));
      }
      if (this.lance.y < CEIL_Y) {
        this.lance.y = CEIL_Y;
        const vy = this.lance.body.velocity.y;
        this.lance.setVelocityY(vy < -40 ? -vy * 0.3 : Math.max(vy, 0));
      }
      this.lance.x += (LANCE_X - this.lance.x) * 0.08;
      this.lance.setVelocityX(0);
    }

    update(_t, dt) {
      if (this.dead) return;
      this.runMs += dt;
      this.invuln = Math.max(0, this.invuln - dt);
      this.froyoWobble = Math.max(0, this.froyoWobble - dt);
      this.froyoLook = Math.max(0, this.froyoLook - dt);

      const spaceDown = this.cursors.space.isDown;
      if (spaceDown) this.holdToot = true;
      if (spaceDown || this.holdToot) this.holdJet(dt);
      else this.jetting = this.eatFlash > 0 ? this.jetting : false;

      this.eatFlash = Math.max(0, this.eatFlash - dt);
      this.squashFlash = Math.max(0, this.squashFlash - dt);

      if (this.fullness <= 0) {
        if (!this.emptySince) this.emptySince = this.time.now;
        if (this.time.now - this.emptySince >= PANCAKE_LOSE_MS) {
          this.die("Pancake whale. Should've skipped the frozen yogurt.");
          return;
        }
      } else {
        this.emptySince = 0;
      }

      if (this.fullness < PUFFY) this.puffyWarned = false;
      if (this.puffyWarned && this.time.now >= this.doorWarnUntil && this.fullness >= PUFFY) {
        let stuck = false;
        this.doors.children.iterate((door) => {
          if (door && door.active && this.physics.overlap(this.lance, door)) stuck = true;
        });
        if (stuck) {
          this.die("Too puffy for the cabin door. A polite toot and he'll slip right through.");
          return;
        }
      }

      const targetY = 348 + Math.sin(this.runMs / 520) * 22;
      this.lance.body.velocity.y += (targetY - this.lance.y) * 0.055;

      const ramp = Math.min(92, this.runMs / 1000 * 1.15);
      const wobbleSlow = this.froyoWobble > 0 ? 0.72 : 1;
      this.scroll = (86 + ramp) * wobbleSlow;
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

      this.magnetFoods(dt);
      this.softBounds();
      this.applyLanceLook();
      this.sweep(this.foods);
      this.sweep(this.hazards);
      this.sweep(this.pickups);
      this.sweep(this.doors);

      if (this.invuln > 0) this.lance.setAlpha(0.55 + 0.45 * Math.sin(this.runMs / 40));
      else this.lance.setAlpha(1);

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
      setVx(this.foods);
      setVx(this.hazards);
      setVx(this.pickups);
      setVx(this.doors);
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
      this.lance.setVelocity(0, 0);
      this.lance.body.allowGravity = false;
      this.foods.setVelocityX(0);
      this.hazards.setVelocityX(0);
      this.pickups.setVelocityX(0);
      this.doors.setVelocityX(0);

      const prevLast = loadScores().last;
      const run = {
        score: Math.floor(this.score),
        distance: Math.floor(this.distance),
        toots: this.tootCount,
        studs: this.studs,
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
      this.blocker = this.add.rectangle(W / 2, H / 2, W, H, 0x041824, 0.55)
        .setInteractive()
        .setDepth(39);

      const { best } = loadScores();
      const hi = run.score >= best && run.score > 0 ? "  ★ new best!" : "";
      const lastLine = run.prevLast == null ? "Last — first cruise!" : `Last ${run.prevLast}`;

      this.layer.add(this.add.rectangle(W / 2, H / 2, 680, 420, 0x123a52, 0.94).setStrokeStyle(5, 0xffe08a));
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
      this.layer.add(this.add.text(W / 2, 400, `Score ${run.score}${hi}\nBest ${best}\n${lastLine}`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "26px",
        color: "#e8f6ff",
        align: "center",
        lineSpacing: 8,
      }).setOrigin(0.5));

      this.overTimer = this.time.delayedCall(1600, () => this.showCutscene());
      this.input.keyboard.on("keydown-SPACE", this.onSpace, this);
      this.input.keyboard.on("keydown-ENTER", this.onSpace, this);
      this.input.on("pointerdown", this.onTap, this);
    }

    onSpace() {
      if (this.phase === "over") this.showCutscene();
      else if (this.phase === "cutscene") this.showMenu();
      else if (this.phase === "menu") this.goRetry();
    }

    onTap(p) {
      if (this.phase === "over") this.showCutscene();
      else if (this.phase === "cutscene") this.showMenu();
    }

    clearLayer() {
      this.layer.removeAll(true);
    }

    showCutscene() {
      if (this.phase !== "over") return;
      this.phase = "cutscene";
      if (this.overTimer) this.overTimer.remove(false);
      this.clearLayer();
      this.blocker.setFillStyle(0x041824, 0.15);

      if (this.textures.exists("cutsceneGym")) {
        this.layer.add(this.add.image(W / 2, H / 2, "cutsceneGym").setDisplaySize(W, H));
      } else {
        this.composeGymFallback();
      }

      this.layer.add(this.add.rectangle(W / 2, H - 78, W, 156, 0x041018, 0.55));
      this.layer.add(this.add.text(W / 2, H - 104, "Back to the gym, pops.", {
        fontFamily: "Impact, Georgia, serif",
        fontSize: "36px",
        color: "#fff4c8",
        stroke: "#3a1a10",
        strokeThickness: 6,
      }).setOrigin(0.5));
      this.layer.add(this.add.text(W / 2, H - 56, "The froyo is not a protein, Lance.", {
        fontFamily: "Georgia, serif",
        fontSize: "24px",
        fontStyle: "italic",
        color: "#ffe7d0",
      }).setOrigin(0.5));

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

      this.cutTimer = this.time.delayedCall(6500, () => this.showMenu());
    }

    composeGymFallback() {
      this.layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x3d2a22, 1));
      if (this.textures.exists("bg")) {
        this.layer.add(this.add.image(W / 2, H / 2, "bg").setDisplaySize(W, H).setAlpha(0.35));
      }
      if (this.textures.exists("gym")) {
        this.layer.add(this.add.image(210, 520, "gym").setScale(1.15));
        this.layer.add(this.add.image(1080, 500, "gym").setScale(0.9));
      }
      if (this.textures.exists("titleLance")) {
        this.layer.add(this.add.image(430, 390, "titleLance").setScale(0.58));
      }
      const g = this.add.graphics();
      g.fillStyle(0xc68642, 1);
      g.fillCircle(900, 168, 46);
      g.fillStyle(0xd4a574, 1);
      g.fillRoundedRect(820, 210, 160, 220, 20);
      g.fillStyle(0xe8b86a, 1);
      g.fillRoundedRect(760, 230, 70, 160, 24);
      g.fillRoundedRect(970, 230, 70, 160, 24);
      g.fillStyle(0xc23b3b, 1);
      g.fillRoundedRect(836, 214, 128, 90, 12);
      g.fillStyle(0x2b2b2b, 1);
      g.fillRoundedRect(848, 400, 110, 36, 8);
      this.layer.add(g);
    }

    showMenu() {
      if (this.phase === "menu") return;
      this.phase = "menu";
      if (this.cutTimer) this.cutTimer.remove(false);
      this.clearLayer();
      this.blocker.setFillStyle(0x041824, 0.55);

      const { best } = loadScores();
      const run = this.run;
      const hi = run.score >= best && run.score > 0 ? "  ★ new best!" : "";

      this.layer.add(this.add.rectangle(W / 2, H / 2, 680, 420, 0x123a52, 0.94).setStrokeStyle(5, 0xffe08a));
      this.layer.add(this.add.text(W / 2, 210, "GAME OVER", {
        fontFamily: "Impact, Georgia, serif",
        fontSize: "56px",
        color: "#fff2c4",
      }).setOrigin(0.5));
      this.layer.add(this.add.text(W / 2, 286, run.reason, {
        fontFamily: "Georgia, serif",
        fontSize: "22px",
        color: "#ffe7d0",
        align: "center",
        wordWrap: { width: 600 },
      }).setOrigin(0.5));
      this.layer.add(this.add.text(W / 2, 360, `Score ${run.score}${hi}   ·   Best ${best}`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "24px",
        color: "#e8f6ff",
      }).setOrigin(0.5));

      const retry = this.add.rectangle(W / 2 - 140, 460, 240, 72, 0xe31c3d)
        .setStrokeStyle(4, 0xfff1b0)
        .setInteractive({ useHandCursor: true });
      const retryTxt = this.add.text(W / 2 - 140, 460, "RETRY", {
        fontFamily: "Impact, sans-serif",
        fontSize: "36px",
        color: "#fff8e0",
      }).setOrigin(0.5);
      const title = this.add.rectangle(W / 2 + 140, 460, 240, 72, 0x1b6b8a)
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
      this.scene.stop("over");
      this.scene.stop("play");
      this.scene.start("play");
    }

    goTitle() {
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
    backgroundColor: "#0a4d6e",
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
    scene: [BootScene, TitleScene, PlayScene, OverScene],
    input: { activePointers: 3 },
  });
})();
