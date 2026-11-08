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
role: Solo project
featured: true
order: 3
stack:
  - Raspberry Pi
  - Audio classification
  - CUSUM
  - k-NN
  - 1D CNN
  - MATLAB
facts:
  - label: Grade
    value: 9 out of 10
  - label: Sensor
    value: A microphone, no camera
todo:
  - The third model that was compared
  - The accuracy of each model, from the MATLAB results
  - Screenshots of the MATLAB results and a photo of the setup
---

## Why sound

The aim was to learn about passing traffic, and so about its emissions, from sound alone, without a single camera.

It is also the second time my two old interests met, after my extended essay on London's Ultra Low Emission Zone:
data, and the environment.

## How it works

A Raspberry Pi records the traffic and classifies what it hears. To find unusual moments in the stream, the project
uses CUSUM, a change detection method that adds up small deviations until they become a clear signal. The analysis
was done in MATLAB.

I did the project on my own. To classify the sounds I compared three models, among them k-nearest neighbours (k-NN)
and a one dimensional convolutional neural network (1D CNN), and the results were good.

The project was examined orally and scored nine out of ten.
