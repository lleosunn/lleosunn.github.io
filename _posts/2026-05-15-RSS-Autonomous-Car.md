---
title: "Robotics: Science and Systems"
description: "Autonomous driving projects for MIT's RSS class."
author: Leo Sun
date: 2026-05-15
end_date: 2026-05-31
slug: rss-autonomous-car
display: true
tile_order: 2
years: "Feb 2026 - May 2026"
image:
  path: /assets/img/20260515RSSAutonomousCar/rss-autonomous-car.jpg
  alt: RSS autonomous car test platform
preview_image:
  path: /assets/img/20260515RSSAutonomousCar/rss-autonomous-car-tile.jpg
  alt: RSS autonomous car test platform on the floor
---

## Overview
For MIT's Robotics: Science and Systems class, I worked on a full autonomy stack for the RACECAR platform across five labs: reactive wall following, visual servoing, Monte Carlo localization, path planning, and an integrated final challenge.

The work started with isolated autonomy modules and gradually built toward end-to-end navigation. By the final challenge, the stack combined camera and LiDAR perception, localization, path planning, pure-pursuit control, and a ROS state machine for multi-stage autonomous behavior.

The team lab portfolio is available [here](https://rss2026-4.github.io/website/labs/).

---

## Lab 03: Wall Following
I implemented the wall-following approach around LiDAR preprocessing, spline fitting, offset-path generation, and pure-pursuit tracking. Raw LiDAR scans were converted from polar measurements into vehicle-frame Cartesian points, filtered to the side of the car we wanted to follow, and downsampled to keep the controller lightweight.

From the filtered wall points, I fit a cubic B-spline to estimate a smooth wall boundary. The controller then generated an offset path at the desired wall distance by computing tangent and normal directions along the spline. A pure-pursuit controller selected a lookahead point on this offset path and converted it into steering commands for the RACECAR.

I also added corner handling using the forward LiDAR region. When the car detected that the wall geometry was changing quickly or that an obstacle was close ahead, the controller biased steering away from the wall so it could navigate corners more reliably.

The final wall follower ran on the physical RACECAR and was tested on straight walls, angled approaches, and corner cases at multiple speeds. In the team's trials, the system maintained roughly a 0.5 m wall offset and showed low steady-state error across the tested speed range.

---

## Lab 04: Visual Servoing
For visual servoing, we built a camera-based pipeline for cone parking and line following. The perception side compared several object-detection approaches, including color segmentation, SIFT, template matching, and YOLO. For the cone-parking task, color segmentation ended up being the most reliable simple approach, with strong IOU performance on our test images.

The cone-parking pipeline detected the cone in image space, used a homography transform to estimate the cone's relative position in the robot frame, and passed that target into a pure-pursuit-style parking controller. The controller handled cases such as being close enough, being misaligned, approaching a cone in front, or backing up in simulation when the cone was behind the car.

For line following, we tuned HSV thresholds and camera regions of interest to focus on useful lane pixels under difficult lighting. The car then followed the detected line using the same general visual-servoing idea: estimate a target point from camera data, transform it into a driving command, and tune the controller until the behavior was stable on hardware.

This lab was a useful lesson in choosing robust simple methods. More sophisticated detectors were available, but the fastest path to reliable hardware behavior came from careful color segmentation, homography calibration, and controller tuning.

---

## Lab 05: Localization
In the localization lab, we implemented Monte Carlo Localization for the RACECAR using noisy odometry, LiDAR scans, and a known occupancy-grid map. The particle filter maintained many pose hypotheses, propagated them through a motion model, scored them with a LiDAR sensor model, and repeatedly reweighted/resampled the distribution until it converged to a pose estimate.

My main work was on the particle-filter update loop. On each odometry callback, the system computed a body-frame control increment from linear velocity, lateral velocity, yaw rate, and elapsed time, then propagated each particle through the motion model. On each LiDAR callback, the scan was downsampled to 100 beams, ray-cast expected ranges were compared against observed ranges, and particle weights were updated with a geometric-mean likelihood to avoid collapse from a few bad beams.

I also worked on the real-world evaluation. We tested localization on the physical RACECAR with straight-line and closed-loop circular trials, comparing the particle filter's pose estimate against measured ground truth in the Stata basement. Across those tests, the particle filter achieved about 9 cm RMSE, with the biggest failures coming from cluttered areas where the real environment did not match the map well.

---

## Lab 06: Path Planning
For path planning, we built a full navigation pipeline that connected localization, planning, and trajectory following. I worked on the sampling-based planner: a bidirectional RRT-Connect implementation that grew one tree from the start and one tree from the goal until they connected.

Before planning, the occupancy grid was inflated by about 0.45 m to account for the car footprint and safety margin. RRT-Connect sampled free cells, converted them into world coordinates, extended toward random samples with a fixed step size, collision-checked candidate edges, and greedily tried to connect the opposite tree. After a path was found, the planner applied random shortcutting to smooth out jagged sampled paths before publishing the trajectory.

We compared RRT-Connect against A*. A* produced shorter, resolution-optimal paths on the inflated grid, while RRT-Connect planned much faster. The team ultimately favored RRT-Connect for later integration because fast replanning mattered more for the final challenge, and the map inflation plus safety controller reduced the risk from less optimal paths.

The final Lab 6 stack used Monte Carlo Localization for pose estimates, RRT-Connect for feasible path generation, and pure pursuit for trajectory tracking. In simulation, the system reached a mean cross-track error of about 0.0188 m; on the physical car, tracking error was about 0.03 m on straights and 0.05 m through corners.

---

## Final Challenge
The final challenge combined the earlier modules into two larger tasks: a lane-following "Great Snail Race" and a more structured driving task called "Mrs. Puff's Boating School."

For the lane-following race, the stack used the ZED camera to detect lane boundaries. The pipeline applied a region-of-interest mask, HSV thresholding for white pixels, Canny edge detection, and a Hough transform to estimate lane lines and a centerline. Homography converted the lookahead point into the robot frame, pure pursuit generated steering, and an exponential moving average filter smoothed noisy steering commands. The lane detector reached roughly 0.06 m RMSE against tape-measured ground truth, and the follower stayed around 5-7 cm cross-track error across tested straights and turns.

For the structured driving task, we integrated LiDAR, camera perception, odometry, localization, RRT-Connect planning, pure pursuit, object detection, and a state machine. The state machine coordinated forward planning, path following, traffic-light stopping, parking-meter behavior, reversing, return planning, and return path following. YOLO and color detection handled traffic lights and parking meters, while homography estimated object distances for stopping and parking behavior.

The biggest final-challenge lesson was that hardware noise and integration details matter as much as individual algorithms. Components that worked cleanly in isolation still needed careful tuning once they ran together with real sensors, mechanical variation, compute load, and ROS timing.
