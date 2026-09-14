# cockpit-apparmor

This is the [Cockpit](https://cockpit-project.org/) user interface for
[AppArmor](https://apparmor.net/).

## Features

 - Lists all loaded AppArmor profiles together with their mode (enforce,
   complain, prompt, kill, unconfined) and the processes they confine.
 - Switches profiles between enforce and complain mode (`aa-enforce`,
   `aa-complain`), and disables them (`aa-disable`).
 - Views and edits the textual profile in `/etc/apparmor.d` and reloads it
   (`apparmor_parser -r`).
 - Loads new profiles from a pasted profile text (`apparmor_parser -a`) and
   optionally persists them in `/etc/apparmor.d`.

All operations shell out to the standard AppArmor tools (`aa-status`,
`aa-enforce`, `aa-complain`, `aa-disable`, `apparmor_parser`) and require
administrative privileges.

This project is based on [cockpit-docker](https://github.com/chabad360/cockpit-docker).
It reuses the same build and packaging scaffolding.

## Development dependencies

On Debian/Ubuntu:

    $ sudo apt install gettext nodejs make

On Fedora:

    $ sudo dnf install gettext nodejs make

## Getting and building the source

These commands check out the source and build it into the `dist/` directory:

```
git clone https://codeberg.org/numpyb/cocpit-aa-admin
cd cocpit-aa-admin
make
```

## Installing

`sudo make install` installs the package in `/usr/local/share/cockpit/`. This depends
on the `dist` target, which generates the distribution tarball.

You can also run `make rpm` to build RPMs for local installation.

In `production` mode, source files are automatically minified and compressed.
Set `NODE_ENV=production` if you want to duplicate this behavior.

See [HACKING.md](HACKING.md) for development workflows (`make devel-install`,
watch mode, linting).