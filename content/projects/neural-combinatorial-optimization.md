---
title: Neural Combinatorial Optimization
description: Exploring whether a learned policy can help a decades-old heuristic solve vehicle-routing problems—and where that approach falls short.
author: Leo Sun
date: 2026-05-10
end_date: 2026-05-31
slug: neural-combinatorial-optimization
display: true
tile_order: 4
years: "Jan 2026 - May 2026"
image:
  path: /assets/img/20260510NCO/cvrp-fast.gif
  alt: Animated CVRP tour being optimized over successive trials
---

## Overview
The Capacitated Vehicle Routing Problem (CVRP) adds a load limit to the standard vehicle-routing problem. Given a depot, a fleet of identical vehicles, and a set of customers awaiting deliveries, the goal is to minimize the fleet's total travel distance. Every route must begin and end at the depot, every customer must be served exactly once, and no vehicle can exceed its capacity. CVRP is a generalization of the traveling salesman problem: TSP is the special case with one vehicle and no binding capacity constraint. It also inherits TSP's difficulty—CVRP is NP-hard.

LKH is Keld Helsgaun's implementation of the local-search method introduced by Lin and Kernighan in 1973. LKH was released in 2000 and extended to capacity-constrained routing in 2017; I benchmarked against version 3.0.13.

The question I spent five months exploring was **Can a learned policy make LKH itself better?**

LKH improves a tour by repeatedly perturbing it and then repairing the damage. LKH's loop looks like this:

<figure>
<svg class="dg" viewBox="0 -62 760 274" role="img" aria-label="LKH's improvement loop: current best tour A is perturbed into B, local search repairs B into C, C is merged with A to give D, and D replaces A if it is cheaper.">
  <defs>
    <marker id="loop-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path class="head" d="M 0 0 L 10 5 L 0 10 z"/>
    </marker>
  </defs>

  <rect class="box" x="10" y="46" width="140" height="66" rx="8"/>
  <text class="t-tag t-mut" x="24" y="68">A</text>
  <text class="t-sm t-mid" x="80" y="94">current best tour</text>

  <rect class="box" x="210" y="46" width="140" height="66" rx="8"/>
  <text class="t-tag t-mut" x="224" y="68">B</text>
  <text class="t-sm t-mid" x="280" y="94">perturbed tour</text>

  <rect class="box" x="410" y="46" width="140" height="66" rx="8"/>
  <text class="t-tag t-mut" x="424" y="68">C</text>
  <text class="t-sm t-mid" x="480" y="94">LKH repairs it</text>

  <rect class="box" x="610" y="46" width="140" height="66" rx="8"/>
  <text class="t-tag t-mut" x="624" y="68">D</text>
  <text class="t-sm t-mid" x="680" y="94">merged tour</text>

  <path class="link" d="M 152 79 L 204 79" marker-end="url(#loop-head)"/>
  <path class="link" d="M 352 79 L 404 79" marker-end="url(#loop-head)"/>
  <path class="link" d="M 552 79 L 604 79" marker-end="url(#loop-head)"/>

  <text class="t-tag t-mid t-mut" x="178" y="36">PERTURB</text>
  <text class="t-tag t-mid t-mut" x="378" y="36">LOCAL SEARCH</text>
  <text class="t-tag t-mid t-mut" x="578" y="36">MERGE</text>

  <path class="link" d="M 80 44 L 80 -20 Q 80 -32 92 -32 L 628 -32 Q 640 -32 640 -20 L 640 40" marker-end="url(#loop-head)"/>
  <text class="t-sm t-mid t-mut" x="360" y="-42">the merge reads A too</text>

  <path class="link link--dash" d="M 680 114 L 680 156 Q 680 168 668 168 L 92 168 Q 80 168 80 156 L 80 122" marker-end="url(#loop-head)"/>
  <text class="t-sm t-mid t-mut" x="380" y="163">D replaces A only if it is cheaper</text>

  <text class="t-sm t-mid t-mut" x="380" y="200">one lap is one trial</text>
</svg>
</figure>

---

## Imitation Learning
LKH generates its own training data. Every improvement trial produces a tour before the trial and a better tour after it, so a single solver run is a stream of labeled examples showing what a good move looks like. The first approach I tried was the direct one: train a network to imitate those moves.

