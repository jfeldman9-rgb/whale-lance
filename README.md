# Whale Lance

Jason’s dad Lance is a cartoon whale on the Pride of America. He always swims forward. Tap to hop, eat the buffet, and skip the gym — and the frozen yogurt. Tone is warm dad-joke, never mean.

Play locally: open `index.html`, or serve the repo root (`npx serve .`). Landscape 16:9, touch + keyboard, no accounts.

## Loop

Title → play → GAME OVER → gym cutscene → RETRY / TITLE.

- **Tap / Space:** hop (short toot + green puff). That is the only required control.
- **Hold:** optional extra boost / jet (uses more buffet fuel)
- **Swipe down / S or Down:** optional dive
- Swim into food to eat it. Hitboxes are large; nearby plates drift toward Lance. Frozen yogurt does **not** magnet.
- Fried spaghetti is the hero pickup. Chocolate overfills (funny squash) but is not a trap.
- **Frozen yogurt is a trap.** It shrinks Lance, dumps **BUFFET FUEL**, and flashes “Lance hates frozen yogurt!” Two cups in one run, or one cup while already pancake-ish, ends the cruise.
- **BUFFET FUEL** fills when you eat and shrinks when you hop. At 0 he goes pancake (`idle-deflated`). Stay empty for about 2.5 seconds and that’s a lose.
- Too puffy at a cabin door? One warning flash — “Too full — toot to shrink!” — for about 1.5 seconds. The next door contact (or the same door if you are still stuck) ends the run. No permanent first-door pass.
- Gym gear, seagulls, and the No Farting sign: one free “oof” per run. The second hazard hit is game over.
- First-run overlays: TAP TO HOP, EAT THE BUFFET, AVOID THE GYM. After one tap and one bite they stay away (`localStorage`).
- After GAME OVER, a short gym cutscene (`cutscene-gym.png`) plays. TAP / Space skips. Then RETRY / TITLE. Space retries from the menu.
- Best + last run saved in `localStorage`
- Mute button (🔊)

Lance auto-bobs and stays on screen. The body still reads as beach-ball full or towel-deflated. Jet uses `fart-blast.png`. Spaghetti uses `eat.png`. Title uses the v2 likeness (`title.png`).

## Art

Videomaker v2 sprites (magenta `#FF00FF` is chroma-key, not part of the art):

- `art/sprites-v2/` — canonical character frames
- `art/sprites/` — same frames plus pickups / hazards / background, including `froyo.png` and `cutscene-gym.png`
- `assets/` — keyed, game-ready files the prototype loads

The froyo cup is keyed at load (magenta is transparency). The lose still is shown full-bleed; do not replace it with a different trainer illustration.

## GitHub Pages

Static files live at the repo root (plus `.nojekyll`). After merge to `main`, set Pages source to **Deploy from a branch → `main` → `/`**.
