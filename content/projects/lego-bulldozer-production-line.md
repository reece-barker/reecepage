---
title: A production line for a LEGO bulldozer
summary: In Saxion's Industrial Automation minor, a team of thirteen is designing a production line that assembles a LEGO Technic bulldozer every five minutes, with eight ABB robots, vision systems and PLCs.
branch: code
kind: Course project
context: Saxion, Industrial Automation minor
period: 2026 to February 2027
sort_date: 2026-09
status: In progress
team: Thirteen students
featured: true
order: 2
stack: [ABB RobotStudio, PLCs, SCADA, Ignition, Festo, Vision systems, Pneumatics]
facts:
  - { label: Product, value: "LEGO Technic 42163 Heavy-Duty Bulldozer, 195 parts" }
  - { label: Target, value: "First unit in 20 minutes, then one every 5 minutes" }
  - { label: Robots, value: "Eight ABB robots" }
todo:
  - Which station or part of the line Reece is responsible for
  - Photos or a layout drawing of the line once it exists
---

## The brief

The product is the LEGO Technic Heavy-Duty Bulldozer: 195 parts. The line has to build the first one in twenty
minutes and then one every five minutes after that.

It has to work like a real factory line. That means vision systems to check parts, stations controlled by PLCs, a
transport system between the robots (a LEGO train carries the parts) and SCADA supervision over all of it. The
stations follow one modular, standardised design, so a station can be changed without redesigning the rest.

## The tools

We have eight ABB robots, pneumatic grippers and cylinders, and the industrial software used across the minor:
ABB RobotStudio for programming and simulating the robots, Festo hardware, and Ignition for SCADA.

Alongside the line I am learning to programme ABB robots properly, first offline in RobotStudio and then on a real
IRB 1100 in the lab.

## Where it stands

The first phases are the product breakdown structure and the assembly sequence: taking the bulldozer apart on paper
and deciding which robot does what, in which order. The line has to be finished in February 2027.
