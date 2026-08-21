(() => {
  "use strict";

  const W = 1280;
  const H = 720;
  const KEYS = {
    best: "whaleLance.best",
    last: "whaleLance.last",
    mute: "whaleLance.mute",
  };

  const FOOD = {
    spaghetti: { inflate: 0.24, score: 40, bonus: true },
    poi: { inflate: 0.12, score: 20 },
    musubi: { inflate: 0.14, score: 24 },
    pineapple: { inflate: 0.1, score: 18 },
    chocolate: { inflate: 0.34, score: 30, overfill: true },
  };

  const JOKES = [
    "He's not late. He's buffet-paced.",
    "Whale Lance: professionally snack-loaded.",
    "One more plate. For science.",
    "The lei stayed home. The towel did not.",
    "Aim away from the omelet station, pops.",
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
      this.load.image("gym", "assets/gym.png");
      this.load.image("door", "assets/door.png");
      this.load.image("cloud", "assets/cloud.png");
      this.load.image("stud", "assets/stud.png");
      this.load.image("seagull", "assets/seagull.png");
      this.load.image("sign", "assets/sign.png");
      this.load.image("bg", "assets/bg.jpg");
    }
    create() {
      this.scene.start("title");
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

      this.add.text(820, 118, "WHALE LANCE", {
        fontFamily: "Georgia, Impact, serif",
        fontSize: "72px",
        color: "#fff4c8",
        stroke: "#8b1e2d",
        strokeThickness: 8,
      }).setOrigin(0.5);

      this.add.text(820, 188, "Eat. Toot. Repeat.\n(Please aim away from the buffet.)", {
        fontFamily: "Georgia, serif",
        fontSize: "24px",
        color: "#ffe7a8",
        align: "center",
        lineSpacing: 6,
      }).setOrigin(0.5);

      const { best, last } = loadScores();
      const lastLine = last
        ? `Last run: ${last.score}  ·  ${last.reason}`
        : "Last run: none yet — the pancakes are waiting.";
      this.add.text(820, 278, `Best: ${best}\n${lastLine}`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "22px",
        color: "#e8f6ff",
        align: "center",
        lineSpacing: 8,
      }).setOrigin(0.5);

      this.add.text(820, 368, "Tap / Space: short toot   ·   Hold: jet   ·   S / swipe down: dive", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "18px",
        color: "#cfefff",
      }).setOrigin(0.5);

      this.add.text(820, 410, Phaser.Utils.Array.GetRandom(JOKES), {
        fontFamily: "Georgia, serif",
        fontSize: "20px",
        fontStyle: "italic",
        color: "#ffd7e8",
      }).setOrigin(0.5);

      this.makeButton(820, 500, "PLAY", () => {
        AudioKit.ensure();
        this.scene.start("play");
      });

      this.addMute(40, 40);
      this.input.keyboard.once("keydown-SPACE", () => this.scene.start("play"));
      this.input.keyboard.once("keydown-ENTER", () => this.scene.start("play"));
    }

    drawBackdrop() {
      this.add.image(W / 2, H / 2, "bg").setDisplaySize(W, H).setAlpha(0.85);
      this.add.rectangle(W / 2, H / 2, W, H, 0x04283c, 0.28);
    }

    makeButton(x, y, label, onClick) {
      const bg = this.add.rectangle(x, y, 260, 72, 0xe31c3d, 1).setStrokeStyle(4, 0xfff1b0).setInteractive({ useHandCursor: true });
      const txt = this.add.text(x, y, label, {
        fontFamily: "Impact, Georgia, serif",
        fontSize: "40px",
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
      this.fullness = 0.68;
      this.distance = 0;
      this.score = 0;
      this.combo = 0;
      this.comboTimer = 0;
      this.tootCount = 0;
      this.studs = 0;
      this.holdToot = false;
      this.jetting = false;
      this.eatFlash = 0;
      this.dive = false;
      this.scroll = 220;
      this.spawnAt = 0;
      this.pointerDownAt = 0;
      this.swipeStart = null;
      this.jetSfx = 0;

      this.bg1 = this.add.image(0, H / 2, "bg").setOrigin(0, 0.5).setDisplaySize(W, H);
      this.bg2 = this.add.image(W, H / 2, "bg").setOrigin(0, 0.5).setDisplaySize(W, H);

      this.foods = this.physics.add.group();
      this.hazards = this.physics.add.group();
      this.pickups = this.physics.add.group();
      this.doors = this.physics.add.group();
      this.puffs = this.add.group();

      this.lance = this.physics.add.image(300, 360, "idleInflated");
      this.lance.setCollideWorldBounds(true);
      this.lance.body.setSize(220, 180);
      this.lance.body.setOffset(200, 220);
      this.lance.setDepth(5);
      this.physics.world.setBounds(40, 70, W - 80, H - 140);
      this.lance.setMaxVelocity(0, 680);
      this.lance.body.allowGravity = true;
      this.physics.world.gravity.y = 760;

      this.physics.add.overlap(this.lance, this.foods, this.onFood, null, this);
      this.physics.add.overlap(this.lance, this.hazards, this.onHazard, null, this);
      this.physics.add.overlap(this.lance, this.pickups, this.onStud, null, this);
      this.physics.add.overlap(this.lance, this.doors, this.onDoor, null, this);

      this.scoreText = this.add.text(24, 16, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "26px",
        color: "#fff8dc",
        stroke: "#123",
        strokeThickness: 4,
      }).setDepth(20);
      this.comboText = this.add.text(24, 50, "", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "20px",
        color: "#ffe27a",
        stroke: "#123",
        strokeThickness: 3,
      }).setDepth(20);
      this.hint = this.add.text(W / 2, H - 28, "Tap or Space to toot  ·  Hold to jet  ·  S / swipe down to dive", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "18px",
        color: "#e8f7ff",
      }).setOrigin(0.5).setDepth(20);

      this.meterBack = this.add.rectangle(W / 2, 36, 360, 22, 0x173246).setStrokeStyle(3, 0xfff1b0).setDepth(20);
      this.meterFill = this.add.rectangle(W / 2 - 176, 36, 352, 14, 0x7ad36a).setOrigin(0, 0.5).setDepth(21);
      this.meterLabel = this.add.text(W / 2, 36, "FART METER", {
        fontFamily: "Impact, sans-serif",
        fontSize: "16px",
        color: "#14301c",
      }).setOrigin(0.5).setDepth(22);

      this.muteBtn = this.add.text(W - 58, 16, isMuted() ? "🔇" : "🔊", { fontSize: "34px" })
        .setInteractive({ useHandCursor: true })
        .setDepth(22);
      this.muteBtn.on("pointerdown", (p) => {
        p.event.stopPropagation();
        setMuted(!isMuted());
        this.muteBtn.setText(isMuted() ? "🔇" : "🔊");
      });

      this.cursors = this.input.keyboard.addKeys({
        space: "SPACE",
        s: "S",
        down: "DOWN",
      });

      this.input.on("pointerdown", (p) => {
        if (p.y < 70 && p.x > W - 90) return;
        this.pointerDownAt = this.time.now;
        this.swipeStart = { x: p.x, y: p.y, t: this.time.now };
        this.holdToot = true;
        this.shortToot();
      });
      this.input.on("pointerup", (p) => {
        this.holdToot = false;
        if (this.swipeStart) {
          const dy = p.y - this.swipeStart.y;
          if (dy > 70) this.doDive();
        }
        this.swipeStart = null;
      });

      this.time.addEvent({ delay: 900, loop: true, callback: () => this.spawnWave() });
      this.applyLanceLook();
    }

    shortToot() {
      if (this.dead) return;
      const power = this.fullness < 0.28 ? 0.45 : 1;
      this.lance.setVelocityY(-420 * power);
      this.deflate(0.075);
      this.tootCount += 1;
      this.combo += 1;
      this.comboTimer = 1400;
      this.score += 12 * this.combo;
      this.jetting = true;
      this.time.delayedCall(220, () => { if (!this.holdToot) this.jetting = false; });
      this.puff();
      AudioKit.beep("toot");
    }

    holdJet(dt) {
      if (this.dead) return;
      const power = this.fullness < 0.28 ? 0.35 : 1;
      this.lance.setVelocityY(this.lance.body.velocity.y - 1680 * power * (dt / 1000));
      this.deflate(0.22 * (dt / 1000));
      this.jetting = true;
      this.jetSfx -= dt;
      if (this.jetSfx <= 0) {
        AudioKit.beep("jet");
        this.jetSfx = 90;
        this.puff();
      }
    }

    doDive() {
      if (this.dead) return;
      this.lance.setVelocityY(Math.max(this.lance.body.velocity.y, 0) + 420);
      this.dive = true;
      this.time.delayedCall(180, () => { this.dive = false; });
    }

    deflate(amount) {
      this.fullness = Math.max(0, this.fullness - amount);
    }

    inflate(amount) {
      this.fullness = Math.min(1.18, this.fullness + amount);
    }

    puff() {
      const puff = this.add.image(this.lance.x - 90, this.lance.y + 30, "cloud")
        .setScale(0.45)
        .setAlpha(0.85)
        .setDepth(4);
      this.puffs.add(puff);
      this.tweens.add({
        targets: puff,
        x: puff.x - 140,
        alpha: 0,
        scale: 0.9,
        duration: 420,
        onComplete: () => puff.destroy(),
      });
    }

    spawnWave() {
      if (this.dead) return;
      const y = Phaser.Math.Between(140, 580);
      const roll = Math.random();
      if (roll < 0.46) {
        const r = Math.random();
        const kind = r < 0.22 ? "spaghetti" : r < 0.42 ? "poi" : r < 0.62 ? "musubi" : r < 0.82 ? "pineapple" : "chocolate";
        this.spawnItem(this.foods, kind, y, 0.42 + Math.random() * 0.12);
      } else if (roll < 0.58) {
        this.spawnItem(this.pickups, "stud", y, 0.38);
      } else if (roll < 0.72) {
        this.spawnItem(this.doors, "door", Phaser.Math.Between(220, 500), 0.7);
      } else if (roll < 0.84) {
        this.spawnItem(this.hazards, "gym", y, 0.5);
      } else if (roll < 0.93) {
        this.spawnItem(this.hazards, "seagull", Phaser.Math.Between(110, 260), 0.46);
      } else {
        this.spawnItem(this.hazards, "sign", y, 0.48);
      }
    }

    spawnItem(group, key, y, scale) {
      const item = group.create(W + 80, y, key);
      item.setScale(scale);
      item.body.allowGravity = false;
      item.setVelocityX(-(this.scroll + 40));
      item.setImmovable(true);
      item.setDepth(3);
      item.setData("kind", key);
      if (key === "door") {
        item.body.setSize(item.width * 0.28, item.height * 0.92);
      }
      return item;
    }

    onFood(lance, item) {
      const kind = item.getData("kind");
      const spec = FOOD[kind] || FOOD.poi;
      item.destroy();
      this.inflate(spec.inflate);
      this.score += spec.score + (spec.bonus ? 20 : 0);
      this.eatFlash = kind === "spaghetti" ? 420 : 220;
      AudioKit.beep("eat");
      this.floatLabel(lance.x, lance.y - 70, spec.overfill ? "Chocolate fountain!" : spec.bonus ? "Fried spaghetti!" : "Yum");
    }

    onStud(lance, item) {
      item.destroy();
      this.studs += 1;
      this.score += 160;
      AudioKit.beep("stud");
      this.floatLabel(lance.x, lance.y - 80, "STUD +160");
    }

    onHazard(lance, item) {
      const kind = item.getData("kind");
      const reasons = {
        gym: "Skipped the gym. The gym did not skip you.",
        seagull: "A seagull filed a complaint.",
        sign: "The No Farting sign won this round.",
      };
      this.die(reasons[kind] || "Bonk.");
    }

    onDoor(lance, item) {
      if (this.fullness >= 0.86) {
        this.die("Too puffy for the cabin door. Maybe skip the fountain.");
      }
    }

    floatLabel(x, y, text) {
      const t = this.add.text(x, y, text, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "22px",
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
      const f = Phaser.Math.Clamp(this.fullness, 0, 1.18);
      let key = "idleInflated";
      if (this.eatFlash > 0) key = "eatLance";
      else if (this.jetting) key = "fartBlast";
      else if (f < 0.42) key = "idleDeflated";
      if (this.lance.texture.key !== key) this.lance.setTexture(key);

      const t = Phaser.Math.Clamp(f / 1.0, 0, 1);
      const sx = Phaser.Math.Linear(1.55, 0.92, t);
      const sy = Phaser.Math.Linear(0.38, 1.08, t);
      const over = Math.max(0, f - 1);
      this.lance.setScale(sx + over * 0.35, sy + over * 0.28);
      if (this.dive) this.lance.scaleY *= 0.86;

      const bw = 160 + t * 80 + over * 70;
      const bh = 70 + t * 150 + over * 40;
      this.lance.body.setSize(bw, bh);
      this.lance.body.setOffset((this.lance.width - bw) / 2, (this.lance.height - bh) / 2);

      const meterT = Phaser.Math.Clamp(f, 0, 1);
      this.meterFill.width = 352 * meterT;
      this.meterFill.setFillStyle(f > 1 ? 0xff5b7a : f < 0.28 ? 0xf0d35a : 0x7ad36a);
    }

    update(_t, dt) {
      if (this.dead) return;

      const spaceDown = this.cursors.space.isDown;
      if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) this.shortToot();
      if (spaceDown || this.holdToot) this.holdJet(dt);
      else this.jetting = this.eatFlash > 0 ? this.jetting : false;
      if (Phaser.Input.Keyboard.JustDown(this.cursors.s) || Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
        this.doDive();
      }

      this.eatFlash = Math.max(0, this.eatFlash - dt);
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;

      this.scroll = 220 + this.distance * 0.012;
      this.distance += (this.scroll * dt) / 1000;
      this.score += dt * 0.02;

      const bgSpeed = this.scroll * 0.35 * (dt / 1000);
      this.bg1.x -= bgSpeed;
      this.bg2.x -= bgSpeed;
      if (this.bg1.x <= -W) this.bg1.x = this.bg2.x + W;
      if (this.bg2.x <= -W) this.bg2.x = this.bg1.x + W;

      this.applyLanceLook();
      this.sweep(this.foods);
      this.sweep(this.hazards);
      this.sweep(this.pickups);
      this.sweep(this.doors);

      this.scoreText.setText(`Score ${Math.floor(this.score)}   ·   ${Math.floor(this.distance)}m`);
      this.comboText.setText(this.combo > 1 ? `Toot combo x${this.combo}` : "");

      if (this.fullness <= 0.02) this.die("Pancake whale. Time for seconds?");
    }

    sweep(group) {
      group.children.iterate((child) => {
        if (child && child.x < -160) child.destroy();
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

      const run = {
        score: Math.floor(this.score),
        distance: Math.floor(this.distance),
        toots: this.tootCount,
        studs: this.studs,
        reason,
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
      this.add.rectangle(W / 2, H / 2, W, H, 0x041824, 0.55).setInteractive();
      const panel = this.add.rectangle(W / 2, H / 2, 640, 460, 0x123a52, 0.94).setStrokeStyle(5, 0xffe08a);
      this.add.text(W / 2, 200, "GAME OVER", {
        fontFamily: "Impact, Georgia, serif",
        fontSize: "56px",
        color: "#fff2c4",
      }).setOrigin(0.5);
      this.add.text(W / 2, 262, run.reason, {
        fontFamily: "Georgia, serif",
        fontSize: "24px",
        color: "#ffe7d0",
        align: "center",
        wordWrap: { width: 560 },
      }).setOrigin(0.5);

      const { best } = loadScores();
      const hi = run.score >= best && run.score > 0 ? "  ★ new best!" : "";
      this.add.text(W / 2, 350, `Score ${run.score}${hi}\nBest ${best}\n${run.distance}m  ·  ${run.toots} toots  ·  ${run.studs} studs`, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "22px",
        color: "#e8f6ff",
        align: "center",
        lineSpacing: 6,
      }).setOrigin(0.5);

      const retry = this.add.rectangle(W / 2 - 130, 470, 220, 64, 0xe31c3d).setStrokeStyle(3, 0xfff1b0).setInteractive({ useHandCursor: true });
      this.add.text(W / 2 - 130, 470, "RETRY", { fontFamily: "Impact, sans-serif", fontSize: "32px", color: "#fff8e0" }).setOrigin(0.5);
      const title = this.add.rectangle(W / 2 + 130, 470, 220, 64, 0x1b6b8a).setStrokeStyle(3, 0xfff1b0).setInteractive({ useHandCursor: true });
      this.add.text(W / 2 + 130, 470, "TITLE", { fontFamily: "Impact, sans-serif", fontSize: "32px", color: "#fff8e0" }).setOrigin(0.5);

      const goRetry = () => {
        this.scene.stop("over");
        this.scene.stop("play");
        this.scene.start("play");
      };
      const goTitle = () => {
        this.scene.stop("over");
        this.scene.stop("play");
        this.scene.start("title");
      };
      retry.on("pointerdown", goRetry);
      title.on("pointerdown", goTitle);
      this.input.keyboard.once("keydown-SPACE", goRetry);
      this.input.keyboard.once("keydown-ENTER", goRetry);
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
      arcade: { gravity: { y: 760 }, fps: 60, debug: false },
    },
    fps: { target: 60, forceSetTimeOut: false },
    scene: [BootScene, TitleScene, PlayScene, OverScene],
    input: { activePointers: 3 },
  });
})();
