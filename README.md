# Whale Lance

Jason’s dad Lance is a cartoon whale on the Pride of America. He always swims forward. Tap to hop, eat the buffet, and skip the gym. Tone is warm dad-joke, never mean.

Play locally: open `index.html`, or serve the repo root (`npx serve .`). Landscape 16:9, touch + keyboard, no accounts.

## Loop

Title → play → game over → retry.

- **Tap / Space:** hop (short toot + green puff). That is the only required control.
- **Hold:** optional extra boost / jet (uses more buffet fuel)
- **Swipe down / S or Down:** optional dive
- Swim into food to eat it. Hitboxes are large; nearby plates drift toward Lance.
- Fried spaghetti is the hero pickup. Chocolate overfills (funny squash) but is not a trap.
- **BUFFET FUEL** fills when you eat and shrinks when you hop. Empty fuel means weaker hops, not game over.
- Too puffy? Cabin doors flash “Too full — toot to shrink!” and give you time. The first door of a run only bounces you.
- Gym gear and seagulls are rare. First hit of a run is a free “oof.” Second hit ends the cruise with a warm joke.
- First-run overlays: TAP TO HOP, EAT THE BUFFET, AVOID THE GYM. After one tap and one bite they stay away (`localStorage`).
- Best + last run saved in `localStorage`
- Mute button (🔊)

Lance auto-bobs, stays on screen, and cannot pancake-die from falling. The body still reads as beach-ball full or towel-deflated. Jet uses `fart-blast.png`. Spaghetti uses `eat.png`. Title uses the v2 likeness (`title.png`: real beach-photo face, red polo, white towel, whale body).

## Art

Videomaker v2 sprites (magenta `#FF00FF` is chroma-key, not part of the art):

- `art/sprites-v2/` — canonical character frames
- `art/sprites/` — same frames plus pickups / hazards / background
- `assets/` — keyed, game-ready files the prototype loads

## GitHub Pages

Static files live at the repo root (plus `.nojekyll`). After merge to `main`, set Pages source to **Deploy from a branch → `main` → `/`**.
