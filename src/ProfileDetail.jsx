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

import React from 'react';
import { Modal, ModalVariant } from "@patternfly/react-core/dist/esm/components/Modal";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { TextArea } from "@patternfly/react-core/dist/esm/components/TextArea";
import { Text, TextVariants } from "@patternfly/react-core/dist/esm/components/Text";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Label } from "@patternfly/react-core/dist/esm/components/Label";

import cockpit from 'cockpit';
import * as client from './aaClient.js';

const _ = cockpit.gettext;

const MODE_COLORS = {
    enforce: "red",
    complain: "orange",
    prompt: "gold",
    kill: "red",
    unconfined: "grey",
};

export const ProfileDetail = ({ profile, onAddNotification, onClose, onChanged }) => {
    const [file, setFile] = React.useState(null);
    const [content, setContent] = React.useState("");
    const [loaded, setLoaded] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        client.findProfileFile(profile.name)
                .then(found => {
                    if (!found) {
                        setError(cockpit.format(_("No profile file found for '$0'. It may be loaded only in memory."), profile.name));
                        setLoaded(true);
                        return null;
                    }
                    return client.readProfileFile(found).then(c => {
                        setFile(found);
                        setContent(c ?? "");
                        setLoaded(true);
                    });
                })
                .catch(ex => {
                    setError(ex.message || _("Failed to read profile."));
                    setLoaded(true);
                });
    }, [profile.name]);

    const modeLabel = client.MODE_LABELS[profile.mode] || profile.mode;

    const save = () => {
        setSaving(true);
        client.writeProfileFile(file, content)
                .then(() => client.reloadProfile(file))
                .then(() => {
                    onAddNotification({ type: "success", error: cockpit.format(_("Profile '$0' updated and reloaded"), profile.name) });
                    setSaving(false);
                    onChanged();
                    onClose();
                })
                .catch(ex => {
                    setSaving(false);
                    setError(ex.message || _("Failed to save profile."));
                });
    };

    return (
        <Modal variant={ModalVariant.large}
               title={cockpit.format(_("Edit profile $0"), profile.name)}
               isOpen
               onClose={onClose}
               footer={
                   <>
                       <Button variant="primary" isDisabled={!file || saving} isLoading={saving} onClick={save}>
                           {_("Save and reload")}
                       </Button>
                       <Button variant="link" onClick={onClose}>{_("Cancel")}</Button>
                   </>
               }>
            {!loaded
                ? <Spinner size="lg" />
                : error
                    ? (
                        <Text component={TextVariants.p} className="aa-dialog-error">{error}</Text>
                    )
                    : (
                        <>
                            <Text component={TextVariants.small} className="aa-dialog-path">
                                {file}{modeLabel ? <> · <Label color={MODE_COLORS[profile.mode] || "grey"} isCompact>{modeLabel}</Label></> : null}
                            </Text>
                            <TextArea className="aa-profile-editor"
                              value={content}
                              onChange={(_ev, value) => setContent(value)}
                              aria-label={_("Profile contents")}
                              rows={20}
                              spellCheck={false}
                              style={{ fontFamily: "var(--pf-v5-global--FontFamily--monospace)" }} />
                        </>
                    )}
        </Modal>
    );
};
