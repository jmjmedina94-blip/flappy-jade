---
name: verify
description: Launch and drive Flappy Jade end-to-end in the browser pane to verify changes
---

# Verifying Flappy Jade

Static canvas game — no build step. Surface is the browser.

## Launch

- `preview_start` with name `flappy-jade` (config in `.claude/launch.json`, serves on http://localhost:8377).
- Check `read_console_messages` (must stay empty — the game logs nothing) and `read_network_requests` (3 requests, all 200; favicon is inline so no 404).

## Gotcha: the pane tab is `document.hidden` between tool calls

Chrome pauses `requestAnimationFrame` for hidden tabs, so the game freezes between your calls
(that's the game's intended pause-on-hidden behavior). Screenshots force one frame. Deferred
resize events also only dispatch when a frame renders — after `resize_window`, screenshot first,
then pump/read state.

## Deterministic frame pump (soak tests)

The game reads `window.requestAnimationFrame` each frame, so you can swap it live:

```js
window.__nativeRAF = window.requestAnimationFrame.bind(window);
window.__q = [];
window.requestAnimationFrame = cb => { window.__q.push(cb); return 0; };
// bootstrap: one screenshot lets the last native-scheduled frame fire and enqueue
window.__simT = performance.now();
window.__pump = n => { for (let i = 0; i < n; i++) { const cb = window.__q.shift(); window.__simT += 1000/60; cb(window.__simT); } };
```

Restore after: `window.requestAnimationFrame = window.__nativeRAF; window.__q.splice(0).forEach(cb => requestAnimationFrame(cb));`

## Test handle

`window.FJ.get()` → `{state, started, dying, awaitResume, blocked, score, level, speed, bird:{x,y,vy}, pipes:[{x,gapY,gapH}]}`.
`window.FJ.flap()` → same code path as a tap.

Auto-player (flap when below the next gap's sweet spot) survives indefinitely if physics are fair:

```js
const s = FJ.get();
const next = s.pipes.filter(p => p.x + 74 > s.bird.x - 15).sort((a,b) => a.x - b.x)[0];
const ty = next ? next.gapY + next.gapH * 0.18 : 300;
if (s.bird.y > ty && s.bird.vy > -60) FJ.flap();
```

Run one decision + one `__pump(1)` per frame. ~0.3ms CPU per pumped frame.
Mute first (`muteBtn.click()`) or the pump schedules a burst of WebAudio tones.

## Flows worth driving

menu → START → get-ready → first tap → score 10+ (level toast + palette fade) → die →
game-over panel (New Best banner only when score > stored best; buttons unlock after 550ms) →
RETRY / MENU → reset high score (two-tap confirm). localStorage keys: `fj_best`, `fj_bestLevel`, `fj_muted`.
Portrait: `resize_window` mobile → overlay + `blocked`; back to desktop → screenshot (deferred resize!) → `awaitResume` → tap resumes.
