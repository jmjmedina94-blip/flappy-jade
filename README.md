# Flappy Jade 👑

A sparkly, princess-themed take on Flappy Bird. Pick your bird — **Jade** (pink, tiara) or **Darling** (blue, crown) — then tap anywhere to flap through the candy columns and level up every 10 points as the sky shifts from morning pinks to a starry night.

Built as a **pure static site** — just three files, no installs, no build step, nothing to maintain:

| File | What it is |
|---|---|
| `index.html` | The page (menus, buttons, layout) |
| `style.css` | The look of the menus and overlays |
| `game.js` | The whole game — all art is drawn in code, zero image/sound files |

## Play it on your computer

Option 1 — just double-click `index.html`. It opens in your browser and works.

Option 2 — run a tiny local web server (closer to how it behaves online):

```bash
cd ~/flappy-jade
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser. Press `Ctrl+C` in the terminal to stop the server.

## Put it online (so you can text someone the link)

### Option A: GitHub Pages (free, permanent link)

Plain-English glossary: **GitHub** is a website that stores code projects. A **repo** (repository) is one project's folder on GitHub. **Pushing** means uploading your local files to it. **GitHub Pages** is GitHub's free website hosting — it serves your repo as a live web page.

The game is already committed locally. To publish it:

```bash
cd ~/flappy-jade

# 1. Log in to GitHub from the terminal (opens a browser window to confirm)
gh auth login

# 2. Create the online repo and upload the game in one step
gh repo create flappy-jade --public --source=. --push

# 3. Turn on the free website hosting for it
gh api repos/{owner}/flappy-jade/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

If step 3 gives an error, do it on the website instead: go to **github.com → your flappy-jade repo → Settings → Pages → under "Branch" choose `main` and `/ (root)` → Save**.

Your link (live 1–2 minutes later):

```
https://YOUR-GITHUB-USERNAME.github.io/flappy-jade/
```

No `gh` command? Create the repo at github.com (green "New" button, name it `flappy-jade`, Public, no README), then:

```bash
cd ~/flappy-jade
git remote add origin https://github.com/YOUR-USERNAME/flappy-jade.git
git push -u origin main
```

### Option B: Netlify drag-and-drop (fastest, no account gymnastics)

1. Go to **https://app.netlify.com/drop**
2. Drag the whole `flappy-jade` folder from Finder onto the page
3. It gives you a live link immediately (you can claim/rename it with a free account)

Vercel works the same way at **https://vercel.com/new** if you prefer.

## Game details

- **Controls:** tap / click / spacebar to flap
- **Characters:** choose Jade or Darling on the menu — cosmetic only (same speed and hitbox), remembered on the device
- **Levels:** every 10 points. Pipes get a little closer together in feel (smaller gap, faster scroll) and the scenery changes — sunset at level 2, twilight at level 3, starry night at level 4+
- **High score:** saved on the device (localStorage), shown on the menu and game-over screens. Reset from the menu.
- **Mobile:** designed for landscape. In portrait it shows a "rotate your phone" screen and pauses. No scrolling/zooming interference; sound (tiny generated chimes, no files) starts after the first tap and can be muted with the 🔊 button.

### Difficulty tuning

All the knobs live at the top of `game.js` in the `TUNE` object:

| Setting | Value | Meaning |
|---|---|---|
| Gap between pipes | 175px at L1, −8/level, floor 132px | vertical opening you fly through |
| Scroll speed | 168px/s at L1, +13/level, cap 258px/s | how fast the world moves |
| Pipe spacing | 330px | horizontal distance between pipe pairs |
| Gravity / flap | 1500 px/s² / −400 px/s | one flap lifts ≈ 53px |
| Hitbox | radius 15 vs. ~21 visual | collisions are forgiving on purpose |