### Building the dataset
I generated 100-customer CVRP instances with RL4CO's `CVRPGenerator` and ran LKH on each for 1,000 improvement trials with tracking enabled. Parsing the tracking logs yields before-and-after pairs: the tour LKH held at trial *t*, and the improved tour it held at trial *t+1*.

Each pair became a training example containing tensor representations of both tours, an adjacency matrix for each solution, and labels identifying which node connections changed between them.

### The model
The policy is a hierarchical CVRP model. An N2S-style encoder processes node and edge features, three self-attention layers model the relationships between them, and a decoder produces a complete tour using either greedy or sampled decoding.

The model quickly overfit a single instance, confirming that the training pipeline worked. But offline accuracy only shows that a model can reproduce patterns in its training data. The real test is online performance: does LKH improve when the network becomes part of its search loop?

### Putting it inside the solver
Answering that question required modifying LKH itself. I added a neural callback to the C source—`nn_callback.o` and `FindTourWithNN.o`—so LKH could send its current tour to the network at each trial and receive a proposal in return. If the proposal was cheaper than the incumbent, LKH accepted it. Otherwise, it fell back to its standard perturbation and merge process.

An early version accepted every network proposal unconditionally, producing a strange sawtooth pattern in the results. Correcting the acceptance rule removed that artifact, and the network began to outperform LKH on a few instances.

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
<p class="table-note">Final tour cost after 1,000 trials. Lower is better, and the winning result is bold. The network won three of eight instances—promising, but ultimately misleading.</p>

Eight instances were not enough to support a conclusion. Across 100 instances, the result was much less flattering.

<figure>
  <div class="plate">
    <img src="/assets/img/20260510NCO/cost-gap-fallback.png" alt="Two histograms over 100 instances: cost gap between network and LKH centred slightly above break-even at a mean of 0.39 percent, and LKH fallback rate centred at 23.5 percent">
  </div>
  <figcaption>Left: cost gap across 100 instances, with a mean of +0.39% (positive means the network performed worse). Right: LKH had to reject a network proposal and fall back to its own perturbation in 23.5% of trials on average.</figcaption>
</figure>

<div class="stat-row">
  <div class="stat"><div class="stat__value">31</div><div class="stat__label">wins out of 100 instances</div></div>
  <div class="stat"><div class="stat__value">+0.39%</div><div class="stat__label">mean cost gap vs. baseline LKH</div></div>
  <div class="stat"><div class="stat__value">23.5%</div><div class="stat__label">of trials fell back to LKH</div></div>
</div>

### Trying to close the gap
I trained three variants. A dual-model setup used one policy during early trials and another during later trials, based on the idea that improving a rough tour and polishing a strong one require different skills. A single "wide" model trained across trials 200–1,000 covered both phases. A third variant repeatedly fed the network its own output, refining the tour three times before returning it to LKH.

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
<figcaption>None of the three variants beat the baseline overall. The refinement model—which relied most heavily on the network—performed the worst.</figcaption>
</figure>

---

## Why it lost
The failures were ultimately more informative than the wins, and they pointed to several specific problems.

**Repeated refinement creates a distribution shift.** The three-iteration refinement model delivered the clearest lesson. It was trained on pairs whose inputs were *LKH-perturbed* tours, but its own outputs do not follow that same distribution. By the second pass, the model is already processing data unlike anything it saw during training; the third pass compounds the problem. Its 25/0/75 win-tie-loss record reflects that mismatch.

**The fallback rate stayed flat.** If the network's proposals improved over time, LKH should have needed to reject them less often. It did not.

<figure>
  <div class="plate">
    <img src="/assets/img/20260510NCO/fallback-vs-trials.png" alt="LKH fallback count per trial across 1000 trials, oscillating around a flat mean of 25.1 out of 100 with no downward drift">
  </div>
  <figcaption>Fallback count across 1,000 trials, averaged over 100 instances. The mean remains near 25.1 with no downward trend: the network is not getting worse, but it is also not getting better.</figcaption>
</figure>

