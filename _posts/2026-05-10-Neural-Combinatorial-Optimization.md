---
title: Neural Combinatorial Optimization
description: Teaching a network to help a 30-year-old heuristic solve vehicle routing — and finding out where that helps and where it doesn't.
author: Leo Sun
date: 2026-05-10
end_date: 2026-05-31
slug: neural-combinatorial-optimization
display: true
tile_order: 3
years: "Jan 2026 - May 2026"
image:
  path: /assets/img/20260510NCO/cvrp.gif
  alt: Animated CVRP tour being optimized over successive trials
preview_image:
  path: /assets/img/20260510NCO/cvrp-fast.gif
  alt: Animated CVRP tour optimization
---

## The question
The Capacitated Vehicle Routing Problem asks for the cheapest set of delivery routes from a depot to a hundred customers, with every vehicle respecting a load limit. It is NP-hard, and the strongest practical answer to it is not a neural network — it is LKH, a Lin-Kernighan-Helsgaun local search that has been sharpened for three decades.

So the question I spent five months on was not *can a network solve CVRP*. It was narrower and more interesting: **can a learned policy make LKH itself better?**

LKH improves a tour by repeatedly wrecking it a little and repairing it. The wrecking step — the perturbation — is random. That randomness is the obvious place to put a network, and the loop it sits in looks like this.

