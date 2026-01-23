---
title: Multi-Agent Testbed
description: Multi-robot testbed for warehouse robotics.
author: Leo Sun
date: 2025-12-16
image:
  path: /assets/img/20251216Warehouse/warehouserobotics.png
  alt: Multi-Agent Testbed
---

## Overview
This project explores multi-agent path finding (MAPF) in dense, warehouse-style environments, with a focus on the tradeoffs between reactive collision avoidance and planning-based coordination, and on transferring algorithms from simulation to real robots. I built a multi-agent robotics testbed spanning simulation and physical execution, enabling real-world validation of MAPF algorithms on holonomic robots.

---

## System Architecture
The testbed integrates:
- VMAS for scalable multi-agent simulation
- ROS 2 for control, communication, and deployment
- Dockerized infrastructure for reproducible experiments
- Holonomic mobile robots (RoboMaster platform) with NVIDIA Jetson Orin Nano for real-world testing

Planning and control are run centrally, while physical robots act as low-level executors. This design enabled rapid iteration, large-scale testing, and sim-to-real transfer.

---

## Algorithms Explored

### Baseline: Move-to-Goal Control
The initial approach used simple PID-based move-to-goal control for each agent. While agents reached their goals efficiently, the lack of coordination resulted in frequent collisions as agent density increased.

---

### Reactive Collision Avoidance
A repulsive force model was added, causing agents to push away from one another within a fixed radius. This reduced collisions compared to the baseline, but introduced:
- Oscillatory and non-smooth trajectories
- Residual collisions due to lack of global planning

<!-- GIF: Repulsive force avoidance (simulation) -->
![Repulsive force avoidance GIF](/assets/img/20251216Warehouse/repulsive.gif)
_Rudimentary repulsive-force collision avoidance in simulation_

---

### Planning-Based Coordination (CBS)
To enable principled coordination, the environment was discretized and a Conflict-Based Search (CBS) planner was implemented.

Key features:
- Individual, conflict-free paths per agent
- Waiting actions and collision constraints handled explicitly
- Planned paths converted to splines for smooth execution
- PID controllers used to track spline trajectories

<!-- GIF: CBS planning (simulation) -->
![CBS planning GIF](/assets/img/20251216Warehouse/cbs.gif)
_CBS-based planning with spline-interpolated trajectories_

---

## Evaluation & Results
Planners were evaluated using:
- Collision count
- Makespan (total time for all agents to reach goals)
- 400+ randomized simulations
- Agent counts ranging from 2 to 15

Outliers were filtered using a 1.5 × IQR rule, and results were analyzed across multiple random seeds.

Key findings:
- CBS planning reduced collisions by 84%+ compared to non-planning baselines
- Planning consistently increased makespan, revealing a safety–efficiency tradeoff
- As agent density increased, planning became increasingly beneficial

<!-- IMAGE: Collision reduction graph -->
![Collision reduction vs agents](/assets/img/20251216Warehouse/graph1.png)
_Delta collisions (no planning − planning) vs number of agents_

<!-- IMAGE: Makespan tradeoff graph -->
![Makespan tradeoff vs agents](/assets/img/20251216Warehouse/graph2.png)
_Delta completion time (no planning − planning) vs number of agents_

---

## Sim-to-Real Deployment
To move beyond simulation, the system was deployed to physical RoboMaster robots.

Key infrastructure improvements:
- Migrated planning and control to a centralized ROS 2 workstation
- Eliminated Docker reset and dependency issues on robots
- Enabled synchronized multi-robot execution

With the improved localization pipeline, CBS planning was fully deployed on the physical robots. The planner generated conflict-free global paths, which were then tracked by spline-based controllers on each RoboMaster platform.

## Localization & Control
A vision-based localization pipeline was developed using:
- Overhead webcams  
- ArUco / ChArUco markers  
- Camera calibration and global-frame anchoring  

This enabled:
- Real-time pose estimation for multiple robots  
- Field-centric control  
- Independent P/PID control of \(x\), \(y\), and heading  
- EKF-based fusion of dual-camera global measurements with dead reackoning measurements from onboard odometry 

<!-- VIDEO: World anchor marker demonstration -->
{% include embed/youtube.html id='l3Mjo0YqMfM' %}
_Demonstration of ArUco/ChArUco world anchor markers establishing a global reference frame_

---

## Physical Robot Demonstration

<!-- VIDEO: Reactive swap scenario -->
{% include embed/youtube.html id='oVyAGnIpTmg' %}
_Reactive collision avoidance performing a two-robot swap (updated real-world video)_

---

## CBS Swap Scenario #1
<!-- VIDEO: CBS swap scenario 1 -->
{% include embed/youtube.html id='tr_jWie8u-0' %}
_CBS-planned swap demonstrating coordinated, collision-free robot motion_

---

## CBS Swap Scenario #2
<!-- VIDEO: CBS swap scenario 2 -->
{% include embed/youtube.html id='rdYoAu8qrGc' %}
_Another CBS-based swap scenario showing robust conflict handling_

---

## Next Steps
- Scale CBS deployment to more robots in real environments  
- Improve localization robustness under dynamic lighting and partial camera occlusions  
- Add dynamic obstacles 
- Experiment with decentralized or hybrid planning architectures  
- Integrate predictive models to anticipate conflicts before planning