**Sampling did not improve greedy decoding.** Generating eight samples and keeping the best one made performance worse. The model was trained with greedy decoding, while sampled decoding chooses nodes without looking ahead and can lead to capacity violations that the greedy policy avoids.

**The two systems represent tours differently.** The network uses node 0 as the depot and repeats it to separate routes. LKH instead creates depot *copies*—nodes 102, 103, 104, and so on. Every exchange between the two systems required a translation step, creating a persistent source of bugs.

All four problems trace back to the same architectural mismatch. Generating a complete, capacity-feasible tour for 100 customers is a much harder task than editing a few edges. The network had to meet that higher bar at every trial simply to compete with LKH.

---

## Pivoting: learn the perturbation, not the tour
I stopped asking the network to produce a finished tour and returned to the original loop. The policy only needs to control the first step, from A to B. LKH is better at everything downstream, so it should keep doing that work.

Rather than starting from scratch, I initialized the policy with the imitation model. It already knew how to interpret a CVRP instance, encode a tour, and respect capacity constraints, even though it had never been trained to perturb. During training, the network processed each input twice: once with sampled decoding and once with greedy decoding. The reward difference became the advantage, so when the sampled tour outperformed the greedy tour, the policy increased the likelihood of those sampled actions.

<figure>
  <div class="plate">
    <img src="/assets/img/20260510NCO/rl-reward-curves.png" alt="Four panels from the reinforcement learning run: rolling mean reward trending upward and crossing zero, mean reward by 1000-step bin turning positive after step 7000, rolling improvement rate climbing from 30 to 75 percent, and reward distributions for the first and last 1000 steps">
  </div>
  <figcaption>Over 10,000 steps of A→B perturbation training, the mean reward per 1,000-step bin rises from −7,763 to +3,525 and crosses zero around step 7,000. The share of steps that improve the tour climbs from roughly 30% to 72.8%.</figcaption>
</figure>

This was the project's most encouraging result. The policy was measurably learning to perturb: its improvement rate more than doubled, and its mean reward moved from clearly negative to positive. The run was noisy, and the learned policy still did not beat LKH's own perturbation end to end, but it was the first experiment in which the learning signal moved decisively in the right direction.

---

## Neural Deconstruction Search
The final approach reduced the action space even further. Instead of generating a perturbed tour, the network selected *which customers to remove*. It sampled M customers from the current best tour, a greedy repair heuristic reinserted them, and the resulting tour went to LKH.

In principle, this should be an easier problem to learn. The network decides only where to perturb, not how to reconstruct the tour, and greedy repair preserves most of the incumbent solution so each change remains local.

<figure>
  <div class="plate">
    <img src="/assets/img/20260510NCO/nds-reward-drift.png" alt="Mean reward over NDS training drifting from a positive first-1000-step average of 3,738 down to a negative last-1000-step average of −2,917">
  </div>
  <figcaption>The reward moved in the wrong direction: the first 1,000 steps averaged +3,738, while the last 1,000 averaged −2,917.</figcaption>
</figure>

This approach did not work. The reward declined over training, and the semester ended before I could determine exactly why. My leading hypothesis is that the reward design was the problem: it measured raw LKH improvement rather than advantage over a greedy baseline. As a result, the signal may have been dominated by the difficulty of whichever instance the policy happened to sample.

---

## Reflections
The headline result is negative, but it is a useful one.

**Generating an entire solution is the wrong division of labor.** A mature solver already enforces feasibility, repairs damage, and performs local search efficiently and reliably. Asking a network to reproduce that entire pipeline means competing with decades of solver development at every trial. A better approach is to let the network make one decision that the solver currently makes at random. The perturbation experiment—the only one whose learning curve clearly improved—supports that direction.

**Offline imitation accuracy says little about online usefulness.** The model clearly learned recognizable LKH behavior, yet it still lost 68 out of 100 online comparisons. The two metrics were nearly uncorrelated, and I relied on the offline result for longer than I should have.

**The instrumentation was more valuable than the model.** The flat fallback curve showed that the network was not gradually improving, while the refinement model's collapse exposed the distribution shift. Without those diagnostics, I would have kept tuning hyperparameters even though the underlying problem was architectural.
