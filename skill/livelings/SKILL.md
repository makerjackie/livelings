---
name: livelings
license: MIT (code) and CC BY 4.0 (built-in characters)
metadata:
  author: MakerJackie
  homepage: https://livelings.makerjackie.com
  display-name: 活宝 Skill · by MakerJackie
description: Make your own living, animated mascot (活宝) with the Livelings engine, a character drawn entirely in code that moves, reacts to the cursor and acts out app states (thinking, working, done, error), then put it on a website or turn it into article illustrations, PNGs and videos. No image model needed. Use when someone asks to create, design or animate a mascot, character, 吉祥物, 活宝 or IP; to add a living character to a site or app; or to illustrate an article with a recurring character.
---

# 活宝 Livelings skill · by MakerJackie

Livelings are open-source characters drawn in code: a 96-point outline that can
morph into any shape, springs for every value so states never jump, eyes with
expressions, and a small script per character. This skill makes new ones and
puts them to work. Everything is code: no image generation, so a character
always looks the same, can be edited, and moves.

Reply in the user's language. The engine, a workspace and the built-in family
ship with this skill:

- `workspace/`: copy this folder into the user's project as `livelings/`.
  It holds `livelings.js` (the engine), `studio.html` (sixteen live copies of a
  character doing different things, with PNG, pose-sheet and video export),
  `card.html` (article illustration cards), `characters/` and `cards/`.
- `reference/design.md`: what makes a character worth making. Read it first.
- `reference/api.md`: everything a character file can use.
- `reference/examples/*.ts`: the seven built-in characters. Copy their patterns.
- `templates/character.js`: a commented starting point.

## 1. Make a character

1. **Concepts before code.** Unless the user already described one character
   precisely, propose 3 to 6 concepts first, each one line: name, the image it
   is bound to, its one signature trick, and how it shows thinking / working /
   done / error. Follow `reference/design.md`. If you can, render a quick static
   look of each (a shape, colours and eyes are enough) and show it. Wait for the
   user to pick. Building everything before they choose wastes their time.
2. **Set up the workspace** (once): copy `workspace/` to `<project>/livelings/`.
3. **Write the character** as `livelings/characters/<id>.js`, starting from
   `templates/character.js`. Give it:
   - a silhouette (`rest`) bound to its image, plus any named shapes it morphs into;
   - colours: 3 to 5 palettes, ink outline, flat fill;
   - eyes designed for it (size, spacing, position; or draw its own face with `drawFace`);
   - 4 to 6 signature moves that only it could do;
   - its own take on `thinking`, `working`, `done`, `error` and `sleep`;
   - its own answer to being tapped, startled or petted (`react`) when that is
     where its fun is (a die rolls, a duck squeaks, a ghost vanishes).
4. **Look at it.** Serve the folder and open the studio:
   `python3 -m http.server 4321 --directory livelings`, then
   `http://localhost:4321/studio.html?char=./characters/<id>.js`.
   Check every tile: is the silhouette readable small, does each action read
   at a glance, does any shape glitch mid-morph? Fix and reload. If you can take
   screenshots, do; otherwise ask the user to look.
5. **Hand over**: the file, a sentence on its personality, the embed snippet
   (below), and exports if they want them (PNG, pose sheet, a 5-second video
   from the studio buttons).

## 2. Put it on a website

```html
<script type="module">
  import { registerCharacter } from './livelings/livelings.js'
  import mine from './livelings/characters/mine.js'
  registerCharacter(mine)
</script>
<live-ling character="mine" state="idle" style="width:160px;height:160px"></live-ling>
```

Then drive it from the app: `el.setAttribute('state', 'thinking')` for loops,
`el.play('done')` for one-shots. Built-in ids work without registering:
`cloud`, `inky`, `dice`, `ghost`, `duck`, `blocks`, `moon`. Map real events:
request starts → `thinking`, streaming or tools → `working`, needs input →
`blocked`, success → `done`, failure → `error`, long idle → `sleep`.

## 3. Illustrate an article

Like hand-drawn article illustrations, but the character is consistent, and
every card can also be a short video.

1. Read the article. Pick one idea per card: a judgement, a process, a
   before/after, a metaphor. 4 to 8 cards for a long article. Show the user a
   shot list first (idea, title, which action the character does, notes).
2. For each card write `livelings/cards/<slug>.json` (format in
   `reference/api.md`, section "Cards"): a short title with one **highlighted**
   phrase, the character doing the action that *is* the idea, and at most three
   handwritten notes with arrows.
3. Open `http://localhost:4321/card.html?spec=cards/<slug>.json`, export PNG
   (or "Record 3s" for an animated card). For a batch, `card.html?...&still=1`
   renders one fixed frame, so a headless browser can screenshot it
   (`npx playwright screenshot --viewport-size "1600,900" "<url>&still=1" out/<slug>.png`).

## Rules

- Keep characters in the family style unless asked otherwise: ink outline,
  flat colours, eyes that carry the expression, one accent colour.
- Never trace or imitate an existing brand's mascot or a living artist's
  character. Bound-to-an-image means a *thing* (a die, a ghost), not someone
  else's IP.
- Built-in characters are CC BY 4.0: credit "Livelings by MakerJackie". The
  engine is MIT. Characters the user makes are theirs.
- Site and docs: https://livelings.makerjackie.com
