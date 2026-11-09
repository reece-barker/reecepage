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
