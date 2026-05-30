---
title: "Recording 4K60 on Linux is now easy (my first kernel patch)"
date: 2026-05-30T11:00:00+02:00
draft: false
tags: [linux,kernel,usb,obs]
image: "/img/elgato-4k-x-usb-bos-quirk-og.png"
---

Recording 4K60 on Linux used to be a mess. As of Linux 6.19 you plug in an [Elgato 4K X](https://www.elgato.com/us/en/p/game-capture-4k-x), open OBS, and get clean 4K60 with the in-kernel driver and no extra software. What fixed it is a small USB quirk i got into the kernel.

i needed this for my daughter Karolina's YouTube channel, [Karo's Gaming World](https://www.youtube.com/@KarosGamingWorld), which records clean 4K60 Nintendo gameplay. Shameless plug: if you like that kind of thing, leave her a sub. :)

4K capture on Linux has been painful in general. USB UVC capture devices often enumerate wrong or expose the wrong modes, and PCIe capture cards lean on out-of-tree, reverse-engineered drivers from GitHub that you build and maintain yourself. The Elgato 4K X is a USB UVC device, so it should work with the in-kernel uvcvideo driver and nothing else. It didn't, because of the USB BOS descriptor.

The card hangs during enumeration at SuperSpeed Plus (10Gbps), drops to plain SuperSpeed (5Gbps), and re-attaches under a different product ID. On the slower link it only offers up to 4K30; its 4K60 modes come back only on the full 10Gbps link. Skipping the BOS request keeps it on SuperSpeed Plus, and 4K60 works on a mainline kernel with the in-tree driver.

![Elgato 4K X](/img/elgato-4k-x-product.jpg)

## The device changes product ID by link speed

The first confusing part is that the Elgato 4K X reports a different `idProduct` depending on the speed it ends up at:

- `0fd9:009b` at SuperSpeed Plus (Gen 2x1, 10Gbps), the working state, 4K60
- `0fd9:009c` at plain SuperSpeed (5Gbps), after a failed BOS read forces a re-enumeration, capped at 4K30

The ID tells you whether the card stayed on the 10Gbps link or fell back.

Here is the failure at SuperSpeed Plus:

```text
[    3.284990] usb 2-2: new SuperSpeed Plus Gen 2x1 USB device number 2 using xhci_hcd
[    8.574542] usb 2-2: unable to get BOS descriptor or descriptor too short
[    8.600018] usb 2-2: unable to read config index 0 descriptor/start: -71
[    8.600027] usb 2-2: can't read configurations, error -71
[    8.998412] usb 2-2: Device not responding to setup address.
[    9.422737] usb 2-2: device not accepting address 3, error -71
[   10.990897] usb 2-2: new SuperSpeed USB device number 5 using xhci_hcd
[   11.152244] usb 2-2: New USB device found, idVendor=0fd9, idProduct=009c
```

The link trains at 10Gbps, the kernel asks for the BOS descriptor, the device stops responding, and after a few seconds of retries it gives up and re-attaches as `009c` at 5Gbps. The BOS read is the first transfer to fail; the config-descriptor and set-address errors after it are downstream of that, not separate problems.

## The BOS descriptor

BOS is the Binary Device Object Store. It carries the SuperSpeed and SuperSpeedPlus device capability descriptors, LPM support, and similar information. The kernel reads it early in enumeration via `usb_get_bos_descriptor()`.

This particular device hangs on that request, but only at 10Gbps. After enumeration it answers BOS requests from `lsusb` normally. So it expects something to happen before it can produce the descriptor at SuperSpeed Plus, and Linux issues the request in a different order than the device firmware was tested against.

This is a device bug, not a Linux bug. The same card works on Windows, where enumeration happens to not hit the device in the order that triggers the hang. Nobody captured the exact sequence Windows uses, so the device-side root cause stays unknown. The BOS descriptor is also not essential to operate the device. The kernel reads it for SuperSpeedPlus capability and LPM information, so skipping it for one broken device costs nothing in practice. The quirk acknowledges that the device is at fault and works around it.

## The fix

Skip the BOS request for devices that can't handle it. A new quirk flag, gated in `usb_get_bos_descriptor()`:

```c
/* skip BOS descriptor request */
#define USB_QUIRK_NO_BOS			BIT(17)
```

```c
int usb_get_bos_descriptor(struct usb_device *dev)
{
	...
	if (dev->quirks & USB_QUIRK_NO_BOS) {
		dev_dbg(ddev, "skipping BOS descriptor\n");
		return -ENOMSG;
	}
	...
```

And the device in the quirk table:

```c
/* Elgato 4K X - BOS descriptor fetch hangs at SuperSpeed Plus */
{ USB_DEVICE(0x0fd9, 0x009b), .driver_info = USB_QUIRK_NO_BOS },
```

The table entry matches `009b`, the ID the device presents while it is attempting the SuperSpeed Plus enumeration. That is the only point where the quirk can act, because the BOS request happens during that attempt. With the request skipped, enumeration completes and the device stays at 10Gbps:

```text
[    3.297159] usb 2-2: new SuperSpeed Plus Gen 2x1 USB device number 2 using xhci_hcd
[    3.354248] usb 2-2: skipping BOS descriptor
[    3.432917] usb 2-2: New USB device found, idVendor=0fd9, idProduct=009b
[    3.432927] usb 2-2: Product: Elgato 4K X
```

## Upstreaming

The main concern in review was that adding devices to a skip-the-spec quirk invites a pile of future entries for hardware that is doing something odd USB-IF testing doesn't catch. That is fair, and it is also why the quirk is opt-in per device rather than a blanket behavior change. The pile did show up, because the same capture chip appears in a lot of cards under different vendor and product IDs. Other people have since extended the quirk: [a batch of three from one contributor](https://lore.kernel.org/all/CACy+XB-f-51xGpNQFCSm5pE_momTQLu=BaZggHYU1DiDmFX=ug@mail.gmail.com/) (ASUS TUF 4K PRO, Avermedia Live Gamer Ultra 2.1, UGREEN 35871), and [the ezcap401](https://lore.kernel.org/all/20260313123638.20481-1-vahnenko2003@gmail.com/) after that. Each is the same BOS hang at 10Gbps, fixed by one more line in the table. A card that hangs the same way but is not yet listed needs its IDs added there; there is no `usbcore.quirks=` boot-parameter form for `NO_BOS`, so it takes a one-line patch, not a runtime toggle.

This was my first kernel patch, and Greg Kroah-Hartman made it painless. He was patient and helpful throughout, and he bought an Elgato 4K X to reproduce the hang rather than take my word for it. Whose budget that came from, his own or his employer's, does not matter; spending real money to verify a stranger's first patch is more care than i expected. He took it from the first post to mainline and four stable trees in about a month. The kernel contribution process has a reputation for being hostile, and none of that matched my experience. Thanks, Greg.

## Releases

The commit is [`2740ac33`](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=2740ac33c87b3d0dfa022efd6ba04c6261b1abbd). It shipped in mainline Linux 6.19 and was backported to the [6.1](https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/commit/?id=49660ee0a3ba493c360e7fad92c2243b8a0589fe), [6.6](https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/commit/?id=93f21786487cd282017c291a6b92dbbbc503e349), [6.12](https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/commit/?id=17b7ddee0eb40635760a4d7ac01cf3f9a96995fe), and [6.18](https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/commit/?id=6e4663c6ec273f05b8e78fd38d5713ce37afc627) stable trees, so any kernel on a maintained stable branch has it.

Check that it is active on a running system. A capture card binds to the `uvcvideo` driver, so its USB device node is listed under that driver in sysfs, no vendor ID needed:

```console
$ ls /sys/bus/usb/drivers/uvcvideo/
2-1:1.0  2-1:1.1  bind  module  new_id  remove_id  uevent  unbind
```

`2-1:1.0` is an interface; the USB device node is the part before the colon, `2-1`. Read its quirk flags:

```console
$ cat /sys/bus/usb/devices/2-1/quirks
0x20000
```

`0x20000` is `BIT(17)`, the `NO_BOS` flag, so the quirk is applied. It reads the same for any of the affected cards. `lsusb -t` shows the device at `10000M` (SuperSpeed Plus) with `Driver=uvcvideo`, and `v4l2-ctl -d /dev/video0 --list-formats-ext` lists `3840x2160` under YUYV, MJPG and NV12. OBS then offers the full resolution:

![Elgato 4K X at 3840x2160 60fps in OBS](/img/elgato-4k-x-obs-4k.png)

## This is why Linux is great

Elgato has not shipped a Linux fix; the card is sold for Windows and macOS. Everything that made it work on Linux came from outside the vendor. Someone filed [the bug report](https://bugzilla.kernel.org/show_bug.cgi?id=220027), people on a [Reddit thread](https://www.reddit.com/r/elgato/comments/1lw1e0v/elgato_4k_x_linux_why_it_stubbornly_connects_at_5/) worked out that the card stubbornly fell back to 5Gbps, i took it from there and wrote the quirk, and other people extended it to more cards afterward.

A quirk is not rocket science. It is a few lines and a device ID. But i did not have to wait for the vendor or a release cycle: the source was there, the bug was understood, and the fix was one patch. That is the part open source gets right. Anyone can make the thing a little bit better, and the next person builds on it. The credit here belongs to the community: the original bug reporter, the Reddit thread, and Greg.

## References

- Patch and review thread: [lore.kernel.org](https://lore.kernel.org/all/20251207090220.14807-1-johannes.bruederl@gmail.com/)
- Mainline commit `2740ac33`: [git.kernel.org](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=2740ac33c87b3d0dfa022efd6ba04c6261b1abbd)
- Bug report: [kernel bugzilla #220027](https://bugzilla.kernel.org/show_bug.cgi?id=220027)
- Reddit discussion (r/elgato), where the 5Gbps fallback got pinned down: [why it stubbornly connects at 5Gbps](https://www.reddit.com/r/elgato/comments/1lw1e0v/elgato_4k_x_linux_why_it_stubbornly_connects_at_5/)
- Follow-up for more capture cards (ASUS TUF 4K PRO, Avermedia Live Gamer Ultra 2.1, UGREEN 35871): [lore.kernel.org](https://lore.kernel.org/all/CACy+XB-f-51xGpNQFCSm5pE_momTQLu=BaZggHYU1DiDmFX=ug@mail.gmail.com/), [commit](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=93cd0d664661f58f7e7bed7373714ab2ace41734)
- Follow-up for the ezcap401: [lore.kernel.org](https://lore.kernel.org/all/20260313123638.20481-1-vahnenko2003@gmail.com/), [commit](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=d0d9b1f4f5391e6a00cee81d73ed2e8f98446d5f)
