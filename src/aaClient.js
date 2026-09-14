/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2026 numpyb
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import cockpit from 'cockpit';

const _ = cockpit.gettext;

export const PROFILES_DIR = "/etc/apparmor.d";

/* aa-status exit codes (binutils/aa_status.c) */
export const AA_EXIT_NOT_ENABLED = 1;
export const AA_EXIT_NO_POLICY = 2;
export const AA_EXIT_NO_CONTROL_FILES = 3;
export const AA_EXIT_NOT_PRIVILEGED = 4;

/* profile mode strings as reported by aa-status --json */
export const AA_MODES = ["enforce", "complain", "prompt", "kill", "unconfined"];

export const MODE_LABELS = {
    enforce: _("Enforce"),
    complain: _("Complain"),
    prompt: _("Prompt"),
    kill: _("Kill"),
    unconfined: _("Unconfined"),
    mixed: _("Mixed"),
};

const env = { environ: ["LC_ALL=C"] };

/* Parse and normalize `aa-status --json` output.
 *
 * Modern apparmor (3.x+) emits:
 *   { "version": "2",
 *     "profiles": { "<name>": "<mode>", ... },
 *     "processes": { "<exe>": [ { "profile": .., "pid": .., "status": .. }, ... ] } }
 *
 * Older versions emitted a different shape; be defensive and normalize it.
 */
export function parseStatus(text) {
    const raw = JSON.parse(text);
    const profiles = {};
    const processes = [];

    const rawProfiles = raw.profiles || {};
    for (const [name, mode] of Object.entries(rawProfiles)) {
        if (Array.isArray(mode)) {
            for (const n of mode)
                profiles[n] = { name: n, mode };
        } else {
            profiles[name] = { name, mode };
        }
    }

    const rawProcesses = raw.processes || {};
    if (Array.isArray(rawProcesses)) {
        for (const p of rawProcesses)
            processes.push({ profile: p.profile || p.name, pid: p.pid, exe: p.exe || p.exe_name || "", status: p.mode || p.status });
    } else {
        for (const [exe, entries] of Object.entries(rawProcesses)) {
            if (!Array.isArray(entries)) {
                /* legacy: processes maps exe -> a single process object */
                processes.push({ profile: entries.profile, pid: entries.pid, exe, status: entries.mode || entries.status });
            } else {
                for (const e of entries)
                    processes.push({ profile: e.profile, pid: e.pid, exe, status: e.status });
            }
        }
    }

    return { version: raw.version, profiles, processes };
}

export function getStatus() {
    return cockpit.spawn(["aa-status", "--json"], { ...env, superuser: "try", err: "message" })
            .then(parseStatus);
}

/* profile file name for a profile, following the path -> dot convention */
export function profileFileName(name) {
    const clean = name.startsWith("/") ? name.slice(1) : name;
    return clean.replace(/\//g, ".");
}

export function profileFilePath(name) {
    return `${PROFILES_DIR}/${profileFileName(name)}`;
}

/* Locate the file in PROFILES_DIR that declares the given profile.
 * Tries the conventional path -> dot filename first, then greps for a
 * declaration of the profile name. */
export function findProfileFile(name) {
    const direct = profileFilePath(name);
    return cockpit.file(direct, { superuser: "try" }).read()
            .then(content => content !== null && content !== "" ? direct : null)
            .catch(() => null)
            .then(found => {
                if (found)
                    return found;
                return cockpit.spawn(["grep", "-rl", name, PROFILES_DIR], { ...env, superuser: "try", err: "ignore" })
                        .then(output => {
                            const first = output.trim().split("\n")[0];
                            return first || null;
                        })
                        .catch(() => null);
            });
}

export function readProfileFile(path) {
    return cockpit.file(path, { superuser: "try" }).read();
}

export function writeProfileFile(path, content) {
    return cockpit.file(path, { superuser: "require" }).replace(content);
}

function runAA(argv) {
    return cockpit.spawn(argv, { superuser: "require", ...env, err: "message" });
}

/* set a profile's mode (aa-enforce / aa-complain) and reload it */
export function setProfileMode(profileFile, mode) {
    return runAA([`aa-${mode}`, profileFile]);
}

export function disableProfile(profileFile) {
    return runAA(["aa-disable", profileFile]);
}

/* reload a profile from its file (apparmor_parser -r) */
export function reloadProfile(profileFile) {
    return runAA(["apparmor_parser", "-r", profileFile]);
}

/* load a new profile into the kernel (apparmor_parser -a) */
export function loadProfile(profileFile) {
    return runAA(["apparmor_parser", "-a", profileFile]);
}

/* sanitize a profile file name; reject anything that could escape the profiles dir */
export function sanitizeProfileName(name) {
    const base = name.trim().replace(/^\/+|\/+$/g, "");
    if (!base || base.includes("..") || base.includes("/"))
        return null;
    if (!/^[A-Za-z0-9._@-]+$/.test(base))
        return null;
    return base;
}
