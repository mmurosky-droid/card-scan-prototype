# How to Scan Your Cards

*A few small steps. Take your time. We'll coach you as you go.*

## Before you start (1 minute)

1. **Find soft light from the side.** A window or a lamp to one side works well. Skip the bright light right above you.
2. **Clear a flat spot.** Lay your cards out in rows, face up.
3. **Keep your hands and phone out of the light.** That avoids shadows.
4. **Take cards out of cases if you can.** Shiny cases cause glare. If a card stays in its case, tilt your phone a little.

## Scan the fronts

1. Tap **Start camera**, then the red button.
2. Hold your phone above the first card.
3. **Hold still for 2 to 3 seconds.** Count "one-Mississippi, two-Mississippi."
4. Move to the next card. Hold again.
5. Finish a row, then tap **Next row**.
6. See glare? Tilt the phone or card just a little.

## Then the backs

1. Tap **Backs**.
2. Flip your cards over.
3. Same steps: hold still 2 to 3 seconds on each card.

Backs matter. The year and set are printed there.

## Good to know

- **Slow is fast.** A slow scan means fewer redos.
- **Big piles are fine.** Scan one row, one box, or one session at a time. Stop and come back anytime.
- **Graded slabs:** hold them at a slight angle so the label isn't washed out.
- **Condition:** we can't judge corners or edges from video. We'll ask for a quick photo only if needed.
- **Your video stays on your phone** in this version. Nothing is uploaded.

## If the app says...

| It says | Try this |
|---|---|
| "Too dark" | Move to soft side light. |
| "Slow down" | Hold each card still 2 to 3 seconds. |
| "Glare" | Tilt the card or phone, or take the card out of its case. |
| "A little glare" | Tilt slightly, or move the light to the side. |

You're doing great. Every card you scan is one less to wonder about.

---

# Developer notes: lessons from the baseline video

**Baseline:** Michael's 41 s top-down baseball test (about 17 cards in sleeves, top loaders, magnetic cases, one PSA slab). Source file: `/home/box/agent-data/agents/3a42d587-a551-4deb-b7c9-8a3f0f280e7c/attachments/9d01782db9a2a3ef207895369a4aee45469d6ae8fc395030743a18c492e7cc30.mp4`. Findings were supplied by Moose; I did not re-analyze the video.

| Lesson from baseline | Member guidance | Prototype behavior (`index.html`, v0.2) | Status |
|---|---|---|---|
| Names mostly legible | Keep the phone above each card | Overlay frame and row path | Existing |
| Camera never settles | Hold 2 to 3 s per card | Pre-check tip "Hold still 2–3 seconds". Hint text. Pill messages under 70 steadiness ("Almost still. Hold steady 2–3 seconds") and under 45. Result label "Too fast. Hold each card 2–3 seconds" | Text updated. The steady meter is still a smoothed motion score, not a true per-card dwell timer |
| Heavy overhead glare | Soft side light. Tilt. Cases off | Glare meter (share of pixels with luma over 245). Pill: 2% or more = "tilt slightly or move the light", 6% or more = "tilt the card, or take it out of its case". Brightness under 55 = "try soft light from the side". Result label for heavy glare | Text updated. Thresholds unchanged |
| Years are on card backs | Front then back | Pre-check tip "Front first, then back". The Backs chip shows a notice ("Backs on. Flip your cards…"). Last "Next row" on fronts shows "Fronts done. Tap Backs…". Backs mode pill: "Now the backs…" | New: a 3.5 s `say()` notice that overrides the pill |
| Condition can't be judged | Set expectations | Guide says photo tasks only if needed | Planned: Tasks checklist (not in prototype) |

## Suggested next steps (not built)

1. **Dwell timer.** Count steady frames (steadiness over 70 for 2 s), show a ring or tick, and auto-count the card. This would replace manual taps.
2. **Front/back pairing.** Keep separate counts for fronts and backs, and warn if they differ.
3. **Slab mode.** A glare-tolerant setting, with a prompt to tilt for the label.
4. **Sample frames.** Save one still per dwell, to support the photo-task checklist.
5. **Test on a real phone.** The camera is untested on a phone and needs hosting (GitHub Pages).

## Changelog

- v0.2: coaching text only, plus the `notice`/`say()` helper. No change to analysis, recording or layout. Backup of the original: `index.html.bak-v0.1`.
