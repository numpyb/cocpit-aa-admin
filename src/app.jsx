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
import { Page, PageSection, PageSectionVariants } from "@patternfly/react-core/dist/esm/components/Page";
import { Alert, AlertActionCloseButton, AlertGroup } from "@patternfly/react-core/dist/esm/components/Alert";
import { EmptyState, EmptyStateHeader, EmptyStateFooter, EmptyStateIcon, EmptyStateActions, EmptyStateVariant } from "@patternfly/react-core/dist/esm/components/EmptyState";
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner";
import { Button } from "@patternfly/react-core/dist/esm/components/Button";
import { Toolbar, ToolbarContent, ToolbarItem, ToolbarGroup } from "@patternfly/react-core/dist/esm/components/Toolbar";
import { SearchInput } from "@patternfly/react-core/dist/esm/components/SearchInput";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect";
import { Label } from "@patternfly/react-core/dist/esm/components/Label";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";
import { Card, CardBody, CardTitle, CardHeader } from "@patternfly/react-core/dist/esm/components/Card";
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { DropdownItem } from "@patternfly/react-core/dist/esm/components/Dropdown/index.js";

import cockpit from 'cockpit';
import { superuser } from "superuser";
import { ListingTable } from "cockpit-components-table.jsx";
import { KebabDropdown } from "cockpit-components-dropdown.jsx";

import * as client from './aaClient.js';
import { ProfileDetail } from './ProfileDetail.jsx';
import { AddProfileModal } from './AddProfileModal.jsx';

const _ = cockpit.gettext;

const MODE_COLORS = {
    enforce: "red",
    complain: "orange",
    prompt: "gold",
    kill: "red",
    unconfined: "grey",
};

const SummaryCards = ({ counts, totalProcesses }) => {
    const cards = [
        { label: _("Enforce"), value: counts.enforce, color: "red" },
        { label: _("Complain"), value: counts.complain, color: "orange" },
        { label: _("Unconfined profiles"), value: counts.unconfined, color: "grey" },
        { label: _("Confined processes"), value: totalProcesses, color: "blue" },
    ];

    return (
        <Card className="aa-summary">
            <CardHeader>
                <CardTitle>{_("Overview")}</CardTitle>
            </CardHeader>
            <CardBody>
                <Flex flexWrap={{ default: "wrap" }} justifyContent={{ default: "justifyContentFlexStart" }}>
                    {cards.map(card => (
                        <Flex className="aa-summary-item" spacer={{ default: "spacer2xl" }} key={card.label}>
                            <Label color={card.color}>{card.value}</Label>
                            <span>{card.label}</span>
                        </Flex>
                    ))}
                </Flex>
            </CardBody>
        </Card>
    );
};

const ProfilesTable = ({ profiles, processesByProfile, onAction }) => {
    const columns = [
        { title: _("Profile"), sortable: true },
        { title: _("Mode") },
        { title: _("Confined processes") },
        { title: "" },
    ];

    const rows = Object.values(profiles)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(profile => {
                const processList = processesByProfile[profile.name] || [];
                const modeCell = <Label color={MODE_COLORS[profile.mode] || "grey"}>{client.MODE_LABELS[profile.mode] || profile.mode}</Label>;

                let processCell = _("0");
                if (processList.length > 0) {
                    processCell = (
                        <Tooltip content={processList.map(p => `${p.pid} ${p.exe}`.trim()).join("\n")}>
                            <span className="aa-proc-count">{processList.length}</span>
                        </Tooltip>
                    );
                }

                const items = [];
                if (profile.mode !== "enforce") {
                    items.push(
                        <DropdownItem key="enforce" onClick={() => onAction("enforce", profile)}>
                            {_("Enforce")}
                        </DropdownItem>
                    );
                }
                if (profile.mode !== "complain") {
                    items.push(
                        <DropdownItem key="complain" onClick={() => onAction("complain", profile)}>
                            {_("Complain")}
                        </DropdownItem>
                    );
                }
                items.push(
                    <DropdownItem key="edit" onClick={() => onAction("edit", profile)}>
                        {_("Edit profile")}
                    </DropdownItem>
                );
                items.push(
                    <DropdownItem key="disable" isDanger onClick={() => onAction("disable", profile)}>
                        {_("Disable")}
                    </DropdownItem>
                );

                return {
                    columns: [
                        profile.name,
                        modeCell,
                        processCell,
                        <KebabDropdown key="actions" toggleButtonId={`aa-actions-${profile.name}`} dropdownItems={items} />,
                    ],
                    profile,
                };
            });

    return <ListingTable columns={columns} rows={rows} variant="compact" emptyCaption={_("No AppArmor profiles loaded")} />;
};

