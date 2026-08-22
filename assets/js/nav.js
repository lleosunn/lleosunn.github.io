/* Home tile wheel: a looping ring of cards that recede toward the edges of the
   pane, the dots that track it, and the card whose geometry transitions.js
   flies into the project page.

   scroll.js owns the smoothing now. Lenis animates the pane's scrollTop along
   a long expo curve, so there is nothing left here to smooth and the wheel
   tracks scrollTop exactly. What this file still owns is the loop wrap, which
   moves scrollTop by a whole list length in a single assignment — a move Lenis
   has to be told about, or it drags the pane back on the next frame. */
(function () {
  var scroller = document.getElementById("scroller");
  if (!scroller || document.body.dataset.page !== "home") return;

  var tiles = document.querySelector(".tiles");
  var slots = Array.prototype.slice.call(document.querySelectorAll(".tile"));
  if (!tiles || !slots.length) return;

  var cards = slots.map(function (slot) {
    return slot.querySelector(".tile__card");
  });
  var images = slots.map(function (slot) {
    return slot.querySelector(".tile__image");
  });
  var names = slots.map(function (slot) {
    return slot.querySelector(".tile__name");
  });
  var dots = Array.prototype.slice.call(document.querySelectorAll(".dot"));

  var copies = parseInt(tiles.dataset.copies, 10) || 1;
  var count = slots.length / copies;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var INDEX_KEY = "home-index";

  /* Lenis, when scroll.js has it. Every programmatic move below goes through
     it: an external scrollTop write made while Lenis is mid-glide is ignored,
     and the pane snaps back on the next frame. */
  var lenis = window.__lenis;

  /* --- Wheel shape -------------------------------------------------------

     t is a card's distance from the centre of the pane, in scrollport heights.

     The quantity that matters is each card's FAR edge — the one facing the
     end of the pane — because that edge is all you ever see of a card behind
     another. Cards tuck in behind the focused one and their far edges climb
     OUTWARD in ever smaller steps, geometrically from RIM_FIRST toward
     HORIZON, so the strips taper 42px / 24px / 14px / 8px as they close on a
     vanishing line just inside the pane. Read from the centre out, the deck
     recedes instead of piling up: a wheel turning away rather than a stack of
     sheets whose edges crowd back toward the middle.

     Scale falls on a separate perspective-like curve, so each card is also
     narrower than the one in front of it. */

  var SHRINK = 0.25;
  var RIM_FIRST = 0.38;
  var HORIZON = 0.47;
  var RIM_DECAY = 0.58;
  // A card's own surface stays opaque so its edge reads as a solid sheet; what
  // fades is what is printed on it. Titles go first — five stacked labels read
  // as a list, not a wheel — but the covers hang on: at this rate the project
  // tucked behind the focused one still previews through the rim and the one
  // after it is a whisper, while the far slivers, too thin to read as an
  // image anyway, go plain.
  var WASH = 0.45;
  var LABEL_FADE = 1.4;
  var FADE_FROM = 4;
  var FADE_TO = 5.5;

  var port = 0;
  var slotH = 0;
  var cardH = 0;
  var brim = 0;
  var lap = 0;
  var loLimit = 0;
  var hiLimit = 0;
  var active = -1;
  var activeSlot = 0;
  var parked = [];
  var centres = [];

  /* The wheel is drawn at `eased`. EASE is the share of the remaining gap
     closed per 60Hz frame, rescaled by real frame time so a 120Hz display
     eases at the same speed instead of twice as fast. At 1 the wheel is glued
     to the scroller.

     Glued is the normal case now. This easing existed to turn the browser's
     stepped wheel into a turn; Lenis does that upstream, on a curve four times
     longer, and chasing an already-eased position only adds lag between the
     scroll and the cards drawn from it. It is left in for the two cases where
     nothing upstream is smoothing: reduced motion, and Lenis failing to load. */
  var EASE = reduceMotion || lenis ? 1 : 0.25;
  var eased = 0;
  var target = 0;
  var raf = 0;
  var lastFrame = 0;

  var measure = function () {
    port = scroller.clientHeight;
    slotH = slots[0].offsetHeight || port;
    cardH = cards[0] ? cards[0].offsetHeight : 0;
    brim = cardH / 2 / port;
    lap = count * slotH;
    // Read every slot's box once. render() runs on every animation frame and
    // interleaves style writes with these reads; measuring inside that loop
    // forces a layout per card per frame, which is the whole cost of the
    // effect on a long list.
    for (var i = 0; i < slots.length; i++) {
      centres[i] = slots[i].offsetTop + slots[i].offsetHeight / 2;
    }
    // Wrapping half a list in from either end leaves count/2 slots of runway,
    // far more than one gesture and its momentum can cross.
    loLimit = lap * 0.5;
    hiLimit = (slots.length - 1) * slotH - lap * 0.5;
  };

  /* Two positions, and keeping them apart is the whole trick.

     `turned` is how far the wheel has eased round; it decides which seat a
     card occupies and therefore its scale, its rim and its fades. `here` is
     where the scroller actually is, and the slots move with it whatever the
     wheel is doing. A card's transform has to cancel `here` — not `turned` —
     or the leftover between them displaces every card at once and the barrel
     slides up and down the pane while it turns. Cancel the live position and
     each card sits in its seat: the barrel holds still and only the cards
     travel through it. */
  var render = function () {
    var turned = eased + port / 2;
    var here = target + port / 2;
    var nearest = 0;
    var nearestDistance = Infinity;

    for (var i = 0; i < slots.length; i++) {
      var centre = centres[i];
      // The dots follow the scroller, not the eased wheel, so the active
      // project changes the moment the scroll crosses the midpoint between two
      // cards rather than a beat later.
      var tracking = Math.abs(centre - here);
      if (tracking < nearestDistance) {
        nearestDistance = tracking;
        nearest = i;
      }

      var offset = (centre - turned) / port;
      var slotAt = (centre - here) / port;
      var t = Math.abs(offset);

      var card = cards[i];
      if (!card || reduceMotion) continue;

      if (t > FADE_TO) {
        // Parked cards keep their layout position, which is already several
        // scrollports away. Leaving a transform on them would extend the
        // pane's scrollable area for no visible gain.
        if (!parked[i]) {
          card.style.transform = "";
          card.style.opacity = "0";
          slots[i].style.zIndex = "0";
          parked[i] = true;
        }
        continue;
      }

      var scale = 1 / (1 + SHRINK * t);
      var half = (scale * cardH) / 2 / port;
      // Out to the first slot the card simply travels, from its own far edge
      // at centre to RIM_FIRST; past it, it climbs the rim toward the horizon.
      var rim =
        t <= 1
          ? brim + t * (RIM_FIRST - brim)
          : HORIZON - (HORIZON - RIM_FIRST) * Math.pow(RIM_DECAY, t - 1);
      var reach = rim - half;
      var shift = ((offset < 0 ? -reach : reach) - slotAt) * port;
      var fade = t <= FADE_FROM ? 1 : (FADE_TO - t) / (FADE_TO - FADE_FROM);

      card.style.transform =
        "translateY(" + shift.toFixed(2) + "px) scale(" + scale.toFixed(4) + ")";
      card.style.opacity = fade.toFixed(3);
      if (images[i]) {
        images[i].style.opacity = Math.max(0, 1 - WASH * t).toFixed(3);
      }
      if (names[i]) {
        names[i].style.opacity = Math.max(0, 1 - LABEL_FADE * t).toFixed(3);
      }
      // Nearer cards must paint over further ones; DOM order would put every
      // card below centre on top of the focused one.
      slots[i].style.zIndex = String(Math.max(0, 1000 - Math.round(t * 100)));
      parked[i] = false;
    }

    activeSlot = nearest;
    var index = parseInt(slots[nearest].dataset.index, 10) || 0;
    if (index !== active) {
      active = index;
      for (var d = 0; d < dots.length; d++) {
        dots[d].setAttribute("aria-current", d === active ? "true" : "false");
      }
    }
  };

  /* --- Easing ------------------------------------------------------------ */

  var frame = function (now) {
    var elapsed = lastFrame ? Math.min(now - lastFrame, 64) : 16.7;
    lastFrame = now;
    target = scroller.scrollTop;

    var gap = target - eased;
    // Sub-pixel remainders never reach zero on their own; left alone they
    // would keep a frame loop alive behind a wheel that has visibly stopped.
    if (Math.abs(gap) < 0.5) {
      eased = target;
      raf = 0;
      lastFrame = 0;
      render();
      return;
    }
    eased += gap * (1 - Math.pow(1 - EASE, elapsed / 16.7));
    render();
    raf = requestAnimationFrame(frame);
  };

  var tick = function () {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  // For moves that must not animate: the first paint, a resize, and the loop
  // wrap, where easing across the jump is exactly what has to stay hidden.
  var settle = function () {
    target = scroller.scrollTop;
    eased = target;
    render();
  };

  /* Every instant scrollTop write goes through here. Lenis holds its own idea
     of where the pane is and re-asserts it each frame, so a bare assignment
     made mid-glide is undone before it is ever seen; `force` lands the move
     even when something upstream has stopped or locked the instance. */
  var jump = function (top) {
    scroller.scrollTop = top;
    if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
  };

  /* --- Looping ----------------------------------------------------------- */

  var wrap = function () {
    if (copies < 3) return;
    if (scroller.scrollTop < loLimit) {
      jump(scroller.scrollTop + lap);
      eased += lap;
    } else if (scroller.scrollTop > hiLimit) {
      jump(scroller.scrollTop - lap);
      eased -= lap;
    } else return;
    // The jump is exactly one list length, so it lands at the same offset
    // within an identical run of cards — true at rest or mid-card, which is
    // what lets the scroll run free. Carrying `eased` by the same lap keeps
    // any easing still in flight pointed at the same card, so the wrap stays
    // invisible mid-glide.
    target = scroller.scrollTop;
    render();
  };

  /* --- Wiring ------------------------------------------------------------ */

  scroller.addEventListener("scroll", tick, { passive: true });

  // Wrapping mid-gesture would fight momentum, so it waits for the scroll to
  // settle. scrollend is the precise signal; the timer is for browsers without
  // it, and is harmless where both run.
  if ("onscrollend" in window) {
    scroller.addEventListener("scrollend", wrap, { passive: true });
  } else {
    var idle;
    scroller.addEventListener(
      "scroll",
      function () {
        clearTimeout(idle);
        idle = setTimeout(wrap, 160);
      },
      { passive: true }
    );
  }

  window.addEventListener("resize", function () {
    measure();
    // Lenis clamps every move to a limit it caches; re-centring against a
    // limit measured at the old viewport height would land short.
    if (lenis) lenis.resize();
    // Slot height tracks the viewport, so a resize leaves the old scrollTop
    // pointing between two cards. Re-centre whichever one was in focus.
    jump(activeSlot * slotH);
    settle();
  });
  // Fonts and images settle after first paint and can move the slots.
  window.addEventListener("load", function () {
    measure();
    settle();
  });

  slots.forEach(function (slot, i) {
    var card = cards[i];
    if (!card) return;
    card.addEventListener("click", function () {
      sessionStorage.setItem(INDEX_KEY, slot.dataset.index);
    });
  });

  dots.forEach(function (dot, index) {
    dot.addEventListener("click", function () {
      // Always aim at the middle copy so the runway stays balanced.
      var top = (count + index) * slotH;
      // Handed to Lenis rather than assigned, so the wheel turns the whole way
      // round to the project instead of cutting to it.
      if (lenis) lenis.scrollTo(top, { force: true });
      else scroller.scrollTop = top;
      tick();
    });
  });

  window.addEventListener("pagehide", function () {
    sessionStorage.setItem(INDEX_KEY, String(active));
  });

  /* --- Start ------------------------------------------------------------- */

  measure();

  var start = parseInt(sessionStorage.getItem(INDEX_KEY), 10);
  if (!(start >= 0 && start < count)) start = 0;
  jump((count + start) * slotH);

  settle();

  /* Coming back from a project, transitions.js flies its hero onto whichever
     card is in focus — and only this file can say which of the 33 slots that
     is, or where the loop has left it on screen. */
  window.__wheel = {
    focusedImage: function () {
      return images[activeSlot] || null;
    }
  };
})();
