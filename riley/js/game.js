(() => {
  "use strict";

  const W = 1280;
  const H = 720;
  const VERSION = "2.1.0";
  const SAFE_MS = 1500;
  const MAX_FOES = 10;
  const START_HP = 3;
  const MAX_HP = 3;
  const PLAYER_BOUNDS = { minX: 125, maxX: 545, minY: 150, maxY: 565 };
  const SHARDS_TO_LEVEL = [0, 3, 4];
  const RAND_MS = 6000;
  const MUSIC_VOLUME = 0.32;
  const MUSIC_DUCKED_VOLUME = 0.105;

  window.TkdRileyVersion = VERSION;

  const WEAPONS = [
    null,
    { name: "FIREBALL", key: "fireball", damage: 1, speed: 640, pierce: 0, scale: 0.5, color: 0xff8a36, cadence: 330 },
    { name: "LIGHTNING", key: "bolt", damage: 2, speed: 800, pierce: 1, scale: 0.56, color: 0x7ed9ff, cadence: 285 },
    { name: "BALEFIRE", key: "balefire", damage: 4, speed: 740, pierce: 3, scale: 0.66, color: 0xffed9e, cadence: 245 },
  ];

  const FOES = {
    trolloc: { hp: 3, score: 70, scale: 0.86, hit: 0.66, amp: 18 },
    brute: { hp: 8, score: 165, scale: 0.92, hit: 0.7, amp: 13 },
    fade: { hp: 6, score: 145, scale: 0.8, hit: 0.43, amp: 38 },
  };

  const MUSIC_KEYS = Array.from({ length: 9 }, (_v, i) => "music" + String(i).padStart(2, "0"));
  const VOICES = {
    vRileyDrag: "assets/audio/voices/riley-drag.mp3",
    vRileyFirstKill: "assets/audio/voices/riley-first-kill.mp3",
    vRileyLightning: "assets/audio/voices/riley-lightning.mp3",
    vRileyBalefire: "assets/audio/voices/riley-balefire.mp3",
    vRileyLow: "assets/audio/voices/riley-low-heart.mp3",
    vRileyDragon: "assets/audio/voices/riley-dragon.mp3",
    vRileyRetry: "assets/audio/voices/riley-retry.mp3",
    vDragonStand: "assets/audio/voices/dragon-stand-ground.mp3",
    vFade: "assets/audio/voices/fade-eyeless.mp3",
  };

  const KEYS = {
    best: "tkdRiley.best",
    last: "tkdRiley.last",
    mute: "tkdRiley.mute",
    learned: "tkdRiley.dragLearned.v2",
    seenIntro: "tkdRiley.seenIntro",
  };

  const JOKES = [
    "Drag the ninja. Let Riley handle the firepower.",
    "The Pattern has tightened. Riley brought balefire.",
    "Trollocs hate two things: homework and accurate fireballs.",
    "Front-facing. Forward-moving. Mildly overpowered.",
    "The Dragon Reborn still does not do homework.",
  ];

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function loadScores() {
    let last = null;
    try {
      last = JSON.parse(localStorage.getItem(KEYS.last) || "null");
    } catch (_err) {
      localStorage.removeItem(KEYS.last);
    }
    return {
      best: safeNumber(localStorage.getItem(KEYS.best), 0),
      last,
    };
  }

  function saveRun(run) {
    try {
      localStorage.setItem(KEYS.last, JSON.stringify(run));
      const best = safeNumber(localStorage.getItem(KEYS.best), 0);
      if (run.score > best) localStorage.setItem(KEYS.best, String(run.score));
    } catch (_err) {
      // Scores are optional. A storage failure must never break the game.
    }
  }

  function isMuted() {
    return localStorage.getItem(KEYS.mute) === "1";
  }

  function setMuted(on) {
    try {
      localStorage.setItem(KEYS.mute, on ? "1" : "0");
    } catch (_err) {
      // Ignore unavailable storage.
    }
  }

  function hasLearned() {
    return localStorage.getItem(KEYS.learned) === "1";
  }

  function markLearned() {
    try {
      localStorage.setItem(KEYS.learned, "1");
    } catch (_err) {
      // Ignore unavailable storage.
    }
  }

  function seenIntro() {
    return localStorage.getItem(KEYS.seenIntro) === "1";
  }

  function markIntro() {
    try {
      localStorage.setItem(KEYS.seenIntro, "1");
    } catch (_err) {
      // Ignore unavailable storage.
    }
  }

  function isMagenta(r, g, b, a = 255) {
    if (a < 8) return true;
    return r > 185 && b > 145 && g < 145 && (r + b) > g * 2.25;
  }

  function chromaKeyTexture(scene, key) {
    if (!scene.textures.exists(key)) return false;
    const texture = scene.textures.get(key);
    const source = texture.getSourceImage();
    if (!source || !source.width) return false;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    let changed = false;
    for (let i = 0; i < data.length; i += 4) {
      if (isMagenta(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        data[i + 3] = 0;
        changed = true;
      }
    }
    if (!changed) return true;
    ctx.putImageData(image, 0, 0);
    scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
    return true;
  }

  const AudioKit = {
    ctx: null,
    master: null,
    lastBeepAt: 0,
    ensure() {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
          this.master = this.ctx.createGain();
          this.master.connect(this.ctx.destination);
        }
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      if (this.ctx && this.master) this.master.gain.setValueAtTime(isMuted() ? 0 : 1, this.ctx.currentTime);
      return this.ctx;
    },
    setMute(on) {
      if (!this.ctx || !this.master) return;
      this.master.gain.setValueAtTime(on ? 0 : 1, this.ctx.currentTime);
    },
    beep(kind) {
      if (isMuted()) return;
      const nowMs = performance.now();
      if (kind === "fire" && nowMs - this.lastBeepAt < 150) return;
      this.lastBeepAt = nowMs;
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.master || ctx.destination);
      const specs = {
        fire: ["sawtooth", 260, 110, 0.045, 0.11],
        lightning: ["sawtooth", 820, 120, 0.07, 0.2],
        balefire: ["triangle", 980, 150, 0.075, 0.24],
        hit: ["triangle", 360, 150, 0.055, 0.1],
        power: ["sine", 430, 900, 0.07, 0.2],
        oof: ["sine", 180, 72, 0.06, 0.17],
        bonk: ["square", 140, 42, 0.075, 0.22],
        block: ["square", 520, 210, 0.05, 0.09],
      };
      const spec = specs[kind] || specs.hit;
      osc.type = spec[0];
      osc.frequency.setValueAtTime(spec[1], now);
      osc.frequency.exponentialRampToValueAtTime(spec[2], now + spec[4]);
      gain.gain.setValueAtTime(spec[3], now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + spec[4]);
      osc.start(now);
      osc.stop(now + spec[4] + 0.02);
    },
  };

  const AudioDirector = {
    scene: null,
    music: [],
    musicIndex: 0,
    started: false,
    ducked: false,
    activeVoice: null,
    voicePriority: 0,
    voiceToken: 0,
    blockedUntil: 0,
    blockedPriority: 0,

    attach(scene) {
      this.scene = scene;
      scene.sound.mute = isMuted();
    },

    startMusic(scene) {
      this.attach(scene);
      AudioKit.ensure();
      if (!this.music.length) {
        this.music = MUSIC_KEYS.map((key, index) => {
          const sound = scene.sound.add(key, { volume: MUSIC_VOLUME });
          sound.on("complete", () => {
            if (this.started && this.musicIndex === index) {
              this.playPart((index + 1) % this.music.length);
            }
          });
          return sound;
        });
      }
      this.started = true;
      const current = this.music[this.musicIndex];
      if (!current || !current.isPlaying) this.playPart(this.musicIndex);
      this.applyMusicVolume();
    },

    playPart(index) {
      if (!this.music.length) return;
      const current = this.music[this.musicIndex];
      if (current && current.isPlaying) current.stop();
      this.musicIndex = index;
      const next = this.music[this.musicIndex];
      next.setVolume(this.ducked ? MUSIC_DUCKED_VOLUME : MUSIC_VOLUME);
      next.play();
    },

    applyMusicVolume() {
      const volume = this.ducked ? MUSIC_DUCKED_VOLUME : MUSIC_VOLUME;
      this.music.forEach((sound) => sound.setVolume(volume));
      if (this.scene) this.scene.sound.mute = isMuted();
    },

    setMute(scene, on) {
      setMuted(on);
      this.attach(scene);
      scene.sound.mute = on;
      AudioKit.setMute(on);
      if (on && this.activeVoice && this.activeVoice.isPlaying) this.activeVoice.stop();
      this.applyMusicVolume();
    },

    toggle(scene) {
      this.setMute(scene, !isMuted());
      return isMuted();
    },

    speak(scene, key, priority = 1) {
      if (isMuted() || !scene.cache.audio.exists(key)) return false;
      const now = performance.now();
      if (this.activeVoice && this.activeVoice.isPlaying && priority < this.voicePriority) return false;
      if (now < this.blockedUntil && priority <= this.blockedPriority) return false;

      const interruptedVoice = this.activeVoice;
      const token = ++this.voiceToken;
      if (interruptedVoice && interruptedVoice.isPlaying) interruptedVoice.stop();
      if (interruptedVoice && interruptedVoice.destroy) interruptedVoice.destroy();
      this.activeVoice = scene.sound.add(key, { volume: 0.96 });
      this.voicePriority = priority;
      this.ducked = true;
      this.applyMusicVolume();

      let finished = false;
      const finish = () => {
        if (finished || token !== this.voiceToken) return;
        finished = true;
        const voice = this.activeVoice;
        const finishedPriority = this.voicePriority;
        this.activeVoice = null;
        this.voicePriority = 0;
        this.blockedUntil = performance.now() + 650;
        this.blockedPriority = finishedPriority;
        window.setTimeout(() => {
          if (token !== this.voiceToken) return;
          this.ducked = false;
          this.blockedPriority = 0;
          this.applyMusicVolume();
          if (voice && voice.destroy) voice.destroy();
        }, 320);
      };
      this.activeVoice.once("complete", finish);
      this.activeVoice.once("stop", finish);
      this.activeVoice.play();
      return true;
    },
  };

  function addAmbient(scene, depth = 2) {
    for (let i = 0; i < 20; i += 1) {
      const ember = scene.add.circle(
        Phaser.Math.Between(20, W - 20),
        Phaser.Math.Between(120, H - 30),
        Phaser.Math.FloatBetween(1.2, 3.4),
        i % 3 === 0 ? 0x60c8ff : 0xffc45c,
        Phaser.Math.FloatBetween(0.16, 0.5),
      ).setDepth(depth);
      scene.tweens.add({
        targets: ember,
        y: -30,
        x: ember.x + Phaser.Math.Between(-60, 60),
        alpha: 0,
        duration: Phaser.Math.Between(4200, 9000),
        delay: Phaser.Math.Between(0, 3000),
        repeat: -1,
        onRepeat: () => {
          ember.x = Phaser.Math.Between(20, W - 20);
          ember.y = H + Phaser.Math.Between(0, 80);
          ember.alpha = Phaser.Math.FloatBetween(0.18, 0.5);
        },
      });
    }
    const fogA = scene.add.ellipse(170, 590, 620, 120, 0x29689f, 0.07).setDepth(depth);
    const fogB = scene.add.ellipse(1050, 530, 720, 150, 0xffb94d, 0.045).setDepth(depth);
    scene.tweens.add({ targets: fogA, x: 400, alpha: 0.12, duration: 6500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    scene.tweens.add({ targets: fogB, x: 820, alpha: 0.08, duration: 7800, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  }

  function makeButton(scene, x, y, label, onClick, width = 270, height = 74, style = "gold") {
    const gold = style === "gold";
    const bg = scene.add.rectangle(x, y, width, height, gold ? 0xd2a92b : 0x173d62, 0.96)
      .setStrokeStyle(4, gold ? 0xffefac : 0x71c9ff)
      .setInteractive({ useHandCursor: true });
    const text = scene.add.text(x, y, label, {
      fontFamily: "Impact, Trebuchet MS, sans-serif",
      fontSize: height > 90 ? (label.length > 15 ? "42px" : "48px") : "34px",
      color: gold ? "#171006" : "#edf8ff",
      letterSpacing: 2,
    }).setOrigin(0.5);
    bg.on("pointerover", () => bg.setFillStyle(gold ? 0xffd85b : 0x225a8c));
    bg.on("pointerout", () => bg.setFillStyle(gold ? 0xd2a92b : 0x173d62));
    bg.on("pointerdown", (pointer) => {
      if (pointer.event && pointer.event.stopPropagation) pointer.event.stopPropagation();
      scene.tweens.add({ targets: [bg, text], scaleX: 0.96, scaleY: 0.96, duration: 70, yoyo: true });
      onClick();
    });
    return { bg, text };
  }

  function sweepHtmlVideos() {
    document.querySelectorAll("#tkd-video, #game video").forEach((element) => {
      try {
        if (element.tagName === "VIDEO") {
          element.pause();
          element.removeAttribute("src");
          element.load();
        }
        if (element.parentNode) element.parentNode.removeChild(element);
      } catch (_err) {
        // Best-effort media cleanup.
      }
    });
  }

  function attachVideoOverlay(url, onDone) {
    sweepHtmlVideos();
    const root = document.getElementById("game");
    if (!root) {
      onDone();
      return { done: onDone };
    }
    const wrap = document.createElement("div");
    wrap.id = "tkd-video";
    wrap.style.cssText = "position:absolute;inset:0;background:#02060c;z-index:8;display:flex;align-items:center;justify-content:center;pointer-events:none;";
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.style.cssText = "width:100%;height:100%;object-fit:contain;pointer-events:none;";
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch (_err) {
        // Best-effort media cleanup.
      }
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      onDone();
    };
    video.addEventListener("ended", done);
    video.addEventListener("error", done);
    wrap.appendChild(video);
    root.appendChild(wrap);
    const playPromise = video.play();
    if (playPromise && playPromise.catch) playPromise.catch(done);
    return { wrap, done };
  }

  class BootScene extends Phaser.Scene {
    constructor() {
      super("boot");
    }

    preload() {
      const panel = this.add.rectangle(W / 2, H / 2, 520, 116, 0x06111f, 0.96).setStrokeStyle(2, 0x73cfff);
      const bar = this.add.rectangle(W / 2, H / 2 + 24, 404, 18, 0x142f48);
      const fill = this.add.rectangle(W / 2 - 198, H / 2 + 24, 396, 10, 0xffd766).setOrigin(0, 0.5).setScale(0, 1);
      this.add.text(W / 2, H / 2 - 25, "CHANNELING THE ONE POWER", {
        fontFamily: "Georgia, serif",
        fontSize: "25px",
        color: "#fff1bf",
        letterSpacing: 2,
      }).setOrigin(0.5);
      this.load.on("progress", (progress) => {
        fill.setScale(progress, 1);
      });
      this.load.on("complete", () => {
        panel.setStrokeStyle(3, 0xffd766);
        bar.setFillStyle(0x183d5f);
      });

      this.load.image("rileyIdle", "assets/riley-front-idle-v2.png");
      this.load.image("rileyCast", "assets/riley-front-cast-v2.png");
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
      this.load.image("arena", "assets/citadel-arena-v2.jpg");
      this.load.image("cut1", "assets/cutscene-dragon-1.jpg");
      this.load.image("cut2", "assets/cutscene-dragon-2.jpg");
      this.load.image("cut3", "assets/cutscene-dragon-3.jpg");
      this.load.image("cut4", "assets/cutscene-dragon-4.jpg");

      MUSIC_KEYS.forEach((key, index) => {
        this.load.audio(key, "assets/audio/music/music-part-" + String(index).padStart(2, "0") + ".mp3");
      });
      Object.entries(VOICES).forEach(([key, path]) => this.load.audio(key, path));

      this.load.on("loaderror", (file) => {
        console.warn("Riley asset failed to load", file && file.key);
      });
    }

    create() {
      ["trolloc", "brute", "fade", "heart", "shard", "dragon", "fireball", "bolt", "balefire", "rand", "waygate"]
        .forEach((key) => chromaKeyTexture(this, key));
      this.scene.start(seenIntro() ? "title" : "intro");
    }
  }

  class IntroScene extends Phaser.Scene {
    constructor() {
      super("intro");
    }

    create() {
      this.done = false;
      this.add.rectangle(W / 2, H / 2, W, H, 0x02060c);
      this.overlay = attachVideoOverlay("assets/intro.mp4", () => this.finish());
      const skip = this.add.text(W - 34, 24, "SKIP INTRO", {
        fontFamily: "Impact, sans-serif",
        fontSize: "25px",
        color: "#fff5c7",
        stroke: "#06111f",
        strokeThickness: 6,
      }).setOrigin(1, 0).setDepth(20).setInteractive({ useHandCursor: true });
      skip.on("pointerdown", () => this.finish());
      this.input.once("pointerdown", () => this.finish());
      this.input.keyboard.once("keydown-SPACE", () => this.finish());
      this.input.keyboard.once("keydown-ENTER", () => this.finish());
      this.time.delayedCall(14000, () => this.finish());
    }

    finish() {
      if (this.done) return;
      this.done = true;
      if (this.overlay && this.overlay.done) this.overlay.done();
      sweepHtmlVideos();
      markIntro();
      this.scene.start("title");
    }
  }

  class TitleScene extends Phaser.Scene {
    constructor() {
      super("title");
    }

    create() {
      sweepHtmlVideos();
      AudioDirector.attach(this);
      this.add.image(W / 2, H / 2, "arena").setDisplaySize(W, H);
      this.add.rectangle(W / 2, H / 2, W, H, 0x02050b, 0.2);
      this.add.ellipse(320, 390, 520, 620, 0x0a79d1, 0.1);
      this.add.ellipse(950, 390, 650, 620, 0xd48519, 0.06);
      addAmbient(this, 1);

      const shadow = this.add.ellipse(315, 625, 280, 54, 0x000000, 0.48).setDepth(3);
      const riley = this.add.image(315, 397, "rileyIdle").setScale(0.53).setDepth(4);
      this.tweens.add({ targets: [riley, shadow], y: "-=8", duration: 1450, yoyo: true, repeat: -1, ease: "Sine.inOut" });

      this.add.text(835, 88, "TAE KWON DOE", {
        fontFamily: "Georgia, Impact, serif",
        fontSize: "51px",
        color: "#fff3bf",
        stroke: "#381407",
        strokeThickness: 7,
        letterSpacing: 3,
      }).setOrigin(0.5).setDepth(5);
      this.add.text(835, 158, "RILEY", {
        fontFamily: "Impact, Georgia, serif",
        fontSize: "82px",
        color: "#ffd65e",
        stroke: "#3b1608",
        strokeThickness: 9,
        letterSpacing: 7,
      }).setOrigin(0.5).setDepth(5);
      this.add.text(835, 222, "THE ASHA'MAN NINJA", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#8edbff",
        letterSpacing: 4,
      }).setOrigin(0.5).setDepth(5);
      this.add.text(835, 273, "DRAG TO MOVE  ·  AUTO-FIRE  ·  SURVIVE THE PATTERN", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "19px",
        color: "#eef8ff",
        letterSpacing: 1,
      }).setOrigin(0.5).setDepth(5);

      const scores = loadScores();
      const lastText = scores.last ? String(scores.last.score) : "—";
      this.add.text(835, 322, "BEST " + scores.best + "   ·   LAST " + lastText, {
        fontFamily: "Impact, sans-serif",
        fontSize: "26px",
        color: "#fff2bf",
        letterSpacing: 2,
      }).setOrigin(0.5).setDepth(5);
      this.add.text(835, 363, Phaser.Utils.Array.GetRandom(JOKES), {
        fontFamily: "Georgia, serif",
        fontSize: "19px",
        fontStyle: "italic",
        color: "#c9eaff",
      }).setOrigin(0.5).setDepth(5);

      const start = () => {
        AudioDirector.startMusic(this);
        this.scene.start("play");
      };
      const play = makeButton(this, 835, 466, "ENTER THE PATTERN", start, 440, 104, "gold");
      play.bg.setDepth(5);
      play.text.setDepth(6);
      this.tweens.add({ targets: [play.bg, play.text], scaleX: 1.025, scaleY: 1.025, duration: 780, yoyo: true, repeat: -1, ease: "Sine.inOut" });

      const soundBg = this.add.rectangle(835, 560, 230, 48, 0x071827, 0.9)
        .setStrokeStyle(2, 0x6ccfff)
        .setDepth(5)
        .setInteractive({ useHandCursor: true });
      const soundText = this.add.text(835, 560, isMuted() ? "SOUND OFF" : "SOUND ON", {
        fontFamily: "Impact, sans-serif",
        fontSize: "22px",
        color: "#eaf8ff",
        letterSpacing: 2,
      }).setOrigin(0.5).setDepth(6);
      soundBg.on("pointerdown", () => {
        const muted = AudioDirector.toggle(this);
        soundText.setText(muted ? "SOUND OFF" : "SOUND ON");
      });

      this.add.text(835, 624, "CHARACTER VOICES ARE AI-GENERATED BY OPENAI", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "13px",
        color: "#8fa8bb",
        letterSpacing: 1,
      }).setOrigin(0.5).setDepth(5);

      this.input.keyboard.once("keydown-SPACE", start);
      this.input.keyboard.once("keydown-ENTER", start);
    }
  }

  class PlayScene extends Phaser.Scene {
    constructor() {
      super("play");
    }

    create() {
      sweepHtmlVideos();
      AudioDirector.attach(this);
      AudioDirector.startMusic(this);

      this.dead = false;
      this.cutscene = false;
      this.dragging = false;
      this.hp = START_HP;
      this.weaponLevel = 1;
      this.weaponXP = 0;
      this.score = 0;
      this.distance = 0;
      this.shots = 0;
      this.trollocsDown = 0;
      this.runMs = 0;
      this.invuln = SAFE_MS;
      this.casting = false;
      this.castUntil = 0;
      this.nextAutoFire = 0;
      this.nextSpawnAt = 0;
      this.spawnSerial = 0;
      this.firstKillVoice = false;
      this.firstFoeSpawned = false;
      this.fadeVoice = false;
      this.lowVoice = false;
      this.dragVoice = false;
      this.dragonUsed = false;
      this.randUntil = 0;
      this.randClearAt = 0;
      this.randFading = false;
      this.shownPowerPrompt = false;
      this.showTutorial = !hasLearned();

      this.background = this.add.image(W / 2, H / 2, "arena").setDisplaySize(W, H).setDepth(0);
      this.add.rectangle(W / 2, H / 2, W, H, 0x02050a, 0.13).setDepth(1);
      this.add.ellipse(340, 400, 700, 620, 0x087fc9, 0.07).setDepth(1);
      this.add.ellipse(1030, 390, 650, 600, 0xe09322, 0.045).setDepth(1);
      addAmbient(this, 2);
      const arenaScaleX = this.background.scaleX;
      const arenaScaleY = this.background.scaleY;
      this.tweens.add({
        targets: this.background,
        scaleX: arenaScaleX * 1.012,
        scaleY: arenaScaleY * 1.012,
        duration: 7600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });

      this.trollocs = this.physics.add.group();
      this.hazards = this.physics.add.group();
      this.pickups = this.physics.add.group();
      this.gates = this.physics.add.group();
      this.shotsGroup = this.physics.add.group();
      this.enemyShots = this.physics.add.group();

      this.rileyShadow = this.add.ellipse(295, 484, 165, 38, 0x000000, 0.5).setDepth(7);
      this.rileyAura = this.add.circle(295, 350, 104, 0x35bfff, 0.075).setStrokeStyle(3, 0xffd96a, 0.34).setDepth(7);
      this.riley = this.physics.add.image(295, 350, "rileyIdle").setScale(0.27).setDepth(9);
      this.riley.body.allowGravity = false;
      this.riley.setFlipX(false);
      this.riley.setAngle(0);
      this.riley.setInteractive({ useHandCursor: true });
      this.input.setDraggable(this.riley);
      this.applyRileyLook();

      this.rand = this.add.image(390, 325, "rand").setScale(0.52).setDepth(10).setAlpha(0);

      this.physics.add.overlap(this.riley, this.trollocs, this.onFoeTouch, null, this);
      this.physics.add.overlap(this.riley, this.hazards, this.onFoeTouch, null, this);
      this.physics.add.overlap(this.riley, this.enemyShots, this.onEnemyShotTouch, null, this);
      this.physics.add.overlap(this.riley, this.pickups, this.onPickup, null, this);
      this.physics.add.overlap(this.riley, this.gates, this.onGateTouch, null, this);
      this.physics.add.overlap(this.shotsGroup, this.trollocs, this.onShotHit, null, this);
      this.physics.add.overlap(this.shotsGroup, this.hazards, this.onShotHit, null, this);
      this.physics.add.overlap(this.shotsGroup, this.gates, this.onShotHit, null, this);
      this.physics.add.overlap(this.shotsGroup, this.enemyShots, this.onShotBlock, null, this);

      this.createHUD();
      this.createDragTutorial();
      this.setupDragInput();
      this.nextAutoFire = this.time.now + 480;
      this.nextSpawnAt = this.time.now + 350;

      window.TkdRiley = { version: VERSION, play: this };
      this.orientationPaused = false;
      this.orientationHandler = () => this.syncOrientationPause();
      window.addEventListener("resize", this.orientationHandler);
      this.time.delayedCall(0, this.orientationHandler);
      this.events.once("shutdown", () => {
        window.removeEventListener("resize", this.orientationHandler);
        if (window.TkdRiley && window.TkdRiley.play === this) window.TkdRiley.play = null;
      });
    }

    createHUD() {
      this.add.rectangle(126, 51, 220, 78, 0x03101c, 0.82).setStrokeStyle(2, 0x3d8dc4, 0.75).setDepth(30);
      this.scoreText = this.add.text(30, 20, "SCORE 0", {
        fontFamily: "Impact, sans-serif",
        fontSize: "29px",
        color: "#fff2bf",
        letterSpacing: 1,
      }).setDepth(31);
      this.heartIcons = [];
      for (let i = 0; i < MAX_HP; i += 1) {
        const heart = this.add.image(40 + i * 42, 72, "heart").setScale(0.19).setDepth(31);
        this.heartIcons.push(heart);
      }

      this.add.rectangle(W / 2, 42, 510, 43, 0x061725, 0.92).setStrokeStyle(3, 0xffdf7a).setDepth(30);
      this.meterFill = this.add.rectangle(W / 2 - 244, 42, 488, 29, 0xff853c).setOrigin(0, 0.5).setDepth(31);
      this.meterLabel = this.add.text(W / 2, 42, "FIREBALL", {
        fontFamily: "Impact, sans-serif",
        fontSize: "23px",
        color: "#07101a",
        letterSpacing: 3,
      }).setOrigin(0.5).setDepth(32);

      this.soundBg = this.add.rectangle(W - 100, 42, 164, 48, 0x061725, 0.92)
        .setStrokeStyle(2, 0x72d1ff)
        .setDepth(30)
        .setInteractive({ useHandCursor: true });
      this.soundText = this.add.text(W - 100, 42, isMuted() ? "SOUND OFF" : "SOUND ON", {
        fontFamily: "Impact, sans-serif",
        fontSize: "19px",
        color: "#e8f8ff",
        letterSpacing: 1,
      }).setOrigin(0.5).setDepth(31);
      this.soundBg.on("pointerdown", (pointer) => {
        if (pointer.event && pointer.event.stopPropagation) pointer.event.stopPropagation();
        const muted = AudioDirector.toggle(this);
        this.soundText.setText(muted ? "SOUND OFF" : "SOUND ON");
      });

      this.warnText = this.add.text(W / 2, 94, "", {
        fontFamily: "Impact, Trebuchet MS, sans-serif",
        fontSize: "26px",
        color: "#ffe37f",
        stroke: "#07101a",
        strokeThickness: 6,
        letterSpacing: 1,
      }).setOrigin(0.5).setDepth(33).setAlpha(0);
      this.refreshHUD();
    }

    createDragTutorial() {
      if (!this.showTutorial) return;
      this.tutorialPanel = this.add.rectangle(345, 127, 405, 68, 0x061725, 0.88)
        .setStrokeStyle(2, 0x77d5ff)
        .setDepth(34);
      this.tutorialText = this.add.text(345, 116, "DRAG RILEY TO DODGE", {
        fontFamily: "Impact, sans-serif",
        fontSize: "25px",
        color: "#fff0b4",
        letterSpacing: 2,
      }).setOrigin(0.5).setDepth(35);
      this.tutorialSub = this.add.text(345, 143, "AUTO-FIRE IS ACTIVE", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "13px",
        color: "#8edbff",
        letterSpacing: 2,
      }).setOrigin(0.5).setDepth(35);
      this.touchGuide = this.add.circle(this.riley.x, this.riley.y, 34, 0xffd65c, 0.15)
        .setStrokeStyle(4, 0xffe794, 0.85)
        .setDepth(35);
      this.tweens.add({
        targets: this.touchGuide,
        x: this.riley.x + 170,
        y: this.riley.y + 100,
        scale: 0.72,
        alpha: 0.42,
        duration: 1050,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
      this.time.delayedCall(6200, () => this.hideTutorial());
    }

    hideTutorial() {
      if (!this.tutorialPanel) return;
      const targets = [this.tutorialPanel, this.tutorialText, this.tutorialSub, this.touchGuide].filter(Boolean);
      this.tweens.add({
        targets,
        alpha: 0,
        duration: 380,
        onComplete: () => targets.forEach((target) => target.destroy()),
      });
      this.tutorialPanel = null;
    }

    setupDragInput() {
      this.input.on("dragstart", (_pointer, gameObject) => {
        if (gameObject !== this.riley || this.dead || this.cutscene) return;
        this.dragging = true;
        this.rileyAura.setAlpha(0.18).setScale(1.08);
        markLearned();
        this.hideTutorial();
        if (!this.dragVoice && AudioDirector.speak(this, "vRileyDrag", 1)) this.dragVoice = true;
      });
      this.input.on("drag", (_pointer, gameObject, dragX, dragY) => {
        if (gameObject !== this.riley || !this.dragging || this.dead || this.cutscene) return;
        const x = Phaser.Math.Clamp(dragX, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
        const y = Phaser.Math.Clamp(dragY, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
        this.riley.body.reset(x, y);
        this.riley.setVelocity(0, 0);
      });
      this.input.on("dragend", (_pointer, gameObject) => {
        if (gameObject !== this.riley) return;
        this.dragging = false;
        this.rileyAura.setAlpha(0.075).setScale(1);
      });
      this.input.on("gameout", () => {
        this.dragging = false;
        this.rileyAura.setAlpha(0.075).setScale(1);
      });
    }

    syncOrientationPause() {
      const portraitPhone = window.innerHeight > window.innerWidth && window.innerWidth <= 900;
      if (portraitPhone && !this.orientationPaused) {
        this.orientationPaused = true;
        this.dragging = false;
        this.sound.pauseAll();
        this.scene.pause();
      } else if (!portraitPhone && this.orientationPaused) {
        this.orientationPaused = false;
        this.scene.resume();
        this.sound.resumeAll();
      }
    }

    spawnInterval() {
      return 800 - Math.min(300, (this.runMs / 30000) * 300);
    }

    itemSpeed() {
      return -(275 + Math.min(125, (this.runMs / 30000) * 125));
    }

    chooseFoe() {
      const roll = Math.random();
      if (this.runMs < 4500) return "trolloc";
      if (this.runMs < 12000) return roll < 0.72 ? "trolloc" : "brute";
      if (this.runMs < 22000) return roll < 0.52 ? "trolloc" : roll < 0.82 ? "brute" : "fade";
      return roll < 0.4 ? "trolloc" : roll < 0.7 ? "brute" : "fade";
    }

    nextLaneY() {
      const lanes = [230, 315, 400, 490, 270, 450];
      const base = lanes[this.spawnSerial % lanes.length];
      this.spawnSerial += 1;
      return Phaser.Math.Clamp(base + Phaser.Math.Between(-22, 22), 185, 530);
    }

    spawnWave() {
      if (this.dead || this.cutscene) return;
      const foeCount = this.trollocs.countActive(true) + this.hazards.countActive(true);
      if (foeCount >= MAX_FOES) return;
      if (this.runMs < 5000) {
        this.spawnFoe("trolloc", this.nextLaneY());
        return;
      }

      const roll = Math.random();
      if (roll < 0.5) {
        this.spawnFoe(this.chooseFoe(), this.nextLaneY());
      } else if (roll < 0.74) {
        if (foeCount <= MAX_FOES - 2) this.spawnFormation();
        else this.spawnFoe(this.chooseFoe(), this.nextLaneY());
      } else if (roll < 0.79) {
        this.spawnItem(this.pickups, "shard", this.nextLaneY(), 0.78, 0.95);
        this.maybePowerPrompt();
      } else if (roll < 0.815) {
        if (this.hp < MAX_HP) {
          this.spawnItem(this.pickups, "heart", this.nextLaneY(), 0.78, 0.95);
          this.maybePowerPrompt();
        } else {
          this.spawnFoe(this.chooseFoe(), this.nextLaneY());
        }
      } else if (roll < 0.83 && !this.dragonUsed && this.runMs > 25000) {
        this.spawnItem(this.pickups, "dragon", Phaser.Math.Between(245, 455), 0.84, 1);
      } else if (roll < 0.9) {
        const gate = this.spawnItem(this.gates, "waygate", this.nextLaneY(), 0.62, 0.5);
        gate.setData("hp", 7);
        gate.setData("maxHp", 7);
        gate.setData("score", 90);
        gate.setData("kind", "waygate");
        gate.setData("attackable", false);
        gate.setAlpha(0.78).setTint(0x79cfff);
      } else {
        this.spawnFoe(this.chooseFoe(), this.nextLaneY());
      }
    }

    spawnFormation() {
      const pair = Math.random() < 0.5 ? [235, 465] : [285, 505];
      this.spawnFoe(this.chooseFoe(), pair[0] + Phaser.Math.Between(-15, 15));
      this.time.delayedCall(180, () => {
        if (!this.dead && !this.cutscene && this.trollocs.countActive(true) + this.hazards.countActive(true) < MAX_FOES) {
          this.spawnFoe(Math.random() < 0.7 ? "trolloc" : this.chooseFoe(), pair[1] + Phaser.Math.Between(-15, 15));
        }
      });
      this.flashWarn("PATTERN WAVE", 1000);
    }

    spawnFoe(kind, y) {
      const spec = FOES[kind];
      const group = kind === "fade" ? this.hazards : this.trollocs;
      const foe = this.spawnItem(group, kind, y, spec.scale, spec.hit);
      foe.setData("hp", spec.hp);
      foe.setData("maxHp", spec.hp);
      foe.setData("score", spec.score);
      foe.setData("baseY", y);
      foe.setData("phase", Phaser.Math.FloatBetween(0, Math.PI * 2));
      foe.setData("amp", spec.amp + Math.min(18, this.runMs / 4000));
      foe.setData("telegraphing", false);
      foe.setData("attackable", false);
      foe.setAlpha(0.78).setTint(0x79cfff);
      const canShoot = this.runMs > 4500 && (kind === "fade" || kind === "brute");
      foe.setData("attackAt", canShoot ? this.time.now + Phaser.Math.Between(1050, 1600) : Number.POSITIVE_INFINITY);
      const shadow = this.add.ellipse(foe.x, foe.y + foe.displayHeight * 0.36, foe.displayWidth * 0.62, 22, 0x000000, 0.38).setDepth(7);
      foe.setData("shadow", shadow);
      const barBack = this.add.rectangle(foe.x, foe.y - 75, 72, 9, 0x14080a, 0.9).setDepth(14).setVisible(false);
      const bar = this.add.rectangle(foe.x - 34, foe.y - 75, 68, 5, 0xff5c56).setOrigin(0, 0.5).setDepth(15).setVisible(false);
      foe.setData("hpBarBack", barBack);
      foe.setData("hpBar", bar);
      if (kind === "fade" && !this.fadeVoice) {
        if (AudioDirector.speak(this, "vFade", 2)) this.fadeVoice = true;
      }
      if (!this.firstFoeSpawned) {
        this.firstFoeSpawned = true;
        this.flashWarn("SHADOWSPAWN INCOMING", 1300);
      }
      return foe;
    }

    spawnItem(group, key, y, scale, hit = 1) {
      const item = group.create(W + 60, y, key);
      item.setScale(scale);
      item.body.allowGravity = false;
      item.setVelocityX(this.itemSpeed());
      item.setImmovable(true);
      item.setDepth(9);
      item.setData("kind", key);
      item.body.setSize(item.width * hit, item.height * hit);
      item.body.setOffset((item.width - item.body.width) / 2, (item.height - item.body.height) / 2);
      return item;
    }

    maybePowerPrompt() {
      if (this.shownPowerPrompt) return;
      this.shownPowerPrompt = true;
      this.flashWarn("SHARDS UPGRADE · HEARTS HEAL", 1800);
    }

    telegraphFoe(foe) {
      if (!foe.active || foe.getData("telegraphing")) return;
      foe.setData("telegraphing", true);
      foe.setData("attackAt", Number.POSITIVE_INFINITY);
      const color = foe.getData("kind") === "fade" ? 0xa77cff : 0xff734f;
      const ring = this.add.circle(foe.x, foe.y, 24, color, 0.12).setStrokeStyle(5, color, 0.9).setDepth(13);
      foe.setData("telegraphRing", ring);
      this.tweens.add({
        targets: ring,
        scale: 2.1,
        alpha: 0,
        duration: 640,
        ease: "Quad.out",
        onComplete: () => {
          if (ring.active) ring.destroy();
          if (foe.active && foe.getData("telegraphRing") === ring) foe.setData("telegraphRing", null);
          if (foe.active && !this.dead && !this.cutscene) this.launchEnemyShot(foe);
          if (foe.active) {
            foe.setData("telegraphing", false);
            foe.setData("attackAt", this.time.now + Phaser.Math.Between(1800, 2700));
          }
        },
      });
    }

    launchEnemyShot(foe) {
      const orb = this.enemyShots.create(foe.x - 28, foe.y, "fireball");
      const fadeShot = foe.getData("kind") === "fade";
      orb.setScale(fadeShot ? 0.24 : 0.2);
      orb.setTint(fadeShot ? 0xb484ff : 0xff5a45);
      orb.body.allowGravity = false;
      orb.setDepth(12);
      orb.setData("kind", "enemyShot");
      orb.body.setCircle(Math.min(orb.width, orb.height) * 0.24);
      const angle = Math.atan2(this.riley.y - foe.y, this.riley.x - foe.x);
      const speed = 290 + Math.min(90, this.runMs / 333);
      this.physics.velocityFromRotation(angle, speed, orb.body.velocity);
      const glow = this.add.circle(orb.x, orb.y, 25, fadeShot ? 0x8d5cff : 0xff4c35, 0.22).setDepth(11);
      orb.setData("glow", glow);
      AudioKit.beep("block");
    }

    autoFire() {
      const spec = WEAPONS[this.weaponLevel] || WEAPONS[1];
      const shot = this.shotsGroup.create(this.riley.x + 73, this.riley.y - 8, spec.key);
      shot.setScale(spec.scale);
      shot.body.allowGravity = false;
      const shotRadius = Math.min(shot.width, shot.height) * 0.22;
      shot.body.setCircle(
        shotRadius,
        (shot.width - shotRadius * 2) / 2,
        (shot.height - shotRadius * 2) / 2,
      );
      shot.setVelocityX(spec.speed);
      shot.setDepth(13);
      shot.setData("damage", spec.damage);
      shot.setData("pierce", spec.pierce);
      shot.setData("hits", 0);
      shot.setData("hitFoes", new Set());
      const glow = this.add.circle(shot.x, shot.y, this.weaponLevel === 3 ? 29 : 21, spec.color, 0.22).setDepth(12);
      shot.setData("glow", glow);
      const flash = this.add.circle(shot.x - 20, shot.y, 18, spec.color, 0.65).setDepth(14);
      this.tweens.add({ targets: flash, scale: 2.3, alpha: 0, duration: 170, onComplete: () => flash.destroy() });
      this.shots += 1;
      this.casting = true;
      this.castUntil = this.time.now + Math.min(170, spec.cadence - 35);
      if (this.shots % 2 === 0) AudioKit.beep(this.weaponLevel === 3 ? "balefire" : this.weaponLevel === 2 ? "lightning" : "fire");
      this.nextAutoFire = this.time.now + spec.cadence;
    }

    onShotBlock(shot, orb) {
      if (!shot.active || !orb.active) return;
      this.cleanupObjectFx(orb);
      orb.destroy();
      const hits = (shot.getData("hits") || 0) + 1;
      shot.setData("hits", hits);
      if (hits > (shot.getData("pierce") || 0)) {
        this.cleanupObjectFx(shot);
        shot.destroy();
      }
      this.score += 15;
      this.impactBurst(orb.x, orb.y, 0x7dd9ff, 7);
      AudioKit.beep("block");
    }

    onShotHit(shot, foe) {
      if (!shot.active || !foe.active) return;
      if (foe.getData("attackable") === false || foe.x > W - 80) return;
      const hitFoes = shot.getData("hitFoes");
      if (hitFoes && hitFoes.has(foe)) return;
      if (hitFoes) hitFoes.add(foe);
      const damage = shot.getData("damage") || 1;
      const hits = (shot.getData("hits") || 0) + 1;
      shot.setData("hits", hits);
      this.hurtFoe(foe, damage);
      if (hits > (shot.getData("pierce") || 0)) {
        this.cleanupObjectFx(shot);
        shot.destroy();
      }
    }

    hurtFoe(foe, damage) {
      if (!foe.active) return;
      const hp = (foe.getData("hp") || 1) - damage;
      foe.setData("hp", hp);
      const bar = foe.getData("hpBar");
      const barBack = foe.getData("hpBarBack");
      if (bar) bar.setVisible(true);
      if (barBack) barBack.setVisible(true);
      foe.setTint(0xffe6a3);
      this.time.delayedCall(90, () => { if (foe.active) foe.clearTint(); });
      this.floatLabel(foe.x, foe.y - 60, "-" + damage);
      this.impactBurst(foe.x, foe.y, this.weaponLevel === 2 ? 0x69d3ff : 0xffc65c, 5);
      AudioKit.beep("hit");
      if (hp <= 0) this.killFoe(foe);
    }

    killFoe(foe) {
      const x = foe.x;
      const y = foe.y;
      const score = foe.getData("score") || 45;
      const isEnemy = foe.getData("kind") !== "waygate";
      if (isEnemy) this.trollocsDown += 1;
      this.score += score;
      this.cleanupObjectFx(foe);
      foe.destroy();
      this.impactBurst(x, y, 0xffd66a, 11);
      this.cameras.main.shake(55, 0.0022);
      if (isEnemy && !this.firstKillVoice) {
        if (AudioDirector.speak(this, "vRileyFirstKill", 2)) this.firstKillVoice = true;
      }
    }

    onFoeTouch(_riley, foe) {
      if (this.randUntil > this.time.now) {
        this.hurtFoe(foe, 99);
        return;
      }
      this.takeHit(foe, "A Trolloc found the one gap Riley did not.");
    }

    onEnemyShotTouch(_riley, orb) {
      this.takeHit(orb, "The Shadow found its mark.");
    }

    onGateTouch(_riley, gate) {
      if (this.randUntil > this.time.now) {
        this.hurtFoe(gate, 99);
        return;
      }
      this.takeHit(gate, "Riley met a Waygate at full speed.");
    }

    takeHit(item, reason) {
      if (this.invuln > 0 || this.cutscene || this.dead) return;
      if (item && item.active) {
        this.cleanupObjectFx(item);
        item.destroy();
      }
      this.hp -= 1;
      this.invuln = 750;
      this.cameras.main.flash(150, 255, 95, 70);
      this.cameras.main.shake(130, 0.008);
      this.floatLabel(this.riley.x, this.riley.y - 78, "HIT");
      AudioKit.beep("oof");
      if (this.hp === 1 && !this.lowVoice) {
        if (AudioDirector.speak(this, "vRileyLow", 4)) this.lowVoice = true;
      }
      this.refreshHUD();
      if (this.hp <= 0) this.die(reason);
    }

    onPickup(_riley, item) {
      const kind = item.getData("kind");
      const x = item.x;
      const y = item.y;
      this.cleanupObjectFx(item);
      item.destroy();
      this.impactBurst(x, y, kind === "heart" ? 0xff6886 : 0x74d7ff, 12);
      AudioKit.beep("power");
      if (kind === "heart") {
        this.hp = Math.min(MAX_HP, this.hp + 1);
        this.score += 45;
        this.floatLabel(this.riley.x, this.riley.y - 78, "+1 HEART");
      } else if (kind === "shard") {
        this.addWeaponXP(1);
        this.score += 60;
      } else if (kind === "dragon") {
        this.score += 240;
        AudioDirector.speak(this, "vRileyDragon", 5);
        this.startDragonCutscene();
      }
      this.refreshHUD();
    }

    addWeaponXP(amount) {
      if (this.weaponLevel >= 3) {
        this.floatLabel(this.riley.x, this.riley.y - 78, "MAX POWER");
        return;
      }
      this.weaponXP += amount;
      const need = SHARDS_TO_LEVEL[this.weaponLevel] || 3;
      this.floatLabel(this.riley.x, this.riley.y - 78, "WEAVE " + this.weaponXP + "/" + need);
      if (this.weaponXP >= need) {
        this.weaponXP = 0;
        this.weaponLevel += 1;
        const name = WEAPONS[this.weaponLevel].name;
        this.flashWarn(name + " UNLOCKED", 1800);
        this.cameras.main.flash(190, 110, 200, 255);
        this.impactBurst(this.riley.x, this.riley.y, this.weaponLevel === 3 ? 0xffe992 : 0x70d8ff, 18);
        AudioDirector.speak(this, this.weaponLevel === 3 ? "vRileyBalefire" : "vRileyLightning", 4);
      }
    }

    startDragonCutscene() {
      if (this.dragonUsed || this.cutscene) return;
      this.dragonUsed = true;
      this.cutscene = true;
      this.dragging = false;
      [this.shotsGroup, this.enemyShots].forEach((group) => {
        group.getChildren().slice().forEach((projectile) => {
          this.cleanupObjectFx(projectile);
          projectile.destroy();
        });
      });
      this.freezeGroups();
      const layer = this.add.container(0, 0).setDepth(60);
      const frames = ["cut1", "cut2", "cut3", "cut4"];
      const image = this.add.image(W / 2, H / 2, frames[0]).setDisplaySize(W, H);
      const caption = this.add.text(W / 2, H - 55, "THE DRAGON TER'ANGREAL ANSWERS", {
        fontFamily: "Georgia, serif",
        fontSize: "29px",
        color: "#fff1b5",
        stroke: "#03070d",
        strokeThickness: 7,
        letterSpacing: 2,
      }).setOrigin(0.5);
      const skip = this.add.text(W - 28, 22, "SKIP", {
        fontFamily: "Impact, sans-serif",
        fontSize: "25px",
        color: "#fff5c7",
        stroke: "#06111f",
        strokeThickness: 5,
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      layer.add([image, caption, skip]);
      let index = 0;
      const captions = [
        "THE DRAGON TER'ANGREAL ANSWERS",
        "A REDHEAD STEPS OUT OF THE LIGHT",
        "THE DRAGON REBORN STANDS WITH RILEY",
        "THE SHADOW HAS A PROBLEM",
      ];
      const event = this.time.addEvent({
        delay: 1250,
        repeat: frames.length - 1,
        callback: () => {
          index += 1;
          if (index < frames.length) {
            image.setTexture(frames[index]).setDisplaySize(W, H);
            caption.setText(captions[index]);
          } else {
            this.endDragonCutscene(layer);
          }
        },
      });
      skip.on("pointerdown", () => {
        event.remove(false);
        this.endDragonCutscene(layer);
      });
    }

    endDragonCutscene(layer) {
      if (!this.cutscene) return;
      this.cutscene = false;
      if (layer) layer.destroy(true);
      this.randUntil = this.time.now + RAND_MS;
      this.randClearAt = 0;
      this.randFading = false;
      this.tweens.add({ targets: this.rand, alpha: 1, duration: 260 });
      this.flashWarn("DRAGON REBORN · 6 SECONDS", 1800);
      AudioDirector.speak(this, "vDragonStand", 5);
    }

    tickRand() {
      if (this.randUntil <= this.time.now) {
        if (this.rand.alpha > 0 && !this.randFading) {
          this.randFading = true;
          this.tweens.add({
            targets: this.rand,
            alpha: 0,
            duration: 240,
            onComplete: () => { this.randFading = false; },
          });
        }
        return;
      }
      this.rand.x += (this.riley.x + 105 - this.rand.x) * 0.18;
      this.rand.y += (this.riley.y - 5 - this.rand.y) * 0.18;
      if (this.time.now < this.randClearAt) return;
      this.randClearAt = this.time.now + 550;
      [this.trollocs, this.hazards, this.enemyShots].forEach((group) => {
        group.children.iterate((enemy) => {
          if (!enemy || !enemy.active) return;
          if (group === this.enemyShots) {
            this.cleanupObjectFx(enemy);
            enemy.destroy();
          } else {
            this.hurtFoe(enemy, 99);
          }
        });
      });
    }

    freezeGroups() {
      [this.trollocs, this.hazards, this.pickups, this.gates, this.shotsGroup, this.enemyShots].forEach((group) => {
        group.children.iterate((child) => {
          if (child && child.body) child.setVelocity(0, 0);
        });
      });
    }

    syncObjects() {
      const syncFoes = (group) => {
        group.children.iterate((foe) => {
          if (!foe || !foe.active) return;
          const phase = foe.getData("phase") || 0;
          const amplitude = foe.getData("amp") || 0;
          const baseY = foe.getData("baseY") || foe.y;
          foe.y = Phaser.Math.Clamp(baseY + Math.sin(this.runMs / 520 + phase) * amplitude, 175, 545);
          if (foe.body) foe.body.updateFromGameObject();
          foe.setVelocityX(this.itemSpeed());
          if (foe.getData("attackable") === false && foe.x <= W - 80) {
            foe.setData("attackable", true);
            foe.setAlpha(1).clearTint();
            const entryBar = foe.getData("hpBar");
            const entryBarBack = foe.getData("hpBarBack");
            if (entryBar) entryBar.setVisible(true);
            if (entryBarBack) entryBarBack.setVisible(true);
            this.impactBurst(foe.x, foe.y, 0x76d7ff, 5);
          }
          const shadow = foe.getData("shadow");
          if (shadow && shadow.active) {
            shadow.x = foe.x;
            shadow.y = foe.y + foe.displayHeight * 0.36;
          }
          const bar = foe.getData("hpBar");
          const barBack = foe.getData("hpBarBack");
          if (bar && bar.active) {
            const hp = Math.max(0, foe.getData("hp") || 0);
            const maxHp = foe.getData("maxHp") || 1;
            bar.x = foe.x - 34;
            bar.y = foe.y - Math.max(58, foe.displayHeight * 0.43);
            bar.setScale(hp / maxHp, 1);
          }
          if (barBack && barBack.active) {
            barBack.x = foe.x;
            barBack.y = foe.y - Math.max(58, foe.displayHeight * 0.43);
          }
          const telegraphRing = foe.getData("telegraphRing");
          if (telegraphRing && telegraphRing.active) {
            telegraphRing.x = foe.x;
            telegraphRing.y = foe.y;
          }
          if (foe.getData("attackable") && this.time.now >= (foe.getData("attackAt") || Number.POSITIVE_INFINITY)) {
            this.telegraphFoe(foe);
          }
        });
      };
      syncFoes(this.trollocs);
      syncFoes(this.hazards);

      [this.pickups, this.gates].forEach((group) => {
        group.children.iterate((item) => {
          if (!item || !item.active) return;
          item.setVelocityX(this.itemSpeed());
          if (group === this.gates && item.getData("attackable") === false && item.x <= W - 80) {
            item.setData("attackable", true);
            item.setAlpha(1).clearTint();
            this.impactBurst(item.x, item.y, 0x76d7ff, 5);
          }
        });
      });

      [this.shotsGroup, this.enemyShots].forEach((group) => {
        group.children.iterate((object) => {
          if (!object || !object.active) return;
          const glow = object.getData("glow");
          if (glow && glow.active) {
            glow.x = object.x;
            glow.y = object.y;
          }
        });
      });
    }

    sweepGroup(group, minX = -190, maxX = W + 220) {
      group.children.iterate((child) => {
        if (!child || !child.active) return;
        if (child.x < minX || child.x > maxX || child.y < -120 || child.y > H + 120) {
          this.cleanupObjectFx(child);
          child.destroy();
        }
      });
    }

    cleanupObjectFx(object) {
      if (!object || !object.getData) return;
      ["glow", "shadow", "hpBar", "hpBarBack", "telegraphRing"].forEach((key) => {
        const fx = object.getData(key);
        if (fx && fx.destroy) fx.destroy();
        object.setData(key, null);
      });
    }

    impactBurst(x, y, color, count = 8) {
      for (let i = 0; i < count; i += 1) {
        const particle = this.add.circle(x, y, Phaser.Math.FloatBetween(2, 6), color, 0.9).setDepth(20);
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const distance = Phaser.Math.Between(28, 82);
        this.tweens.add({
          targets: particle,
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance,
          alpha: 0,
          scale: 0.2,
          duration: Phaser.Math.Between(260, 520),
          ease: "Quad.out",
          onComplete: () => particle.destroy(),
        });
      }
    }

    floatLabel(x, y, text) {
      const label = this.add.text(x, y, text, {
        fontFamily: "Impact, sans-serif",
        fontSize: "21px",
        color: "#fff0b1",
        stroke: "#03101b",
        strokeThickness: 5,
        letterSpacing: 1,
      }).setOrigin(0.5).setDepth(40);
      this.tweens.add({ targets: label, y: y - 48, alpha: 0, duration: 650, onComplete: () => label.destroy() });
    }

    flashWarn(text, holdMs = 1400) {
      this.warnText.setText(text).setAlpha(1).setScale(1);
      this.tweens.add({ targets: this.warnText, scale: 1.05, duration: 150, yoyo: true, repeat: 2 });
      this.time.delayedCall(holdMs, () => {
        if (this.warnText.text === text) this.tweens.add({ targets: this.warnText, alpha: 0, duration: 260 });
      });
    }

    refreshHUD() {
      if (!this.heartIcons) return;
      this.heartIcons.forEach((heart, index) => {
        const active = index < this.hp;
        heart.setAlpha(active ? 1 : 0.2);
        if (active) heart.clearTint();
        else heart.setTint(0x496071);
      });
      const spec = WEAPONS[this.weaponLevel] || WEAPONS[1];
      const need = SHARDS_TO_LEVEL[this.weaponLevel] || 3;
      const progress = this.weaponLevel >= 3 ? 1 : this.weaponXP / need;
      this.meterFill.setScale(Math.max(0.035, progress), 1);
      this.meterFill.setFillStyle(this.weaponLevel === 3 ? 0xffe995 : this.weaponLevel === 2 ? 0x6bd6ff : 0xff853c);
      this.meterLabel.setText(this.randUntil > this.time.now ? "DRAGON REBORN" : spec.name);
    }

    applyRileyLook() {
      const key = this.casting ? "rileyCast" : "rileyIdle";
      if (this.riley.texture.key !== key) this.riley.setTexture(key);
      this.riley.setScale(0.27);
      this.riley.setFlipX(false);
      this.riley.setAngle(0);
      const bodyWidth = 270;
      const bodyHeight = 590;
      this.riley.body.setSize(bodyWidth, bodyHeight);
      this.riley.body.setOffset((this.riley.width - bodyWidth) / 2, (this.riley.height - bodyHeight) / 2 + 36);
    }

    die(reason) {
      if (this.dead) return;
      this.dead = true;
      this.dragging = false;
      this.freezeGroups();
      AudioKit.beep("bonk");
      const previous = loadScores().last;
      const run = {
        score: Math.floor(this.score),
        distance: Math.floor(this.distance),
        shots: this.shots,
        trollocs: this.trollocsDown,
        reason,
        prevLast: previous ? previous.score : null,
      };
      saveRun(run);
      this.time.delayedCall(260, () => this.scene.launch("over", run));
    }

    update(_time, dt) {
      if (this.dead) return;
      this.runMs += dt;
      this.invuln = Math.max(0, this.invuln - dt);
      if (this.time.now >= this.castUntil) this.casting = false;
      if (this.cutscene) return;

      if (this.time.now >= this.nextAutoFire) this.autoFire();
      if (this.time.now >= this.nextSpawnAt) {
        let catchUpWaves = 0;
        while (this.time.now >= this.nextSpawnAt && catchUpWaves < 2) {
          this.spawnWave();
          this.nextSpawnAt += this.spawnInterval();
          catchUpWaves += 1;
        }
        if (this.time.now - this.nextSpawnAt > this.spawnInterval() * 2) {
          this.nextSpawnAt = this.time.now + this.spawnInterval();
        }
      }

      this.score += dt * 0.006;
      this.distance += (-this.itemSpeed() * dt) / 1000;
      this.tickRand();
      this.syncObjects();
      this.applyRileyLook();

      this.rileyShadow.x = this.riley.x;
      this.rileyShadow.y = this.riley.y + 116;
      this.rileyAura.x = this.riley.x;
      this.rileyAura.y = this.riley.y;
      if (this.invuln > 0) {
        this.riley.setTint(Math.sin(this.runMs / 55) > 0 ? 0xffe49a : 0x8edcff);
        this.rileyAura.setAlpha(0.13 + Math.abs(Math.sin(this.runMs / 90)) * 0.12);
      } else {
        this.riley.clearTint();
        this.rileyAura.setAlpha(this.dragging ? 0.18 : 0.075);
      }

      this.sweepGroup(this.trollocs);
      this.sweepGroup(this.hazards);
      this.sweepGroup(this.pickups);
      this.sweepGroup(this.gates);
      this.sweepGroup(this.shotsGroup, -120, W - 24);
      this.sweepGroup(this.enemyShots, -160, W + 180);
      this.scoreText.setText("SCORE " + Math.floor(this.score));
      this.refreshHUD();
    }
  }

  class OverScene extends Phaser.Scene {
    constructor() {
      super("over");
    }

    create(run) {
      this.run = run;
      this.phase = "menu";
      this.creditsOverlay = null;
      this.add.rectangle(W / 2, H / 2, W, H, 0x02050b, 0.68).setDepth(50).setInteractive();
      this.card = this.add.container(0, 0).setDepth(51);
      this.drawMenu();
      this.time.delayedCall(380, () => AudioDirector.speak(this, "vRileyRetry", 5));
      this.input.keyboard.on("keydown-SPACE", () => {
        if (this.phase === "menu") this.retry();
        else this.showMenu();
      });
      this.input.keyboard.on("keydown-ENTER", () => {
        if (this.phase === "menu") this.retry();
        else this.showMenu();
      });
    }

    drawMenu() {
      this.phase = "menu";
      this.card.removeAll(true);
      const scores = loadScores();
      const isBest = this.run.score >= scores.best && this.run.score > 0;
      const panel = this.add.rectangle(W / 2, H / 2, 760, 500, 0x061422, 0.96).setStrokeStyle(4, 0xffdf78);
      const title = this.add.text(W / 2, 165, "THE PATTERN CLOSED", {
        fontFamily: "Impact, Georgia, serif",
        fontSize: "48px",
        color: "#fff0b5",
        letterSpacing: 3,
      }).setOrigin(0.5);
      const reason = this.add.text(W / 2, 240, this.run.reason, {
        fontFamily: "Georgia, serif",
        fontSize: "21px",
        color: "#ccecff",
        align: "center",
        wordWrap: { width: 650 },
      }).setOrigin(0.5);
      const stats = this.add.text(W / 2, 320,
        "SCORE " + this.run.score + (isBest ? "  ·  NEW BEST" : "") +
        "\nTROLLOCS " + this.run.trollocs + "  ·  SHOTS " + this.run.shots, {
          fontFamily: "Impact, sans-serif",
          fontSize: "27px",
          color: "#ffe18a",
          align: "center",
          lineSpacing: 9,
          letterSpacing: 2,
        }).setOrigin(0.5);
      this.card.add([panel, title, reason, stats]);

      const retry = makeButton(this, W / 2 - 220, 475, "RETRY", () => this.retry(), 220, 70, "gold");
      const home = makeButton(this, W / 2 + 20, 475, "TITLE", () => this.goTitle(), 210, 70, "blue");
      const credits = makeButton(this, W / 2 + 235, 475, "CREDITS", () => this.showCredits(), 190, 70, "blue");
      this.card.add([retry.bg, retry.text, home.bg, home.text, credits.bg, credits.text]);
      const disclosure = this.add.text(W / 2, 566, "AI-GENERATED CHARACTER VOICES · OPENAI", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "13px",
        color: "#839bad",
        letterSpacing: 1,
      }).setOrigin(0.5);
      this.card.add(disclosure);
    }

    showCredits() {
      if (this.phase === "credits") return;
      this.phase = "credits";
      this.card.setVisible(false);
      this.creditsOverlay = attachVideoOverlay("assets/credits.mp4", () => this.showMenu());
      this.time.delayedCall(350, () => {
        this.input.once("pointerdown", () => this.showMenu());
      });
      this.time.delayedCall(12500, () => this.showMenu());
    }

    showMenu() {
      if (this.phase === "menu") return;
      if (this.creditsOverlay && this.creditsOverlay.done) this.creditsOverlay.done();
      this.creditsOverlay = null;
      sweepHtmlVideos();
      this.card.setVisible(true);
      this.drawMenu();
    }

    retry() {
      if (this.creditsOverlay && this.creditsOverlay.done) this.creditsOverlay.done();
      sweepHtmlVideos();
      this.scene.stop("over");
      this.scene.stop("play");
      this.scene.start("play");
    }

    goTitle() {
      if (this.creditsOverlay && this.creditsOverlay.done) this.creditsOverlay.done();
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
    backgroundColor: "#02060c",
    pixelArt: false,
    antialias: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { y: 0 }, fps: 60, debug: false },
    },
    fps: { target: 60, forceSetTimeOut: false },
    scene: [BootScene, IntroScene, TitleScene, PlayScene, OverScene],
    input: { activePointers: 3 },
  });
})();
