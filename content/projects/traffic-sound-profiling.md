---
title: Profiling traffic by sound
summary: >-
  A Raspberry Pi that listens to passing traffic and profiles it by sound alone, to learn about emissions without a
  single camera. It scored nine out of ten.
branch: earth
kind: Course project
context: Saxion, time series pattern recognition
period: 2026
sort_date: 2026-06
status: Finished
featured: true
order: 3
stack:
  - Raspberry Pi
  - Audio classification
  - CUSUM
  - MATLAB
facts:
  - label: Grade
    value: 9 out of 10
  - label: Sensor
    value: A microphone, no camera
todo:
  - Whether this was a team or solo project
  - What the classifier tells apart, and how accurate it was
  - A photo of the setup or a plot of the results
---

## Why sound

The aim was to learn about passing traffic, and so about its emissions, from sound alone, without a single camera.

It is also the second time my two old interests met, after my extended essay on London's Ultra Low Emission Zone:
data, and the environment.

## How it works

A Raspberry Pi records the traffic and classifies what it hears. To find unusual moments in the stream, the project
uses CUSUM, a change detection method that adds up small deviations until they become a clear signal. The analysis
was done in MATLAB.

The project was examined orally and scored nine out of ten.
