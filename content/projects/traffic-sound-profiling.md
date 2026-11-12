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
de:
  title: Verkehrsprofile aus Geräuschen
  summary: >-
    Ein Raspberry Pi hört dem vorbeifahrenden Verkehr zu und erstellt allein anhand des Klangs ein Profil davon,
    um etwas über Emissionen zu erfahren, ganz ohne Kamera. Dafür gab es eine 9 von 10.
  kind: Kursprojekt
  context: Saxion, Mustererkennung in Zeitreihen
  period: "2026"
  status: Abgeschlossen
  role: Einzelprojekt
  facts:
    - label: Note
      value: 9 von 10
    - label: Sensor
      value: Ein Mikrofon, keine Kamera
  body: |
    ## Warum Klang

    Ziel war es, allein aus dem Klang etwas über den vorbeifahrenden Verkehr und damit über seine Emissionen zu erfahren,
    ganz ohne Kamera.

    Es ist außerdem das zweite Mal, dass sich meine beiden alten Interessen getroffen haben, nach meiner Extended Essay
    über die Ultra Low Emission Zone in London: Daten und Umwelt.

    ## So funktioniert es

    Ein Raspberry Pi nimmt den Verkehr auf und klassifiziert, was er hört. Um auffällige Momente im Datenstrom zu finden,
    nutzt das Projekt CUSUM, ein Verfahren zur Änderungserkennung, das kleine Abweichungen aufsummiert, bis daraus ein
    klares Signal wird. Die Analyse wurde in MATLAB gemacht.

    Ich habe das Projekt allein durchgeführt. Zur Klassifikation der Geräusche habe ich drei Modelle verglichen, darunter
    k-nächste-Nachbarn (k-NN) und ein eindimensionales Convolutional Neural Network (1D-CNN), und die Ergebnisse waren gut.

    Das Projekt wurde mündlich geprüft und mit neun von zehn Punkten bewertet.
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
