---
title: "Updating an AUR package"
date: 2020-06-28T21:23:00+02:00
draft: false
tags: [arch,archlinux,aur,checksum]
---

Archlinux' documentation is good, but somehow i struggled to find simple instructions how to update a package. The kafka CLI i'm maintaining, [kaf](https://github.com/birdayz/kaf), has been available for some time in the AUR. At some point i have been passed the ownership of the AUR package, but i had no idea how to do a release.

For more complex cases there's probably more to do, however in my simple case:

1. Clone repo: 

   ```
   git clone ssh://aur@aur.archlinux.org/kaf.git
   ```

   This URL can be found in the AUR under `Git Clone URL`.

2. Update PKGBUILD

   Edit the file PKGBUILD and make necessary changes, i.e. bumping the version number.

3. Update checksums in the PKGBUILD file.

   Use the tool `updpkgsums` for this. It can be installed by running `sudo pacman -Sy pacman-contrib`. It does the build, and writes the checksum into PKGBUILD.
   It is also possible to do it manually, by using e.g. md5sum/sha256sum on the relevant files, and updating the checksums in PKGBUILD by hand.

4. Update `.SRCINFO` file.

   It is generated from PKGBUILD, and required for the AUR. Run `makepkg --printsrcinfo > .SRCINFO`

5. Verify before pushing.

   Run `makepkg -C -f --noconfirm`. If it is successful, your package is OK.

6. Push the changes: 

   ```
   git add PKGBUILD .SRCINFO
   git commit -m "update to vX.Y.Z"
   git push
   ```
   
Now, the updated package is available in the AUR.