[View the code on GitHub](https://github.com/lleosunn/nco)

<figure>
<svg class="dg" viewBox="0 0 760 212" role="img" aria-label="The improvement loop: current best tour A is perturbed into B by the policy, LKH repairs B into C, C is merged into a new best D, and the loop repeats.">
  <defs>
    <marker id="loop-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path class="head" d="M 0 0 L 10 5 L 0 10 z"/>
    </marker>
  </defs>

  <rect class="box" x="10" y="46" width="140" height="66" rx="8"/>
  <text class="t-tag t-mut" x="24" y="68">A</text>
  <text class="t-sm t-mid" x="80" y="94">current best tour</text>

  <rect class="box box--key" x="210" y="46" width="140" height="66" rx="8"/>
  <text class="t-tag t-mut" x="224" y="68">B</text>
  <text class="t-sm t-mid t-key" x="280" y="94">perturbed tour</text>

  <rect class="box" x="410" y="46" width="140" height="66" rx="8"/>
  <text class="t-tag t-mut" x="424" y="68">C</text>
  <text class="t-sm t-mid" x="480" y="94">LKH repairs it</text>

  <rect class="box" x="610" y="46" width="140" height="66" rx="8"/>
  <text class="t-tag t-mut" x="624" y="68">D</text>
  <text class="t-sm t-mid" x="680" y="94">merge, new best</text>

  <path class="link" d="M 152 79 L 204 79" marker-end="url(#loop-head)"/>
  <path class="link" d="M 352 79 L 404 79" marker-end="url(#loop-head)"/>
  <path class="link" d="M 552 79 L 604 79" marker-end="url(#loop-head)"/>

  <text class="t-tag t-mid t-key" x="178" y="36">POLICY</text>
  <text class="t-tag t-mid t-mut" x="378" y="36">LKH</text>
  <text class="t-tag t-mid t-mut" x="578" y="36">MERGE</text>

  <path class="link link--dash" d="M 680 114 L 680 156 Q 680 168 668 168 L 92 168 Q 80 168 80 156 L 80 122" marker-end="url(#loop-head)"/>
  <text class="t-sm t-mid t-mut" x="380" y="163">next trial</text>

  <text class="t-sm t-mid t-mut" x="380" y="200">the policy owns one arrow; the reward is cost(A) − cost(D)</text>
</svg>
<figcaption>Only the first arrow is learnable. LKH keeps ownership of feasibility, repair, and local search.</figcaption>
</figure>

---

## Teaching the network what LKH does
Before learning to perturb, I tried the simpler thing: learn to imitate LKH's improvements outright.

I generated CVRP instances with RL4CO's `CVRPGenerator` — 100 customers, 1000 improvement trials per run — and ran LKH on them with tracking enabled. Parsing those tracking files gives a stream of before/after tour pairs: the tour LKH held at trial *t*, and the better tour it held at *t+1*. That is a supervision signal for free.

Each pair became a training example: tours as tensors, an adjacency matrix per solution, and a label marking which node connections changed between before and after. The model is a hierarchical CVRP policy — an N2S-style encoder over node and edge features, three layers of self-attention, and a decoder that emits a tour, with both greedy and sampling decode modes.

Getting it to overfit a single instance worked early and confirmed the plumbing. The interesting part was what happened when it met LKH inside the search loop.

---

## Two very different ways to change a tour
This distinction turned out to explain nearly every result that followed, so it's worth drawing.

<figure>
<svg class="dg" viewBox="0 0 760 290" role="img" aria-label="Left: LKH removes two tour edges and adds two, leaving the rest intact. Right: the network embeds all nodes, applies self-attention, scores an adjacency matrix and decodes a complete new tour.">
  <defs>
    <marker id="arch-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path class="head" d="M 0 0 L 10 5 L 0 10 z"/>
    </marker>
  </defs>

  <text class="t-sm t-mid t-key" x="178" y="20">LKH · edits</text>
  <text class="t-sm t-mid t-key" x="582" y="20">Network · rebuilds</text>

  <line class="rule" x1="380" y1="34" x2="380" y2="268"/>

  <path class="link link--dash" d="M 100 110 L 280 216"/>
  <path class="link link--dash" d="M 280 110 L 100 216"/>
  <path class="link" d="M 100 110 L 280 110" stroke-width="2.5"/>
  <path class="link" d="M 100 216 L 280 216" stroke-width="2.5"/>

  <circle class="node" cx="100" cy="110" r="6"/>
  <circle class="node" cx="280" cy="110" r="6"/>
  <circle class="node" cx="100" cy="216" r="6"/>
  <circle class="node" cx="280" cy="216" r="6"/>

  <text class="t-tag t-mid t-mut" x="190" y="96">ADDED</text>
  <rect class="knock" x="146" y="153" width="88" height="18" rx="2"/>
  <text class="t-tag t-mid t-mut" x="190" y="167">REMOVED</text>
  <text class="t-sm t-mid t-mut" x="190" y="262">two edges out, two in —</text>
  <text class="t-sm t-mid t-mut" x="190" y="278">the rest of the tour survives</text>

  <rect class="box" x="430" y="46" width="304" height="34" rx="6"/>
  <text class="t-sm t-mid" x="582" y="68">node + edge embeddings</text>
  <rect class="box" x="430" y="102" width="304" height="34" rx="6"/>
  <text class="t-sm t-mid" x="582" y="124">3 × self-attention</text>
  <rect class="box" x="430" y="158" width="304" height="34" rx="6"/>
  <text class="t-sm t-mid" x="582" y="180">adjacency scores</text>
  <rect class="box box--key" x="430" y="214" width="304" height="34" rx="6"/>
  <text class="t-sm t-mid t-key" x="582" y="236">decode a whole new tour</text>

  <path class="link" d="M 582 82 L 582 96" marker-end="url(#arch-head)"/>
  <path class="link" d="M 582 138 L 582 152" marker-end="url(#arch-head)"/>
  <path class="link" d="M 582 194 L 582 208" marker-end="url(#arch-head)"/>

  <text class="t-sm t-mid t-mut" x="582" y="279">every edge is decided again from scratch</text>
</svg>
<figcaption>LKH is edit-based; the network is generative. They are not doing the same job, even when they are pointed at the same tour.</figcaption>
</figure>

---

## Putting the network inside the solver
Imitating LKH offline is only half a claim. The real test is online: does the solver get better when the network is wired into its loop?

That meant patching LKH itself. I added a neural callback to the C source — `nn_callback.o` and `FindTourWithNN.o` — so that at each trial LKH hands its current tour to the network and takes back a proposal. If the proposal is cheaper than the incumbent, LKH accepts it; if not, LKH falls back to its own perturbation and merges as usual.

An early version accepted the network's tour unconditionally, which produced a bizarre sawtooth in every plot. Fixing the accept rule cleaned that up, and on a handful of instances the network genuinely started winning.

<div class="table-scroll">
<table class="data-table">
  <thead>
    <tr><th>Instance</th><th>LKH baseline</th><th>LKH + network</th><th>Δ</th></tr>
  </thead>
  <tbody>
    <tr><td>0</td><td>1,316,407</td><td class="win">1,301,936</td><td>−1.1%</td></tr>
    <tr><td>1</td><td>1,881,923</td><td class="win">1,877,234</td><td>−0.2%</td></tr>
    <tr><td>2</td><td class="win">1,592,379</td><td>1,600,879</td><td>+0.5%</td></tr>
    <tr><td>3</td><td class="win">1,554,463</td><td>1,571,381</td><td>+1.1%</td></tr>
    <tr><td>4</td><td class="win">1,759,140</td><td>1,788,439</td><td>+1.7%</td></tr>
    <tr><td>5</td><td class="win">1,263,915</td><td>1,269,911</td><td>+0.5%</td></tr>
    <tr><td>6</td><td>1,565,304</td><td class="win">1,562,655</td><td>−0.2%</td></tr>
    <tr><td>7</td><td class="win">1,809,913</td><td>1,820,645</td><td>+0.6%</td></tr>
  </tbody>
</table>
</div>
<p class="table-note">Final tour cost after 1000 trials; lower is better, bold is the winner. Three of eight — encouraging enough to be misleading.</p>

Eight instances is not evidence. Running the same comparison across a hundred is, and the picture got considerably less flattering.

<figure>
  <div class="plate">
    <img src="/assets/img/20260510NCO/cost-gap-fallback.png" alt="Two histograms over 100 instances: cost gap between network and LKH centred slightly above break-even at a mean of 0.39 percent, and LKH fallback rate centred at 23.5 percent">
  </div>
  <figcaption>Left: cost gap over 100 instances, mean +0.39% (positive means the network's run finished worse). Right: how often LKH had to rescue a bad proposal — 23.5% of trials on average.</figcaption>
</figure>

<div class="stat-row">
  <div class="stat"><div class="stat__value">31</div><div class="stat__label">wins out of 100 instances</div></div>
  <div class="stat"><div class="stat__value">+0.39%</div><div class="stat__label">mean cost gap vs. baseline LKH</div></div>
  <div class="stat"><div class="stat__value">23.5%</div><div class="stat__label">of trials fell back to LKH</div></div>
</div>

I trained several variants to try to close that gap. A dual setup used one model on early trials and another on late ones, on the theory that improving a rough tour and polishing a good one are different skills. A single "wide" model trained across trials 200–1000 covered both. And a refinement variant fed the network its own output three times before handing off.

<figure>
<svg class="dg" viewBox="0 0 760 206" role="img" aria-label="Win, tie and loss counts out of 100 instances. Wide NN one iteration: 31 wins, 4 ties, 65 losses. Dual NN: 31 wins, 1 tie, 68 losses. Wide NN with three-iteration refine: 25 wins, 0 ties, 75 losses.">
  <rect class="bar-win" x="235" y="8" width="12" height="12" rx="2"/>
  <text class="t-sm" x="253" y="18">wins</text>
  <rect class="bar-tie" x="308" y="8" width="12" height="12" rx="2"/>
  <text class="t-sm" x="326" y="18">ties</text>
  <rect class="bar-loss" x="374" y="8" width="12" height="12" rx="2"/>
  <text class="t-sm" x="392" y="18">losses</text>

  <text class="t-sm" x="0" y="69">Wide · 1 iter</text>
  <rect class="bar-win" x="205" y="46" width="170.5" height="36"/>
  <rect class="bar-tie" x="375.5" y="46" width="22" height="36"/>
  <rect class="bar-loss" x="397.5" y="46" width="357.5" height="36"/>
  <text class="bar-num t-mid" x="290" y="69">31</text>
  <text class="bar-num bar-num--out t-mid" x="576" y="69">65</text>

  <text class="t-sm" x="0" y="123">Dual · early + late</text>
  <rect class="bar-win" x="205" y="100" width="170.5" height="36"/>
  <rect class="bar-tie" x="375.5" y="100" width="5.5" height="36"/>
  <rect class="bar-loss" x="381" y="100" width="374" height="36"/>
  <text class="bar-num t-mid" x="290" y="123">31</text>
  <text class="bar-num bar-num--out t-mid" x="568" y="123">68</text>

  <text class="t-sm" x="0" y="177">Wide · 3-iter refine</text>
  <rect class="bar-win" x="205" y="154" width="137.5" height="36"/>
  <rect class="bar-loss" x="342.5" y="154" width="412.5" height="36"/>
  <text class="bar-num t-mid" x="273" y="177">25</text>
  <text class="bar-num bar-num--out t-mid" x="549" y="177">75</text>
</svg>
<figcaption>None of the three variants crossed the line. Refinement — the one that leaned hardest on the network — was clearly the worst.</figcaption>
</figure>

---

## Why it lost
The failures were more informative than the wins, and they were specific.

**Refeeding is out-of-distribution.** The three-iteration refine variant was the biggest disappointment and the clearest lesson. The network was trained on pairs where the input was an *LKH-perturbed* tour. Its own output is not that. The second pass is already operating on data it never saw in training, and the third is worse — which is exactly what the 25/0/75 line shows.

**Fallback stayed flat.** If the network were slowly learning, LKH would rescue it less often as trials went on. It doesn't.

<figure>
  <div class="plate">
    <img src="/assets/img/20260510NCO/fallback-vs-trials.png" alt="LKH fallback count per trial across 1000 trials, oscillating around a flat mean of 25.1 out of 100 with no downward drift">
  </div>
  <figcaption>Fallback count across 1000 trials, averaged over 100 instances. The mean sits at 25.1 and does not drift. The network is not degrading — it is simply not good enough, consistently.</figcaption>
</figure>

**Sampling didn't rescue greedy decoding.** Decoding 8 samples and taking the best made things worse, not better. The model was trained for greedy decoding, and sampling picks nodes without looking ahead, which can walk into capacity violations that greedy avoids.

**The two systems don't even represent a tour the same way.** The network treats the depot as node 0 and separates routes by repeating it. LKH creates depot *copies* — nodes 102, 103, 104 and so on. Every exchange crosses that translation, and it was a steady source of bugs.

Underneath all four is the mismatch from the diagram above. Asking a network to emit a complete, capacity-feasible, 100-customer tour is an enormous ask, and it has to clear that bar on every single trial just to break even with a solver that only ever edits two edges at a time.

---

## Pivoting: learn the perturbation, not the tour
So I stopped asking the network for a finished tour and went back to the loop diagram. The policy only needs to own the first arrow — A to B. LKH is better at everything downstream, so let it keep that work.

This inverts the integration. Online evaluation had LKH's C loop calling into Python; RL training needs Python's loop calling LKH.

<div class="table-scroll">
<table class="data-table">
  <thead>
    <tr><th></th><th>Online eval</th><th>RL training</th></tr>
  </thead>
  <tbody>
    <tr><td>Who drives</td><td>LKH's loop</td><td>Python's loop</td></tr>
    <tr><td>Direction</td><td>C calls Python</td><td>Python calls C</td></tr>
    <tr><td>Transport</td><td>shared memory, 1 process</td><td>files on disk, 2 processes</td></tr>
    <tr><td>Latency</td><td>microseconds</td><td>~100–300 ms per call</td></tr>
    <tr><td>Cost to build</td><td>patch LKH's C source</td><td>no C changes at all</td></tr>
  </tbody>
</table>
</div>

I built the second path: `lkh_wrapper.py` makes LKH callable from Python — writing `.par` files, running the binary as a subprocess, parsing `.tour` output, cleaning up its temp directories. `lkh_env.py` wraps that as an environment where `reset()` picks an instance and warms up a starting tour, and `step()` scores whatever tour the policy produced. Reward is simply `cost(A) − cost(D)`: how much better the solution got after the network's perturbation, LKH's repair, and the merge.

I deliberately did not use a Gymnasium space here. The action is a variable-length sequence of node IDs forming a valid CVRP tour, which doesn't fit a fixed discrete or continuous space cleanly.

The policy is initialized from the imitation model rather than from scratch — it already knows how to read a CVRP instance, encode a tour, and respect capacity, even though it was never trained to perturb. Training runs the network twice on the same input, once sampling and once greedy, and uses the difference as the advantage: if the sampled tour beat the greedy one, make those sampled actions more likely.

Five unit tests cover the seams that actually break — tour format round-trips preserving every customer, the wrapper producing valid `.par` files and parsing results back, LKH never returning worse than its warm-up, rewards never going stale, and the environment's types staying consistent.

<figure>
  <div class="plate">
    <img src="/assets/img/20260510NCO/rl-reward-curves.png" alt="Four panels from the reinforcement learning run: rolling mean reward trending upward and crossing zero, mean reward by 1000-step bin turning positive after step 7000, rolling improvement rate climbing from 30 to 75 percent, and reward distributions for the first and last 1000 steps">
  </div>
  <figcaption>10,000 steps of A→B perturbation training. Mean reward per 1000-step bin climbs from −7,763 to +3,525 and crosses zero around step 7,000; the share of steps that improved the tour rises from roughly 30% to 72.8%.</figcaption>
</figure>

This is the most encouraging result in the project. The policy is measurably learning to perturb — improvement rate more than doubles, and mean reward goes from firmly negative to positive. It is still not beating LKH's own perturbation end to end, and the run is noisy, but it is the first time the learning signal pointed clearly in the right direction.

---

## Neural Deconstruction Search
The last idea shrank the action space further. Instead of emitting a perturbed tour at all, the network picks *which customers to remove* — sample M of them from the current best tour, let a greedy repair reinsert them, and hand the result to LKH.

That should be strictly easier to learn. The network decides only where to perturb, not how to rebuild, and greedy repair preserves most of the incumbent tour so the change stays local.

<figure>
  <div class="plate">
    <img src="/assets/img/20260510NCO/nds-reward-drift.png" alt="Mean reward over NDS training drifting from a positive first-1000-step average of 3,738 down to a negative last-1000-step average of −2,917">
  </div>
  <figcaption>It went the wrong way. The first 1,000 steps averaged +3,738; the last 1,000 averaged −2,917.</figcaption>
</figure>

It didn't work. The reward drifts downward over training rather than up, and I ran out of semester before diagnosing why. My leading suspicion is the reward: it is raw LKH improvement rather than an advantage measured against a greedy baseline, so the policy is chasing a signal dominated by which instance it happened to draw.

---

## Five months, in order

<figure>
<svg class="dg" viewBox="0 0 760 196" role="img" aria-label="Timeline from January to May 2026: collect LKH trajectories, early and late two-model split, hundred-instance online validation, RL environment around LKH, then full-tour RL and neural deconstruction search.">
  <line class="rule" x1="50" y1="104" x2="716" y2="104"/>

  <circle class="node" cx="88" cy="104" r="5"/>
  <text class="t-tag t-mid t-key" x="88" y="46">JAN</text>
  <text class="t-sm t-mid t-mut" x="88" y="66">Collect LKH</text>
  <text class="t-sm t-mid t-mut" x="88" y="81">trajectories</text>

  <circle class="node--open" cx="236" cy="104" r="5"/>
  <text class="t-tag t-mid t-key" x="236" y="136">FEB</text>
  <text class="t-sm t-mid t-mut" x="236" y="156">Early + late</text>
  <text class="t-sm t-mid t-mut" x="236" y="171">two-model split</text>

  <circle class="node--open" cx="384" cy="104" r="5"/>
  <text class="t-tag t-mid t-key" x="384" y="46">MAR</text>
  <text class="t-sm t-mid t-mut" x="384" y="66">100-instance</text>
  <text class="t-sm t-mid t-mut" x="384" y="81">online validation</text>

  <circle class="node--open" cx="532" cy="104" r="5"/>
  <text class="t-tag t-mid t-key" x="532" y="136">APR</text>
  <text class="t-sm t-mid t-mut" x="532" y="156">RL environment</text>
  <text class="t-sm t-mid t-mut" x="532" y="171">around LKH</text>

  <circle class="node" cx="680" cy="104" r="5"/>
  <text class="t-tag t-mid t-key" x="680" y="46">MAY</text>
  <text class="t-sm t-mid t-mut" x="680" y="66">Full-tour RL,</text>
  <text class="t-sm t-mid t-mut" x="680" y="81">then NDS</text>
</svg>
<figcaption>The arc runs from imitating the solver's output to learning one narrow decision inside it.</figcaption>
</figure>

---

## Takeaways
The headline result is negative, and I think it is the useful kind.

**Generating a whole solution is the wrong division of labour.** A mature solver enforces feasibility, repairs damage, and searches locally, all of it cheaply and correctly. Asking a network to reproduce all of that end-to-end means competing with thirty years of tuning on every single trial. Asking it to make one decision the solver currently makes at random is a far better bet — and the perturbation results are the only place the learning curve pointed the right way.

**Offline imitation accuracy says almost nothing about online usefulness.** The model demonstrably learned recognizable LKH behaviour. It still lost 68 times out of 100 in deployment. The two metrics were close to uncorrelated, and I trusted the first one for longer than I should have.

**The instrumentation was worth more than the model.** The flat fallback curve is what told me the network wasn't slowly improving. The refeed collapse is what identified the distribution shift. Without those, I would have kept tuning hyperparameters against a problem that wasn't in the hyperparameters.

Technologies used:

- Python, PyTorch, TensorDict
- RL4CO and TorchRL-style routing environments
- LKH 3.0.13, with a neural callback patched into its C source
- CVRP data processing, imitation learning, and policy-gradient RL
