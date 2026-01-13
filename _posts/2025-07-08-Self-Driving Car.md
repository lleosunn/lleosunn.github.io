---
title: Self-Driving Car
description: Quanser Self-Driving Car Student Competition at the 2025 American Control Conference.
author: Leo Sun
date: 2025-07-08
image:
  path: /assets/img/20250708SelfDrivingCar/selfdrivingcar.png
  alt: Self-Driving Car
---

## Overview
I participated in the **Quanser Self-Driving Car Student Competition**, held at the **2025 American Control Conference (ACC)** in Denver, Colorado. The competition simulated an Uber-like autonomous driving environment, where teams programmed a self-driving car to navigate a city map, pick up passengers, drop them off at target locations, and return to a home base while obeying traffic laws.

Teams were scored based on the **complexity and number of routes completed** within a fixed time limit.

---

## Team Structure & My Role
Our team of three divided the system into three core components:
- **Perception:** Camera-based detection of stop signs and traffic lights
- **State Estimation:** Localization using LiDAR and wheel encoders
- **Control:** Path planning and trajectory tracking

I was responsible for the **control subsystem**, focusing on global path planning and low-level path following for an Ackermann-drive vehicle.

---

## Control System Design

### Roadmap & Path Planning
To support flexible route selection, I designed a **directed graph roadmap** consisting of **52 nodes**, connected by a combination of straight-line segments and circular arcs.

The roadmap encoded:
- Road geometry
- Legal driving directions
- Locations of stop signs, traffic lights, and yield signs

I implemented **Dijkstra’s algorithm** on this roadmap to compute shortest paths between arbitrary pickup and drop-off locations, enabling efficient route planning during competition runs.

<!-- IMAGE: Planned roadmap -->
![Planned roadmap](/assets/img/20250708SelfDrivingCar/drawnroadmap.jpg)
_Hand-designed roadmap representing the competition environment_

<!-- IMAGE: Coded roadmap -->
![Coded roadmap](/assets/img/20250708SelfDrivingCar/codedroadmap.png)
_Directed graph implementation with line segments and arcs used for path planning_

---

### Path Following & Control
For trajectory tracking, I implemented a **Pure Pursuit controller** using **ROS 2 and Python**.

Key features:
- Ackermann steering-compatible control
- Smooth tracking of both straight and curved path segments
- Real-time command generation for vehicle steering and velocity

This controller allowed the car to reliably follow planned routes from point A to point B under nominal conditions.

---

## Competition Results & Lessons Learned
Our team competed at ACC and placed **6th out of 28 teams**.

While our control system performed as intended, overall performance was affected by system-level issues:
- **Traffic light detection failures** in the vision system caused penalties for running red lights
- **Movable foam-core walls** in the environment reduced localization accuracy
- As a result, we prioritized **simpler routes** over longer, more complex ones

Despite these challenges, the competition provided valuable experience working with **ROS 2**, multi-module autonomous systems, and the realities of deploying autonomy in imperfect, real-world environments.

---

## Demo

<!-- VIDEO: Self-driving car demo -->
{% include embed/youtube.html id='2KP8IuVTET8' %}
_Demo of the car following a planned route during competition_