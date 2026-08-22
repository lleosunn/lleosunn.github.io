/* Page transitions: a fade out, a fade in, and a card that flies between the
   two documents.

   These are real navigations, not a router — the pages are still separate
   documents and the browser still loads them. What this file adds is the
   choreography around the seam: the outgoing page is given time to fade before
   the address changes, the incoming one plays itself in, and the geometry of
   whatever you clicked is written to sessionStorage so the next document can
   pick the image up where the last one left it.

   The browser has a native version of this — cross-document view transitions —
   and it is a line of CSS. It is also Chromium-and-Safari-only, which meant
   Firefox got a hard cut where everything else got a morph. Doing it here costs
   this file but the behaviour is the same everywhere. */
(function () {
  var root = document.documentElement;
  var body = document.body;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.remove("is-entering", "is-hero-in", "is-flat");
    return;
  }

  var HERO_KEY = "hero-flight";
  var LEAVE_MS = 240;
  var ENTER_MS = 600;
  var LAND_MS = 180;
  var EASE = "cubic-bezier(0.075, 0.82, 0.165, 1)";

  // Read rather than assumed, so a baseurl in _config.yml cannot silently turn
  // the home page into an ordinary destination.
  var homePath = (function () {
    var link = document.querySelector('.icon-row a[aria-label="Home"]');
    return link ? new URL(link.href).pathname : "/";
  })();

  var projectHero = function () {
    return document.querySelector(".project__media img, .project__media video");
  };

  var store = function (key, value) {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch (e) {
      /* Private-mode quota. Worst case the flight is skipped. */
    }
  };

  /* --- The flying element -------------------------------------------------

     One <img> pinned to the viewport outside .shell, so the shell's fade never
     touches it. Both documents build it the same way; the difference is only
     whether it is holding still or travelling. */

  var makeFlyer = function (shot) {
    var img = document.createElement("img");
    img.className = "hero-fly";
    img.src = shot.src;
    img.alt = "";
    img.setAttribute("aria-hidden", "true");
    // The source was on screen a moment ago, so it is in cache; decoding it on
    // the spot avoids handing over a frame of empty box.
    img.decoding = "sync";
    img.style.objectPosition = shot.position;
    return img;
  };

  // Everything the other document needs to redraw this element where it stands.
  var capture = function (el) {
    if (!el) return null;
    var box = el.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    var style = getComputedStyle(el);
    var src = el.tagName === "VIDEO" ? el.poster : el.currentSrc || el.src;
    if (!src) return null;
    /* Every card but the focused one is scaled down by nav.js, and a scaled
       corner is not the corner its stylesheet declares. The rect is already the
       visual one — getBoundingClientRect composes the transform — so the radius
       has to be put on the same footing or a card clicked from the rim takes
       off rounder than it looked. */
    var drawn = el.offsetWidth ? box.width / el.offsetWidth : 1;
    return {
      src: src,
      top: box.top,
      left: box.left,
      width: box.width,
      height: box.height,
      radius: (parseFloat(style.borderTopLeftRadius) || 0) * drawn,
      position: style.objectPosition
    };
  };

  /* The flight. The flyer is laid out on the DESTINATION box and transformed
     back onto the source, so the frame it ends on is the frame the page
     already wanted and there is no rounding to reconcile at the landing.

     The scale is uniform, always: a photo stretched between a near-square card
     and a wide banner is the one thing that gives a morph away. The two boxes
     rarely share an aspect ratio, and that difference is taken up by a clip
     instead — at the start the flyer is masked down to the source's shape, and
     the mask opens as it travels. Nothing inside is ever distorted; the window
     onto it widens. The corner radius rides in the same clip, divided by the
     scale so that it reads at the source's radius on the first frame. */
  var fly = function (shot, target) {
    var to = target.getBoundingClientRect();
    if (!to.width || !to.height) return null;

    var scale = Math.max(shot.width / to.width, shot.height / to.height);
    var insetX = (to.width - shot.width / scale) / 2;
    var insetY = (to.height - shot.height / scale) / 2;
    var dx = shot.left - to.left - scale * insetX;
    var dy = shot.top - to.top - scale * insetY;
    var endRadius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;

    var flyer = makeFlyer(shot);
    flyer.style.top = to.top + "px";
    flyer.style.left = to.left + "px";
    flyer.style.width = to.width + "px";
    flyer.style.height = to.height + "px";
    body.appendChild(flyer);

    var animation = flyer.animate(
      [
        {
          transform:
            "translate(" + dx + "px, " + dy + "px) scale(" + scale + ")",
          clipPath:
            "inset(" + insetY + "px " + insetX + "px " + insetY + "px " +
            insetX + "px round " + shot.radius / scale + "px)"
        },
        {
          transform: "none",
          clipPath: "inset(0px 0px 0px 0px round " + endRadius + "px)"
        }
      ],
      { duration: ENTER_MS, easing: EASE, fill: "both" }
    );

    return { node: flyer, animation: animation };
  };

  /* --- Arriving ----------------------------------------------------------- */

  var settled = function () {
    root.classList.remove("is-hero-in");
  };

  var enter = function () {
    var shot = null;
    try {
      shot = JSON.parse(sessionStorage.getItem(HERO_KEY));
    } catch (e) {
      /* Nothing stored, or stored by an older version of this file. */
    }
    store(HERO_KEY, null);
    if (!shot || !shot.src) return settled();

    // Where the flight is headed depends on which way it is going: into a
    // project it is that project's hero, back out it is whichever card the
    // wheel has left in focus, which only nav.js can say.
    var target =
      body.dataset.page === "home"
        ? window.__wheel && window.__wheel.focusedImage()
        : projectHero();
    if (!target) return settled();

    var land = function () {
      var flight = fly(shot, target);
      if (!flight) return settled();

      // Hidden inline before the guard class comes off, so the destination is
      // never briefly visible underneath its own flyer.
      target.style.visibility = "hidden";
      settled();

      var reveal = function () {
        target.style.visibility = "";
        flight.node.remove();
      };

      /* A flight aims at where its destination is standing now. Scroll the pane
         and the destination walks out from under it, so the first sign of a
         hand on the wheel cuts the flight to its landing rather than letting it
         finish somewhere the card no longer is. */
      var interrupt = function () {
        flight.animation.finish();
      };
      window.addEventListener("wheel", interrupt, { once: true, passive: true });
      window.addEventListener("touchstart", interrupt, { once: true, passive: true });

      flight.animation.finished.then(
        function () {
          target.style.visibility = "";
          /* A card's preview and a project's hero are not always the same file
             — two of these projects deliberately differ. The landing is a swap
             either way, so it is crossed rather than cut. */
          flight.node
            .animate([{ opacity: 1 }, { opacity: 0 }], {
              duration: LAND_MS,
              easing: "linear",
              fill: "forwards"
            })
            .finished.then(reveal, reveal);
        },
        reveal
      );
    };

    /* A project's hero is `height: auto`, so its box is not a measurement until
       its file is there — zero for an image, and worse for a video, which falls
       back to the 150px every replaced element gets when nothing has told it
       otherwise. A card is the opposite: the card sizes it, so it measures
       correctly on the first frame whether or not the picture has arrived.

       The wait is capped. Past a few hundred milliseconds the flight has missed
       its moment, and a plain fade reads better than a late morph. */
    var measurable = function () {
      var box = target.getBoundingClientRect();
      if (!box.width || !box.height) return false;
      if (!target.closest(".project__media")) return true;
      return target.tagName === "VIDEO"
        ? target.videoWidth > 0
        : target.complete && target.naturalWidth > 0;
    };

    var deadline = performance.now() + 400;
    var attempt = function () {
      if (measurable()) return land();
      if (performance.now() > deadline) return settled();
      requestAnimationFrame(attempt);
    };
    attempt();
  };

  /* --- Leaving ------------------------------------------------------------ */

  var leaving = false;

  var leave = function (href, source) {
    if (leaving) return;
    leaving = true;

    var shot = capture(source);
    if (shot) {
      store(HERO_KEY, JSON.stringify(shot));
      /* The shell fades, but the thing being handed over must not: the next
         document picks the flight up from exactly this rectangle, and a card
         that has already dimmed would be handed back at full strength. A copy
         pinned outside the shell holds the frame while everything else goes. */
      var held = makeFlyer(shot);
      held.style.top = shot.top + "px";
      held.style.left = shot.left + "px";
      held.style.width = shot.width + "px";
      held.style.height = shot.height + "px";
      held.style.borderRadius = shot.radius + "px";
      body.appendChild(held);
    }

    /* Leaving before the entry has finished playing. Dropping the class alone
       takes the running animation with it, and the exit transition then has no
       value to start from — the page cuts to nothing instead of fading. Pinning
       the live frame first, and committing it with a forced reflow, gives the
       transition somewhere to leave from. */
    var shell = document.querySelector(".shell");
    if (shell && root.classList.contains("is-entering")) {
      var live = getComputedStyle(shell);
      shell.style.opacity = live.opacity;
      shell.style.transform = live.transform;
      root.classList.remove("is-entering");
      void shell.offsetWidth;
      shell.style.opacity = "";
      shell.style.transform = "";
    }
    root.classList.remove("is-entering", "is-flat");
    root.classList.add("is-leaving");
    setTimeout(function () {
      window.location.href = href;
    }, LEAVE_MS);
  };

  // Only two navigations have something to hand over: a card into its project,
  // and a project's hero back onto its card.
  var handover = function (link, url) {
    var card = link.closest(".tile__card");
    if (card) return card.querySelector(".tile__image");
    if (url.pathname === homePath) return projectHero();
    return null;
  };

  /* --- Wiring -------------------------------------------------------------- */

  var internal = function (event) {
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link) return null;
    var url;
    try {
      url = new URL(link.href);
    } catch (e) {
      return null;
    }
    if (url.origin !== window.location.origin) return null;
    return { link: link, url: url };
  };

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    // A modified click is a request for a new tab or a saved file, not a move.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    var hit = internal(event);
    if (!hit) return;
    if (hit.link.target && hit.link.target !== "_self") return;
    if (hit.link.hasAttribute("download")) return;
    // The resume PDF hands off to the browser's own viewer, and an anchor is
    // not a navigation at all. Neither has a page to fade into.
    if (/\.[a-z0-9]{2,4}$/i.test(hit.url.pathname)) return;
    if (hit.url.href === window.location.href) return;
    if (hit.url.pathname === window.location.pathname && hit.url.hash) return;

    event.preventDefault();
    leave(hit.url.href, handover(hit.link, hit.url));
  });

  var warmed = {};
  document.addEventListener(
    "pointerover",
    function (event) {
      var hit = internal(event);
      if (!hit || warmed[hit.url.href]) return;
      // The loop clones put every project on the page three times, and the page
      // you are already on is in the icon row of every page including itself.
      if (hit.url.href === window.location.href) return;
      warmed[hit.url.href] = true;

      var tag = document.createElement("link");
      tag.rel = "prefetch";
      tag.href = hit.url.href;
      document.head.appendChild(tag);

      /* The document alone is not enough. The flight lands on the project's
         own hero, and a hero still downloading has no box to land on — so the
         card carries its path and it is warmed at the same time. */
      if (hit.link.dataset.hero) new Image().src = hit.link.dataset.hero;
    },
    { passive: true }
  );

  /* Back-navigation restores the document exactly as it was when it was
     snapshotted, which is mid-fade with a flyer still pinned to it. */
  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    leaving = false;
    root.classList.remove("is-leaving", "is-entering", "is-hero-in", "is-flat");
    var stale = document.querySelectorAll(".hero-fly");
    for (var i = 0; i < stale.length; i++) stale[i].remove();
  });

  /* --- Start --------------------------------------------------------------- */

  enter();

  /* The entry is a CSS animation with `both` fill rather than a class the page
     waits to have removed: if this file ever fails to load, the animation still
     runs and still ends on a visible page. Dropping the class afterwards only
     clears the way for the exit transition, so it can wait for the animation to
     be over. */
  setTimeout(function () {
    root.classList.remove("is-entering", "is-flat");
  }, ENTER_MS + 80);
})();
