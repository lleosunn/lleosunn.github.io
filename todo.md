# Todo

- [ ] **Test scrolling on mobile.** The deck is a discrete stepper now — one card
      per 45px of drag, 170ms floor between steps (`DRAG_STEP` / `STEP_FLOOR` in
      `app/hooks/useVirtualDeck.ts`). Only ever checked in emulation.

- [ ] **Don't restart GIFs when clicking on the tiles.** The card preview and the
      project hero are separate elements, so the hero starts its animation from
      frame 0 when the flight lands on it.

- [ ] **Make images for all pages uniform.** Sizes/aspect ratios vary project to
      project.

- [ ] **Tune scrolling on computer.** The one knob is `WHEEL_MIN` (currently 20,
      the reference's number) in `app/hooks/useVirtualDeck.ts` — deltas below it
      are ignored, which is a dead zone on a gentle trackpad scroll. Cooldown is
      `max(30, 165 - |deltaY|)`ms.

- [ ] **Write Seasats and NCO stuff.** `content/projects/uas-launch-recovery.md`
      and `content/projects/neural-combinatorial-optimization.md`.

- [ ] **Fix zooming-out text alignment.**
