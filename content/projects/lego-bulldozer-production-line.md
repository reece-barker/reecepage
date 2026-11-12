---
title: A production line for a LEGO bulldozer
summary: >-
  A team of thirteen in Saxion's Industrial Automation minor is designing a line that builds a LEGO Technic
  bulldozer every five minutes. It runs on eight ABB robots, vision systems and PLCs.
branch: code
kind: Course project
context: Saxion, Industrial Automation minor
period: 09/2026 to 02/2027
sort_date: 2026-09
status: In progress
role: Responsible for the transport system between the stations
team: Thirteen students
featured: true
order: 2
stack:
  - ABB RobotStudio
  - PLCs
  - SCADA
  - Ignition
  - Festo
  - Vision systems
  - Pneumatics
facts:
  - label: Product
    value: LEGO Technic 42163 Heavy-Duty Bulldozer, 195 parts
  - label: Target
    value: First unit in 20 minutes, then one every 5 minutes
  - label: Robots
    value: Eight ABB robots
todo:
  - Photos or a layout drawing of the transport system once it exists
de:
  title: Eine Produktionslinie für einen LEGO-Bulldozer
  summary: >-
    Ein Team aus dreizehn Studierenden im Minor Industrial Automation der Saxion entwirft eine Linie, die alle
    fünf Minuten einen LEGO-Technic-Bulldozer baut. Sie arbeitet mit acht ABB-Robotern, Bildverarbeitung und
    SPSen.
  kind: Kursprojekt
  context: Saxion, Minor Industrial Automation
  period: 09/2026 bis 02/2027
  status: In Arbeit
  role: Verantwortlich für das Transportsystem zwischen den Stationen
  team: Dreizehn Studierende
  facts:
    - label: Produkt
      value: LEGO Technic 42163 Heavy-Duty Bulldozer, 195 Teile
    - label: Ziel
      value: Das erste Exemplar nach 20 Minuten, danach alle 5 Minuten eines
    - label: Roboter
      value: Acht ABB-Roboter
  body: |
    ## Die Aufgabe

    Das Produkt ist der LEGO Technic Heavy-Duty Bulldozer mit 195 Teilen. Die Linie muss den ersten in zwanzig Minuten
    bauen und danach alle fünf Minuten einen weiteren.

    Sie soll wie eine echte Fertigungslinie arbeiten. Bildverarbeitungssysteme prüfen die Teile, SPSen steuern die
    Stationen. Eine LEGO-Eisenbahn transportiert die Teile zwischen den Robotern, und ein SCADA-System überwacht alles. Die
    Stationen folgen einem modularen, standardisierten Aufbau, sodass sich eine Station ändern lässt, ohne den Rest neu zu
    entwerfen.

    ## Mein Teil: das Transportsystem

    Ich bin für das Transportteam verantwortlich, das regelt, wie die Teile von einer Station zur nächsten kommen. Dazu
    gehören eine präzise Bewegung mit pneumatischen Anschlägen und die Programmierung, die dafür sorgt, dass die richtigen
    Teile zur richtigen Zeit an jeder Station ankommen. Außerdem verfolgen wir, wo sich jedes Teil im Prozess gerade
    befindet.

    ## Die Werkzeuge

    Wir haben acht ABB-Roboter mit pneumatischen Greifern und Zylindern sowie Festo-Hardware. Die Roboter werden in ABB
    RobotStudio programmiert und simuliert, und Ignition betreibt das SCADA-System.

    Neben der Linie lerne ich, ABB-Roboter ordentlich zu programmieren, zuerst offline in RobotStudio und dann an einem
    echten IRB 1100 im Labor.

    ## Stand

    Die ersten Phasen sind der Produktstrukturplan (Product Breakdown Structure) und die Montagereihenfolge. Das heißt, den
    Bulldozer auf dem Papier zu zerlegen und festzulegen, welcher Roboter was in welcher Reihenfolge übernimmt. Im Februar
    2027 muss die Linie fertig sein.
---

## The brief

The product is the LEGO Technic Heavy-Duty Bulldozer: 195 parts. The line has to build the first one in twenty
minutes and then one every five minutes after that.

It has to work like a real factory line. Vision systems check the parts and PLCs control the stations. A LEGO train
carries the parts between the robots, and SCADA supervises all of it. The
stations follow one modular, standardised design, so a station can be changed without redesigning the rest.

## My part: the transport system

I am responsible for the transport team, which handles how parts get from one station to the next. That means
accurate movement with pneumatic stops, and the programming that gets the right parts to each station when they are
needed. We also keep track of where every part is in the process.

## The tools

We have eight ABB robots with pneumatic grippers and cylinders, and Festo hardware. The robots are programmed and
simulated in ABB RobotStudio, and Ignition runs the SCADA.

Alongside the line I am learning to programme ABB robots properly, first offline in RobotStudio and then on a real
IRB 1100 in the lab.

## Where it stands

The first phases are the product breakdown structure and the assembly sequence. That means taking the bulldozer
apart on paper and deciding which robot does what, in which order. The line has to be finished in February 2027.
