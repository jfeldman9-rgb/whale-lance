# Tae Kwon Doe Riley

Riley is a ninja. He always moves forward through a stone hall of the Wheel. Tap to kick, scatter the Trollocs, and gather the One Power. Tone is warm kid-hero, never mean.

Modeled on the Whale Lance cruise loop: landscape 16:9, one-button, touch + keyboard, no accounts.

Play locally: open `index.html`, or serve the repo root (`npx serve .`).

## Loop

Opening video → Title → play → GAME OVER → ending credits → RETRY / TITLE.

- **Tap / Space:** hop and kick. That is the only required control.
- **Hold:** optional extra boost.
- **Swipe down / S or Down:** optional dive kick.
- Trollocs scroll in from the right the way plates did on the cruise. Kick them. A Trolloc that lands without a kick is a hit.
- One free “oof” per run. The second hit ends the Pattern for now.
- **Eye of the World:** pure saidin and saidar. Fills the One Power meter.
- **Ter’angreal:** a random weave (air shield, slow time, fire kick, extra hop, or a second chance).
- **Angreal:** faster, longer kicks.
- Fill enough of the Power and a **Warder** appears and kicks with Riley.
- Fill enough **saidin** and the next tap casts **lightning** at every enemy on screen.
- First-run overlays: TAP TO KICK, KICK THE TROLLOCS, GRAB THE ONE POWER.
- Best + last run saved in `localStorage`
- Mute button (🔊)
- TAP / Space skips the opening video and the credits.

Riley auto-bobs and stays on screen. Kick uses `riley-kick.png`. Idle uses `riley-idle.png`.

## Art

Magenta `#FF00FF` is chroma-key, not part of the art.

- `art/sprites-riley/` — source character and pickup frames
- `art/cinematics/` — opening stills
- `assets/` — keyed sprites, backgrounds, `intro.mp4`, `credits.mp4`

## GitHub Pages

Static files live at the repo root (plus `.nojekyll`). After merge to `main`, set Pages source to **Deploy from a branch → `main` → `/`**.
