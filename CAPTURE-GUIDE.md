# How to Scan Your Cards

*A few small steps. Take your time. We'll coach you as you go.*

## Before you start (1 minute)

1. **Find soft light from the side.** A window or a lamp to one side works well. Skip the bright light right above you.
2. **Clear a flat spot.** Lay your cards out in rows, face up.
3. **Keep your hands and phone out of the light.** That avoids shadows.
4. **Leave valuable cards in their sleeves or top-loaders.** You don't need to take them out. See "Sleeves and top-loaders" below.
5. **Put a plain, light-colored mat or sheet of paper under the cards** if your counter is dark or speckled (granite, dark wood).

## Scan the fronts

1. On Home, tap the big gold **Start a scan**.
2. Tap **Start camera**. Hold your phone above the first card.
3. Tap **Start sweep**.
4. **Move slowly** across the row. Two rows? Glide to the end of the first row, drop down to the next one, and glide back the other way. Any direction works.
5. Keep going until you reach up to 30 cards. Then tap **Stop**.
6. Glare? Tilt a little so the shine slides off the edge.

Slow is good. If you go slowly, the app waits for a clear edge or gap between cards before it counts a new one.

## Sleeves and top-loaders

Your cards stay protected. Keep them in their sleeves or top-loaders. We can read them through the plastic.

- **Keep the "Sleeved / top-loader" switch on.** It is on by default. It sits next to Graded or Raw before you start, and the **Sleeve** button on the camera screen turns it on or off.
- **Tilt a little for shine.** Plastic catches light. If the app says to tilt, tip the phone or the card a little so the shine slides off the edge. Shine on the edge of the plastic is fine.
- **Use a light mat.** A plain, light-colored mat or sheet of paper under the cards helps a lot. A dark or speckled counter can make photos dark. The app may show a soft tip. It never stops you.
- **Keep it steady.** Glide slowly. Sleeves are a bit shiny, so a steady hand matters more.
- **Photo needs a look?** A tile marked **check** has a **Retake** button. Tap it and take that one card again. No need to redo the row.

## Then the backs

1. On the results screen, tap **Scan the backs**.
2. Flip your cards over. Keep the same order.
3. Sweep again the same way.

Backs matter. The year and set are printed there.

## After you stop

1. A **Saving your scan** screen shows a percent. It takes a moment. Don't worry, just wait.
2. Then you land on **Your cards**. It shows how many cards were found and how many need a look.
3. Count looks off? Fix it here:
   - Red tiles say **Looks like a duplicate**. Tap one, then tap **Merge with previous** or **Remove duplicate**.
   - Or use the **Cards in this section** box. Tap − or + and then **Update count**.
   - Tap any photo to **Retake** or **Remove** it.
4. Tap **Review each card** to flip through big photos. Swipe or tap the arrows. Tap the photo (or Front/Back) to see the back. Mark each card **Sell**, **Keep** or **Grade**. Tap a label again to clear it.
5. Tap **Send or share** (or **Send →** while reviewing):
   - **Share** opens the phone Share sheet with the photos zip and the video.
   - **Email to myself** opens your email with the card list and labels. Email can't carry the photos, so Share them separately.
   - **Send to my collection** is coming soon. Nothing leaves your phone yet.
6. Under **What next?** you can also pick:
   - **Scan the backs**
   - **Scan another section**
   - **Save to my phone** (video and photos zip). You stay on this screen.
   - **Done, back to home**
7. The **Home** button at the top is always there. If a scan isn't saved, it offers **Save first**.

Home lists **Your scans**. Tap one to open its cards again anytime.

## Good to know

- **Slow is fast.** A slow scan means fewer redos.
- **Big piles are fine.** Scan one row, one box, or one session at a time. Stop and come back anytime.
- **Graded slabs:** hold them at a slight angle so the label isn't washed out.
- **Condition:** we can't judge corners or edges from video. We'll ask for a quick photo only if needed.
- **Your video stays on your phone** in this version. Nothing is uploaded.
- **Photos are kept on this page** (not the video) so you can come back to them. Tap **Save to my phone** to keep the video too.

## If the app says...

| It says | Try this |
|---|---|
| "Too dark" | Move to soft side light. |
| "Slow down" | Sweep a little slower. |
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
- v0.3: video row scan (sweep two rows at a time, up to 30 cards), bigger green box. Backup: `index.html.bak-v0.2`.
- v0.4: sweep tracking picks the best frame per card.
- v0.5: instant Saving screen, "Your cards" results with a What next? panel, real Home with Your scans and Start a scan, Home button on every screen (Save first), still photos kept in IndexedDB (never the video), Save to my phone uses the share sheet when available and stays put. Stricter card changes (net sweep distance, hysteresis, image similarity merge). Duplicate flags, Merge with previous, Remove duplicate, editable count. Backup: `index.html.bak-v0.4`.
- v0.5.1: flip-through Review screen (large front/back, next/prev or swipe, Sell/Keep/Grade labels kept on the phone and added to the zip as cards.csv), Send screen (Share with files, Email to myself, Send to my collection coming soon). Backup: `index.html.bak-v0.5`.
