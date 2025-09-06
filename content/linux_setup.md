---
title: "The Linux setup | Part 1 - The Mantra"
date: 2025-09-06T00:00:00Z
draft: false
tags: [linux,arch,archlinux,the linux setup]
---

## **Introduction**

I've been a Linux user for about 15 years, and I owe a lot of that journey to my first job at Capgemini Deutschland GmbH. It was a classic corporate setup-developers used Windows, but all the servers ran on Linux. That's where I finally got to learn the essentials: Bash scripting, maintaining on-premise servers for testing environments, and all that fun in-house stuff.

I was working there part-time while studying computer science, so it wasn't long before I started using Linux for personal projects, too. I kept my gaming PC on Windows, though, because back in 2012, gaming on Linux was basically impossible.

That's when the race for the "perfect" setup began. Like a lot of people, I started distro hopping but was never quite happy. I used Ubuntu for a long time, but something about it always felt a little off. It was better than Windows, for sure, but there was an awkwardness I couldn't put my finger on. It took me a few years to figure out what it was.

---

## **Becoming Terminal-Centric**

My perspective really shifted when I started working with Joschka Tillmanns at the University of Duisburg-Essen. He showed me his Linux setup, and I was instantly hooked. He ran i3 and Emacs on Void Linux, which was pretty wild to me at the time. I stuck with Ubuntu for a while but quickly adopted Emacs and i3. Big thanks to Joscha - he's among the best Software Engineers i've met - for sharing so much knowledge with me.

i3 was the answer to all my questions. I realized that using a [tiling window manager](https://en.wikipedia.org/wiki/Tiling_window_manager) gave me the control I had been missing. In most desktop environments, the terminal feels like a "second-class citizen"-just another window you launch and close. It always felt so disposable, but it's supposed to be the center of everything. It's funny to see the terminal making a comeback with less "hardcore" users now, thanks to things like Claude Code.

Before i3, I used [Guake](https://github.com/Guake/guake), a Quake-style terminal that slides down from the top. It was cool because it made the terminal a special, important element with a fixed place. But with i3, where the terminal is the "default thing to do," it's even better.

The core idea is this: being terminal-centric is essential because it removes unnecessary abstractions. When things get in your way and "make you not understand how things really work," you end up having to learn more in the long run. As counterintuitive as it sounds, being closer to the metal requires you to learn less overall. Why? Because every application-level abstraction is unique, enforcing its own opinions and workflows.

---

## **The Mantra**

My approach to building a Linux setup can be summed up in a few key principles:

### **1. Investment for Life**

Think of your setup as an investment. Just like your stocks, ETFs, or real estate, it's something you build and maintain for the long haul. The time and effort you put into it now will pay dividends for years to come.

### **2. Cater to Your Exact Needs**

Be opinionated. Your setup needs to work for you and no one else. Don't make compromises. Build it to fit your workflow exactly.

### **3. No Abstractions**

I touched on this with the terminal. Don't use tools that make things "easier" by hiding how they work. Instead, take the time to understand the underlying process. For example, instead of a graphical tool for file syncing, learn how to use `rsync` from the command line. If you need a tool, you can build your own on top of that understanding. There are always trade-offs and exceptions, of course, but make it a guiding principle.

### **4. Be Pragmatic**

This is the balance to the "no abstractions" rule. If you're stuck on a problem, it's okay to use an existing tool to get the job done for now. But always keep the goal of eventually understanding the core technology in mind.

### **5. Write Your Own Tools**

With AI, writing your own tools is easier than ever. I don't mean just letting it "vibe code" everything for you. AI can help you unblock yourself by explaining complex APIs or providing code snippets. For example, it helped me understand the basics of GTK enough to write a very simple taskbar for myself (https://github.com/birdayz/ezbar). It's far from perfect, but I learned a ton in the process.

### **6. Good Hardware is Important**

If you're a software engineer like me, you should invest in good hardware. This is part of the "no abstractions" rule-a slow, clunky machine is an abstraction that gets in your way. While not everything at work is a choice, in general, don't cheap out.

Don't be the person with a bad microphone on a remote call or a terrible monitor with a crappy resolution. It's just not worth it. You work 40-60 hours a week with this stuff. There's no justification for bad hardware. Plus, for me, good quality gear makes me happy. Things that just work and feel solid improve my day-to-day life.

A few examples that come to mind:

* **Dedicated webcam** for clear video.
* **Proper studio-quality microphone** for good audio.
* A **keyboard** that's fun to use and ergonomic.
* An **ergonomic mouse** that works well for both productivity and gaming.
* **Good monitors.** I think you can never have too much screen space, especially with tiling window managers. Don't skimp on resolution.
* A **good DAC** (Digital-to-Analog Converter). I'm an amateur audiophile, and a good DAC makes a huge difference.
* A powerful **desktop computer**. I'm a big fan of building my own desktops. A proper desktop has way more horsepower than a laptop. For example, sustained clock speeds on a desktop CPU can be twice as fast as a laptop's, not even counting the difference in core counts.

### **7. Prefer Open-Source Software**

If there's a good open-source solution, use it. Even if it has a few sharp edges, being able to fix it yourself is much better than being locked into a proprietary system. However, being pragmatic still applies. If there's no good open-source option, just use the proprietary thing.

## **Next**

In this blog series, i will share my own learnings, my current setup, and future ideas. I understand, all of this is **very** opinionated - but that's okay!
