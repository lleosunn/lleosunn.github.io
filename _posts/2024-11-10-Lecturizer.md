---
title: Lecturizer
description: An AI assistant that transcribes and summarizes lecture audio.
author: Leo Sun
date: 2024-11-10
image:
  path: /assets/img/20241110Lecturizer/lecturizer.png
  alt: Lecturizer
---

## Overview
Lecturizer is an AI-powered lecture transcription and summarization tool built during WHACK 2024 (Wellesley College Hackathon). It addresses a common student challenge: retaining key information from long, fast-paced lectures. Lecturizer was designed to make lecture review easier by turning raw audio into concise, structured summaries.

---

## System & Features
Lecturizer allows users to upload or record lecture audio through a web interface and automatically converts it into summarized text for efficient studying.

Key features:
- Audio upload and in-browser recording
- Speech-to-text transcription using OpenAI Whisper
- Transformer-based summarization using DistilBART
- Chunking logic to handle long transcripts
- Support for MP3, WAV, OGG, FLAC, and WebM formats
- Location-based consent checks to comply with U.S. recording laws

The backend was built in Python with Flask, while the frontend uses HTML, CSS, and JavaScript. The system was validated on 20+ lecture recordings, achieving a ~70% reduction in transcript length while preserving core ideas.

---

## Challenges & Results
Key challenges included handling recording consent laws and balancing summarization speed with accuracy. These were addressed through a consent disclaimer flow and benchmarking multiple transformer models. The final system provides reliable audio-to-text transcription, fast summarization, robust error handling, and a user-friendly lecture review workflow.

---

## What I Learned
This project gave me hands-on experience integrating AI models into a full-stack application, working with speech-to-text and NLP pipelines, and designing software with legal and ethical constraints in mind.

---


## Demo
<!-- VIDEO: Lecturizer demo -->
{% include embed/youtube.html id='fFjoTULvWek' %}
_Demo of Lecturizer transcribing and summarizing lecture audio_