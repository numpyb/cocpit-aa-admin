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
import { Form, FormGroup, FormHelperText } from "@patternfly/react-core/dist/esm/components/Form";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox";
import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText";

import cockpit from 'cockpit';
import * as client from './aaClient.js';

const _ = cockpit.gettext;

export const AddProfileModal = ({ onAddNotification, onClose, onChanged }) => {
    const [name, setName] = React.useState("");
    const [content, setContent] = React.useState("");
    const [persist, setPersist] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState(null);

    const sanitized = name ? client.sanitizeProfileName(name) : null;
    const fileNameValid = name === "" || sanitized !== null;

    const submit = () => {
        if (!sanitized) {
            setError(_("Invalid profile file name; only letters, digits, '.', '-' and '_' are allowed."));
            return;
        }

        setSaving(true);
        const path = `${client.PROFILES_DIR}/${sanitized}`;
        const write = persist ? client.writeProfileFile(path, content) : Promise.resolve();
        write
                .then(() => client.loadProfile(path))
                .then(() => {
                    onAddNotification({ type: "success", error: cockpit.format(_("Profile '$0' loaded"), sanitized) });
                    setSaving(false);
                    onChanged();
                    onClose();
                })
                .catch(ex => {
                    setSaving(false);
                    setError(ex.message || _("Failed to load profile."));
                });
    };

    return (
        <Modal variant={ModalVariant.medium}
               title={_("Add profile")}
               isOpen
               onClose={onClose}
               footer={
                   <>
                       <Button variant="primary" isDisabled={!sanitized || saving} isLoading={saving} onClick={submit}>
                           {_("Load")}
                       </Button>
                       <Button variant="link" onClick={onClose}>{_("Cancel")}</Button>
                   </>
               }>
            <Form>
                <FormGroup label={_("Profile file name")} isRequired fieldId="aa-add-profile-name">
                    <TextInput id="aa-add-profile-name"
                               value={name}
                               onChange={(_ev, value) => setName(value)}
                               placeholder="usr.bin.myapp" />
                    <FormHelperText>
                        <HelperText>
                            <HelperTextItem variant={fileNameValid ? "default" : "error"}>
                                {_("Must be a safe file name in /etc/apparmor.d, e.g. usr.bin.myapp.")}
                            </HelperTextItem>
                        </HelperText>
                    </FormHelperText>
                </FormGroup>
                <FormGroup label={_("Profile contents")} isRequired fieldId="aa-add-profile-content">
                    <TextArea id="aa-add-profile-content"
                              value={content}
                              onChange={(_ev, value) => setContent(value)}
                              aria-label={_("Profile contents")}
                              rows={15}
                              spellCheck={false}
                              placeholder={`profile /usr/bin/myapp {\n  /usr/bin/myapp r,\n}`}
                              style={{ fontFamily: "var(--pf-v5-global--FontFamily--monospace)" }} />
                </FormGroup>
                <Checkbox id="aa-add-profile-persist"
                          label={_("Persist in /etc/apparmor.d (load only if disabled)")}
                          isChecked={persist}
                          onChange={(_ev, checked) => setPersist(checked)} />
                {error &&
                <FormHelperText>
                    <HelperText>
                        <HelperTextItem variant="error">{error}</HelperTextItem>
                    </HelperText>
                </FormHelperText>
                }
            </Form>
        </Modal>
    );
};
