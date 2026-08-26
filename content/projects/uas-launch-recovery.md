---
title: UAS Launch & Recovery
description: Autonomous launch and recovery of unmanned aerial systems from unmanned surface vehicles.
author: Leo Sun
date: 2026-06-01
end_date: 9999-12-31
slug: uas-launch-recovery
display: true
tile_order: 1
years: "Jun 2026 - Present"
image:
  path: /assets/img/20260601Seasats/uas-launch-recovery.jpg
  alt: Quadrotor on the deck of an unmanned surface vessel at sea, with a second aircraft lifting off in the distance
---

## Overview
I am interning at [Seasats](https://www.seasats.com/), where I work on autonomous launch and recovery of unmanned aerial systems from unmanned surface vehicles.

The goal is to give Seasats' autonomous surface vessels an eye in the sky. A drone rides on the boat, launches on its own, flies out to look around and identify objects in the water, and then lands itself back on the boat — with no human in the loop on either vehicle. The target grew over the summer: it started as a single drone launching from and landing on a Lightfish, and expanded into deploying a swarm from a QuickFish.

One of the problems was a launching and recovering on a moving platform. The deck the aircraft has to leave from and return to is a small boat that pitches, rolls, and heaves with the sea state, so launch and recovery have to be handled as a coordinated behavior between the two vehicles rather than as an aircraft-only maneuver.

Additionally, our drones do not have onboard compute. Putting the computer on the boat instead keeps each aircraft light, extends its range, and makes it cheap enough to lose. It also creates the two problems most of this page is about: there is video latency between the drone's FPV camera and the ground station, and there is control latency, because every command reaches the flight controller through a USB radio link rather than a wire.

<figure>
  <div class="video-embed">
    <iframe
      src="https://www.youtube-nocookie.com/embed/veYp26BeuB0"
      title="Autonomous drone launch and recovery from a Seasats QuickFish"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen>
    </iframe>
  </div>
  <figcaption>Launching and recovering drones from a QuickFish.</figcaption>
</figure>


---

## My Role
I worked on this as a software developer and owned the drone stack end to end: communication between Python and the aircraft, a Gazebo simulation environment to test and validate against, a custom launch sequence, motion planning, the computer vision — camera calibration, the landing marker, and tag detection — the precision landing algorithm all of that fed into, and the integration with the Seasats UI.

---

## Talking to the Drones
PX4, the flight stack running on each aircraft, communicates over MAVLink. QGroundControl is the usual MAVLink client — a GUI for setting positions and parameters by hand — but the whole point here is that no human is doing that in flight. I used MAVSDK, which wraps MAVLink in asynchronous Python, so the boat-side computer can talk to the drones programmatically.

Almost everything custom happens in offboard mode, where PX4 hands control of the setpoints to an external computer instead of flying its own mission. That is the seam the launch sequence, the waypoint navigation, and the landing controller all live in.

---

## Simulation
Having a simulator is always worth it before running anything on a real aircraft — every hour spent in sim raises the odds that the first real flight is uneventful. I used Gazebo, mainly because PX4 already integrates with it and runs *the same flight code* in simulation that it runs on the aircraft. A controller that behaves in sim is being judged by the same autopilot that will eventually fly it.

I built a boat platform with an AprilTag on its deck, driven by simulated wave motion, and flew a drone down onto it. That world is where the landing controller was developed, and where every change to it got tested before it went anywhere near hardware.

<figure>
  <div class="video-embed">
    <iframe
      src="https://www.youtube-nocookie.com/embed/Q-nUwcTQl5w"
      title="Simulated drone landing on a moving boat platform in Gazebo"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen>
    </iframe>
  </div>
  <figcaption>Landing on a wave-driven platform in the Gazebo boat world.</figcaption>
</figure>

---

## Launch
A drone stowed on a boat has to clear a hatch on the way out, and PX4's normal takeoff command is not built for that. It climbs under closed-loop control at a rate the autopilot picks, which is smooth, well-behaved, and far too slow when what you want is to be out of the opening before the boat rolls.

So instead of sending a takeoff command, I put the drone into offboard attitude control and commanded thrust directly. That gives an open-loop punch straight up at whatever thrust I ask for, and the aircraft hands off to position control once it is clear of the boat.

<figure>
  <div class="video-embed">
    <iframe
      src="https://www.youtube-nocookie.com/embed/BwAxbgIWS10"
      title="Custom offboard attitude launch"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen>
    </iframe>
  </div>
  <figcaption>The custom launch — open-loop thrust in offboard attitude mode.</figcaption>
</figure>


---

## Waypoint Navigation
Getting the drone somewhere is the simple part of the stack. It takes a latitude, longitude, and altitude, and flies a straight line to that point in the world as a stream of position setpoints. Everything harder — sweeping an area, staging over the boat before a descent — is built on top of this one primitive.

<figure>
  <div class="video-embed">
    <iframe
      src="https://www.youtube-nocookie.com/embed/jM_yJs_0mKU"
      title="Drone flying to a commanded latitude, longitude, and altitude"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen>
    </iframe>
  </div>
  <figcaption>Flying to a commanded lat/lon/alt.</figcaption>
</figure>

---

## Precision Landing
This is where most of the summer went, and it took about a month to get right.

The target is an AprilTag landing board I designed for the deck. A single tag does not survive a whole descent: at altitude a large tag is the only thing detectable at all, and near touchdown that same tag overflows the frame and stops decoding. So the board carries one large tag alongside a set of smaller ones at known offsets, and the detector always reports the large tag's center — directly when it can see it, and reconstructed from whichever small tags are still in frame when it cannot.

Before any of that means anything in metres, the camera has to be calibrated. I shot checkerboard images through the exact camera, resolution, and capture path used in flight, and solved for the intrinsics. The FPV lens is close to a 160° fisheye, so a pinhole model diverges badly and the fisheye model is not optional. A calibration taken through a different path than the one that flies is not a calibration.

Detection then produces a tag pose relative to the camera, and that is the input to the landing controller. The pipeline is a chain, and the shape of it is the part worth drawing:

<figure>
<svg class="dg" viewBox="0 0 760 232" role="img" aria-label="The precision landing chain: the camera produces a relative tag error, a tag position filter turns it into a position setpoint, PX4's position controller turns that into a velocity setpoint, PX4's velocity controller turns that into thrust, and the drone moves — which changes what the camera sees, closing the loop.">
  <defs>
    <marker id="land-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path class="head" d="M 0 0 L 10 5 L 0 10 z"/>
    </marker>
  </defs>

  <rect class="box" x="10" y="64" width="120" height="72" rx="8"/>
  <text class="t-sm t-mid" x="70" y="105">camera</text>

  <rect class="box box--key" x="160" y="64" width="120" height="72" rx="8"/>
  <text class="t-sm t-mid t-key" x="220" y="96">tag position</text>
  <text class="t-sm t-mid t-key" x="220" y="114">filter</text>

  <rect class="box" x="310" y="64" width="120" height="72" rx="8"/>
  <text class="t-sm t-mid" x="370" y="96">PX4 position</text>
  <text class="t-sm t-mid" x="370" y="114">controller</text>

  <rect class="box" x="460" y="64" width="120" height="72" rx="8"/>
  <text class="t-sm t-mid" x="520" y="96">PX4 velocity</text>
  <text class="t-sm t-mid" x="520" y="114">controller</text>

  <rect class="box" x="610" y="64" width="120" height="72" rx="8"/>
  <text class="t-sm t-mid" x="670" y="96">drone</text>
  <text class="t-sm t-mid" x="670" y="114">movement</text>

  <path class="link" d="M 132 100 L 154 100" marker-end="url(#land-head)"/>
  <path class="link" d="M 282 100 L 304 100" marker-end="url(#land-head)"/>
  <path class="link" d="M 432 100 L 454 100" marker-end="url(#land-head)"/>
  <path class="link" d="M 582 100 L 604 100" marker-end="url(#land-head)"/>

  <text class="t-tag t-mid t-mut" x="145" y="40">RELATIVE</text>
  <text class="t-tag t-mid t-mut" x="145" y="53">TAG ERROR</text>
  <text class="t-tag t-mid t-key" x="295" y="40">POSITION</text>
  <text class="t-tag t-mid t-key" x="295" y="53">SETPOINT</text>
  <text class="t-tag t-mid t-mut" x="445" y="40">VELOCITY</text>
  <text class="t-tag t-mid t-mut" x="445" y="53">SETPOINT</text>
  <text class="t-tag t-mid t-mut" x="595" y="53">THRUST</text>

  <path class="link link--dash" d="M 670 138 L 670 180 Q 670 192 658 192 L 82 192 Q 70 192 70 180 L 70 146" marker-end="url(#land-head)"/>
  <text class="t-sm t-mid t-mut" x="370" y="187">the drone moves, the tag shifts in frame, and it starts again</text>

  <text class="t-sm t-mid t-mut" x="370" y="222">my code owns the first two boxes; PX4 owns the rest</text>
</svg>
<figcaption>The handoff is the design decision. Everything upstream of the position setpoint is mine; everything downstream is PX4 doing what it is already good at.</figcaption>
</figure>

Three findings did most of the work.

**A downward camera beats a forward-slanted one.** A tag directly beneath the aircraft is exactly where it needs to be readable at the end of a descent, and a slanted camera loses it precisely there.

**Position setpoints beat velocity setpoints.** Commanding velocity on top of PX4's own position loop puts two controllers on the same axis, arguing. Handing PX4 a position and letting its loop do the work is what made landings repeatable, and it is why the diagram above hands off where it does.

**Every camera frame has to be time-aligned to the flight controller's state at the instant of capture,** not the instant the detection finished. A tag pose is only true for the moment the shutter was open, and with video latency in the loop those are not the same moment. Fusing each detection against interpolated position and attitude at capture time — rather than against whatever the drone happened to be doing when the CPU got around to it — was worth more than making the detector faster. By mid-July the controller was landing 8 times out of 10, with the last half-metre the hardest part of the descent.

<div class="video-pair">
  <figure>
    <div class="video-embed video-embed--portrait">
      <iframe
        src="https://www.youtube-nocookie.com/embed/aEy-JjpYn-k"
        title="Tuning the AprilTag precision landing"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen>
      </iframe>
    </div>
    <figcaption>Tuning the AprilTag descent, in timelapse.</figcaption>
  </figure>
  <figure>
    <div class="video-embed video-embed--portrait">
      <iframe
        src="https://www.youtube-nocookie.com/embed/3O8zffdPlNA"
        title="Autonomous takeoff and landing in the payload box prototype"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen>
      </iframe>
    </div>
    <figcaption>Launching from and landing back into the payload box prototype.</figcaption>
  </figure>
</div>

---

## Swarm
Once one drone could launch, navigate, and land itself, we scaled to several. The idea that made it tractable was to stop thinking about the drones individually and treat the swarm as a single body: a commanded world coordinate moves the *centroid* of the formation, and each drone holds a fixed offset from that center.

Everything built for one aircraft then applies unchanged. A goto command sweeps the centroid toward the target and every drone follows its own offset across; the formation geometry becomes a purely geometric problem that never has to reach into the flight code. Separation between aircraft is a property of the offsets rather than something a controller has to negotiate in the air.

<figure>
  <div class="video-embed">
    <iframe
      src="https://www.youtube-nocookie.com/embed/CHDhhl4Fhkk"
      title="Simulated drone swarm launch, formation, and recovery in Gazebo"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen>
    </iframe>
  </div>
  <figcaption>Swarm launch, formation, and recovery in Gazebo.</figcaption>
</figure>

<figure>
  <div class="video-embed">
    <iframe
      src="https://www.youtube-nocookie.com/embed/_OTEOhXEYk8"
      title="Four drones launching and landing together"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen>
    </iframe>
  </div>
  <figcaption>Four drones in the air at once.</figcaption>
</figure>


---

## Future Work
The core building blocks all work — autonomous launch, live video, marker-based precision landing, and the command pipeline end to end. A four-drone swarm flew launch and landing on land, a two-drone swarm launched off a QuickFish, and we recovered a drone onto the QuickFish by hand. What is left is the list I would work down next.

1. **YOLO for object detection in the water.** Giving the search leg something to actually find rather than just a pattern to fly. The catch is that a stock detector is a viewpoint classifier as much as an object classifier — a hull seen straight down is out of distribution however many pixels it covers — so this is a fine-tune on maritime imagery, not a threshold change.
2. **Test autonomous landing on the boat.** The one thing we did not get to, purely on time. It is also the highest-risk unproven piece and the one the whole mission ends with, so it is the first thing I would fly.
3. **Build and test a larger airframe that carries its own compute.** Putting the computer back on the aircraft removes the video and control latency that most of this page is about, at the cost of the cheapness that made losing one acceptable.
4. **Fly larger fleets.** The centroid model was built so that adding aircraft is a matter of adding offsets rather than of changing the flight code, and that is the part worth proving out at scale.

## Reflections
The biggest thing I took from this summer is that none of it was going to be reasoned into working. The schedule was really set by how many flights we got, so we tested early and often, and I stopped worrying about crashing. Every crash during testing is one that doesn't happen during the run that matters. The trick is keeping a few beater drones around that you can rebuild in an afternoon, because what a crash actually costs you is the next few days of not flying. I also learned to freeze the code before a deadline. The change that makes it slightly better is also the change nobody has flown. And I also learned that simple is better, in both hardware and software. Every time this project got into trouble, it was because something had more moving parts than the job really needed. This was a really fun internship. I don't think a lot of interns get this much ownership over a project, or get to work on something this cool. We picked our own drone parts, built the drones ourselves, and wrote the whole stack from scratch, and it ended up working. Hard to ask for much more out of a summer.
