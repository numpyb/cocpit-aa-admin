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

    $ sudo apt install gettext nodejs npm make

On Fedora:

    $ sudo dnf install gettext nodejs make

(`npm` is only needed when `node_modules/` has to be reconstructed; a source
tree with a pre-populated `node_modules/` builds without it.)

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

For local development, `make devel-install` symlinks `dist/` into
`~/.local/share/cockpit/apparmor`, after which the module is available in the
Cockpit web console at `/cockpit/@localhost/apparmor/index.html`.

## Desktop integration

This module runs both in the Cockpit **web console** and as a standalone
**desktop application**. The installed `AppArmor` launcher in your application
menu opens the module in its own window through `cockpit-desktop(1)` - with no
browser, no login, and without `cockpit.socket` being enabled. See the
`cockpit-desktop` man page for details.

The launcher is shipped in the package's `share/applications/` directory together
with an icon in `share/icons/hicolor/scalable/apps/`. A `cockpit-desktop`
implementation is provided by the `cockpit-ws` package, which is why this package
recommends it. AppArmor itself must be available on the host (the module is only
shown where `/sys/kernel/security/apparmor` exists).

### Desktop theme (dark mode)

The standalone desktop window follows your system's light/dark theme, just like
the web console. By default it may not: the native client that `cockpit-desktop`
launches (`cockpit-client`, a WebKitGTK app) resolves the CSS
`prefers-color-scheme` query from the GTK setting
`gtk-application-prefer-dark-theme` - **not** from libadwaita's
`Adw.ColorScheme`. Stock `cockpit-client` forces
`Adw.ColorScheme.PREFER_LIGHT` and never sets that GTK setting, so on a dark
desktop the module still renders light (the bundled `cockpit-dark-theme.js`
strips the `pf-v5-theme-dark` class in that case).

Fix, a two-line change in `cockpit-client`'s `do_startup()` method:

    Gtk.Settings.get_default().set_property('gtk-application-prefer-dark-theme',
                                            Adw.StyleManager.get_default().get_dark())

placed just before the existing
`Adw.StyleManager.get_default().set_color_scheme(Adw.ColorScheme.PREFER_LIGHT)`.

Locate the file on any distribution, e.g.:

    dpkg -L cockpit-ws | grep cockpit-client    # Debian/Ubuntu
    rpm -ql cockpit-ws | grep cockpit-client    # Fedora/RHEL

Edit it, then relaunch the app:

    cockpit-desktop apparmor

The window now follows the desktop theme on every launch. This is deliberately
the lowest-common-denominator fix: plain shell, no extra tooling, any
distribution - and it also fixes every other Cockpit page in the native client
(system, docker, ...).

Notes:

- A `cockpit*` package upgrade overwrites the file - keep the snippet (or a
  backup, e.g. `cp cockpit-client cockpit-client.bak`).
- The Flatpak client (`flatpak run org.cockpit_project.CockpitClient`) needs the
  same two lines in its own copy of the file.
- The web console in a regular browser is unaffected - it follows the system
  theme on its own.

See [HACKING.md](HACKING.md) for development workflows (`make devel-install`,
watch mode, linting).

## Credits

- **Cockpit Project** (https://cockpit-project.org, LGPL-2.1-or-later) - the web
  console this module plugs into, and the build machinery it reuses: `pkg/lib/*`
  (including `cockpit-dark-theme.js`, the theme handling bundled into the page),
  `build.js` and its esbuild plugins (PO translations, rsync, compression),
  plus `HACKING.md`, `Makefile` and the packaging layout.
- **chabad360/cockpit-docker** (LGPL-2.1-or-later, https://github.com/chabad360/cockpit-docker)
  - the project this is based on; build and packaging scaffolding is inherited
  from it.
- **PatternFly 5** (https://www.patternfly.org, MIT) - the design system and
  React component library, including the dark/light palette selected by
  `pf-v5-theme-dark`.
- **React** (MIT) - user-interface framework.
- **esbuild / esbuild-wasm** (MIT) - the bundler driving `build.js`.
- Other bundled npm libraries: `date-fns`, `ipaddr.js`, `prop-types`,
  `throttle-debounce`.
- **AppArmor** (https://apparmor.net) - the Linux security module being managed;
  operations shell out to its standard tools (`aa-status`, `aa-enforce`,
  `aa-complain`, `aa-disable`, `apparmor_parser`).

Individual files keep their original copyright and SPDX license headers in
`src/` and `pkg/`; the full LGPL-2.1 text is in [LICENSE](LICENSE).