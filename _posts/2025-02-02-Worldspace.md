---
title: Worldspace
description: Haptic robotic arm for excavator operation.
author: Leo Sun
date: 2025-02-02
image:
  path: /assets/img/20250202Worldspace/worldspace.png
  alt: Worldspace
---

## Overview
Worldspace is a haptic robotic arm interface designed to mimic the kinematics and proportions of an excavator. It was used as the primary hardware platform in a research study investigating *The Effects of Haptic Feedback and Guidance in the Learning and Operation of Excavators*. The project studies how haptic feedback influences learning efficiency, control precision, and physical exertion when operating excavators through a robotic arm interface. I contributed across human-subject experimentation, mechanical design, and real-time kinematics visualization, supporting both the research and system development aspects of the project.

---

## Research & Experimental Setup
We conducted controlled user studies comparing excavator operation across four experimental conditions to isolate the effects of both interface type and haptic feedback.

The four experimental groups were:
- Joystick control with haptic feedback
- Joystick control without haptic feedback
- Worldspace robotic arm with haptic feedback
- Worldspace robotic arm without haptic feedback

My contributions included:
- Recruiting and assisting participants during experiments
- Running and supervising 36+ hours of training simulations
- Setting up Unity-based excavation tasks and logging performance data

Results showed a ~50% reduction in operator force exertion when haptic feedback was enabled, particularly when using the Worldspace interface, indicating improved ergonomics and control efficiency.

---

## Mechanical Design & Safety Improvements

### Wire Organizer Redesign
One major mechanical contribution was redesigning a wire organizer that also functioned as a mechanical stop for the robotic arm.

The original design:
- Frequently broke under stress
- Required unplugging and rethreading all wires to replace

I designed a new slot-based wire organizer that:
- Allowed wires to be routed without disconnecting
- Greatly reduced replacement time
- Improved durability and maintainability  
This resulted in a 75%+ reduction in maintenance time.

<!-- IMAGE: Broken original wire organizer -->
![Broken wire organizer](/assets/img/20250202Worldspace/brokenwireorganizer.jpeg)
_Original wire organizer that frequently failed under mechanical stress_

<!-- IMAGE: Before and after wire organizer -->
![Wire organizer before and after](/assets/img/20250202Worldspace/newwireorganizer.jpeg)
_Redesigned slot-based wire organizer enabling faster maintenance and improved durability_

---

### Gripper Safety Structure
Another safety-focused improvement addressed a finger injury risk in the gripper mechanism.

Originally:
- An exposed gap posed a risk of finger injury during operation

I designed a fan-like protective structure that:
- Expands and contracts with the gripper
- Protects 3 out of 4 fingers during operation
- Significantly improves user safety compared to the original design

<!-- IMAGE: Exposed gripper gap -->
![Gripper gap](/assets/img/20250202Worldspace/grippergap.jpeg)
_Exposed gap in the original gripper design presenting a finger injury risk_

<!-- VIDEO: Fan-like safety mechanism -->
{% include embed/youtube.html id='DuPrVi4fDUE' %}
_Fan-like safety structure during gripper operation_

---

## Kinematics & Real-Time Visualization
I implemented real-time forward kinematics for the 4-DOF robotic arm to track joint positions and the excavator bucket tip in 3D space.

This work involved:
- Computing 3D forward kinematics for each joint
- Mapping bucket tip position for environment interaction
- Enabling physics-based simulation such as soil dragging with haptic feedback

Technologies used:
- Python + Matplotlib for real-time visualization
- C++ and Unity for interactive simulation

<!-- IMAGE: Forward kinematics math -->
![Forward kinematics math](/assets/img/20250202Worldspace/fkmath.png)
_Forward kinematics equations used to compute joint positions and excavator bucket tip location_

<!-- VIDEO: Forward kinematics in Matplotlib -->
{% include embed/youtube.html id='jHiDDrZGDFw' %}
_Real-time forward kinematics visualization in Matplotlib_

<!-- VIDEO: Forward kinematics in Unity -->
{% include embed/youtube.html id='DOlMfPjqpgM' %}
_Real-time forward kinematics visualization in Unity_