class Application extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            status: null,
            statusLoaded: false,
            statusError: null,
            textFilter: "",
            modeFilter: "all",
            notifications: [],
            dialog: null,
        };
        this.onAction = this.onAction.bind(this);
        this.onAddNotification = this.onAddNotification.bind(this);
        this.onDismissNotification = this.onDismissNotification.bind(this);
        this.refresh = this.refresh.bind(this);
        this.onPrivilegeChanged = this.onPrivilegeChanged.bind(this);
    }

    componentDidMount() {
        this.refresh();
        this.pollTimer = window.setInterval(this.refresh, 10000);
        superuser.addEventListener("changed", this.onPrivilegeChanged);
    }

    componentWillUnmount() {
        if (this.pollTimer !== undefined)
            window.clearInterval(this.pollTimer);
        superuser.removeEventListener("changed", this.onPrivilegeChanged);
    }

    onPrivilegeChanged() {
        this.refresh();
    }

    onAddNotification(notification) {
        notification.index = this.state.notifications.length;
        this.setState(prevState => ({
            notifications: [...prevState.notifications, notification],
        }));
    }

    onDismissNotification(index) {
        this.setState(prevState => ({
            notifications: prevState.notifications.filter(n => n.index !== index),
        }));
    }

    refresh() {
        client.getStatus()
                .then(status => this.setState({ status, statusLoaded: true, statusError: null }))
                .catch(ex => {
                    console.warn("Failed to get AppArmor status:", ex);
                    let error = _("Failed to query AppArmor status.");
                    if (ex.problem === "not-found" || String(ex.message ?? "").includes("aa-status: command not found"))
                        error = _("The AppArmor tools are not installed; install the apparmor package.");
                    this.setState({ statusLoaded: true, statusError: error });
                });
    }

    promptForAdmin() {
        /* opening a superuser:require channel triggers the admin auth dialog */
        cockpit.spawn(["id", "-u"], { superuser: "require", err: "ignore" })
                .then(() => this.refresh())
                .catch(() => {});
    }

    onAction(action, profile) {
        switch (action) {
        case "enforce":
        case "complain":
            this.changeMode(profile, action);
            break;
        case "edit":
            this.editProfile(profile);
            break;
        case "disable":
            this.disableProfile(profile);
            break;
        default:
            console.warn("Unhandled action", action);
        }
    }

    changeMode(profile, mode) {
        client.findProfileFile(profile.name)
                .then(file => {
                    if (!file)
                        throw new Error(cockpit.format(_("Could not find a profile file for '$0'"), profile.name));
                    return client.setProfileMode(file, mode);
                })
                .then(() => {
                    this.onAddNotification({ type: "success", error: cockpit.format(_("Profile '$0' is now in $1 mode"), profile.name, client.MODE_LABELS[mode]) });
                    this.refresh();
                })
                .catch(ex => {
                    this.onAddNotification({ type: "danger", error: cockpit.format(_("Failed to switch profile '$0' to $1 mode"), profile.name, client.MODE_LABELS[mode]), errorDetail: ex.message });
                });
    }

    disableProfile(profile) {
        client.findProfileFile(profile.name)
                .then(file => {
                    if (!file)
                        throw new Error(cockpit.format(_("Could not find a profile file for '$0'"), profile.name));
                    return client.disableProfile(file);
                })
                .then(() => {
                    this.onAddNotification({ type: "success", error: cockpit.format(_("Profile '$0' disabled"), profile.name) });
                    this.refresh();
                })
                .catch(ex => {
                    this.onAddNotification({ type: "danger", error: cockpit.format(_("Failed to disable profile '$0'"), profile.name), errorDetail: ex.message });
                });
    }

    editProfile(profile) {
        this.setState({
            dialog: (
                <ProfileDetail profile={profile}
                               onAddNotification={this.onAddNotification}
                               onClose={() => this.setState({ dialog: null })}
                               onChanged={() => this.refresh()} />
            ),
        });
    }

    addProfile() {
        this.setState({
            dialog: (
                <AddProfileModal onAddNotification={this.onAddNotification}
                                 onClose={() => this.setState({ dialog: null })}
                                 onChanged={() => this.refresh()} />
            ),
        });
    }

    render() {
        const { status, statusLoaded, statusError, textFilter, modeFilter } = this.state;

        const processesByProfile = {};
        const counts = { enforce: 0, complain: 0, prompt: 0, kill: 0, unconfined: 0 };
        let totalProcesses = 0;

        if (status) {
            for (const proc of status.processes) {
                if (!processesByProfile[proc.profile])
                    processesByProfile[proc.profile] = [];
                processesByProfile[proc.profile].push(proc);
                totalProcesses++;
            }
            for (const profile of Object.values(status.profiles))
                counts[profile.mode] = (counts[profile.mode] || 0) + 1;
        }

        const profiles = status?.profiles || {};
        const filteredProfiles = {};
        for (const [name, profile] of Object.entries(profiles)) {
            if (textFilter && !name.toLowerCase().includes(textFilter.toLowerCase()))
                continue;
            if (modeFilter !== "all" && profile.mode !== modeFilter)
                continue;
            filteredProfiles[name] = profile;
        }

        const notificationList = (
            <AlertGroup isToast>
                {this.state.notifications.map(n => (
                    <Alert key={n.index} title={n.error} variant={n.type} isLiveRegion
                           actionClose={<AlertActionCloseButton onClose={() => this.onDismissNotification(n.index)} />}>
                        {n.errorDetail}
                    </Alert>
                ))}
            </AlertGroup>
        );

        if (!statusLoaded) {
            return (
                <Page>
                    {notificationList}
                    <PageSection variant={PageSectionVariants.light}>
                        <EmptyState variant={EmptyStateVariant.full}>
                            <Spinner size="xl" />
                            <EmptyStateHeader titleText={_("Loading...")} />
                        </EmptyState>
                    </PageSection>
                </Page>
            );
        }

        if (statusError) {
            const needAdmin = !superuser.allowed;
            return (
                <Page>
                    {notificationList}
                    <PageSection variant={PageSectionVariants.light}>
                        <EmptyState variant={EmptyStateVariant.full}>
                            <EmptyStateHeader titleText={statusError} icon={<EmptyStateIcon icon={ExclamationCircleIcon} />} headingLevel="h2" />
                            {needAdmin &&
                            <EmptyStateFooter>
                                <EmptyStateActions>
                                    <Button variant="secondary" onClick={() => this.promptForAdmin()}>
                                        {_("Authenticate")}
                                    </Button>
                                </EmptyStateActions>
                            </EmptyStateFooter>
                            }
                        </EmptyState>
                    </PageSection>
                </Page>
            );
        }

        return (
            <Page id="overview">
                {notificationList}
                <PageSection variant={PageSectionVariants.light}>
                    <SummaryCards counts={counts} totalProcesses={totalProcesses} />
                    <Toolbar id="aa-toolbar">
                        <ToolbarContent>
                            <ToolbarGroup>
                                <ToolbarItem>
                                    <SearchInput value={textFilter}
                                                 onChange={(_ev, value) => this.setState({ textFilter: value })}
                                                 placeholder={_("Search profiles")}
                                                 onClear={() => this.setState({ textFilter: "" })} />
                                </ToolbarItem>
                                <ToolbarItem>
                                    <FormSelect value={modeFilter}
                                                onChange={(_ev, value) => this.setState({ modeFilter: value })}
                                                aria-label={_("Filter by mode")}>
                                        <FormSelectOption value="all" label={_("All modes")} />
                                        {client.AA_MODES.map(mode => (
                                            <FormSelectOption key={mode} value={mode} label={client.MODE_LABELS[mode] || mode} />
                                        ))}
                                    </FormSelect>
                                </ToolbarItem>
                                <ToolbarItem>
                                    <Button variant="secondary" onClick={this.refresh}>{_("Refresh")}</Button>
                                </ToolbarItem>
                                <ToolbarItem>
                                    <Button variant="primary" onClick={() => this.addProfile()}>{_("Add profile")}</Button>
                                </ToolbarItem>
                            </ToolbarGroup>
                        </ToolbarContent>
                    </Toolbar>
                </PageSection>
                <PageSection className="aa-pagesection-mobile">
                    <ProfilesTable profiles={filteredProfiles}
                                   processesByProfile={processesByProfile}
                                   onAction={this.onAction} />
                </PageSection>
                {this.state.dialog}
            </Page>
        );
    }
}

export default Application;
