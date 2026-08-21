# Whale Lance

Jason’s dad Lance is a cartoon whale on a Hawaiian cruise. Eat the buffet. Toot for thrust. Deflate like a balloon. Tone is warm dad-joke, never mean.

Play locally: open `index.html`, or serve the repo root (`npx serve .`). Landscape 16:9, touch + keyboard, no accounts.

## Loop

Title → play → game over → retry.

- **Tap / Space:** short toot (hop + small deflate)
- **Hold / hold Space:** sustained jet (continuous deflate)
- **Swipe down / S or Down:** dive
- Eat food to refill the Fart Meter and inflate
- Fried spaghetti = bonus inflate · chocolate fountain = overfill
- Too puffy? Cabin doors will stop you. Too empty? Pancake whale.
- Hit gym gear, seagulls, or “No Farting” signs and that’s a wrap
- Score: distance + toot combos + rare stud pickups
- Best + last run saved in `localStorage`
- Mute button (🔊)

The body **squashes on X/Y** from beach-ball (`idle-inflated`) to pancake (`idle-deflated`). Jet uses `fart-blast.png`. Spaghetti uses `eat.png`. Title uses the v2 likeness (`title.png`: real beach-photo face, red polo, white towel, whale body).

## Art

Videomaker v2 sprites (magenta `#FF00FF` is chroma-key, not part of the art):

- `art/sprites-v2/` — canonical character frames
- `art/sprites/` — same frames plus pickups / hazards / background
- `assets/` — keyed, game-ready files the prototype loads

## GitHub Pages

Static files live at the repo root (plus `.nojekyll`). After merge to `main`, set Pages source to **Deploy from a branch → `main` → `/`**.
