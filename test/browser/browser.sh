#!/bin/sh

set -eux
cd "${0%/*}/../.."

# Show critical package versions
rpm -q apparmor apparmor-utils aa-status kernel-core cockpit-apparmor cockpit-bridge || true

# allow test to set up things on the machine
mkdir -p /root/.ssh
curl https://raw.githubusercontent.com/cockpit-project/bots/main/machine/identity.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# create user account for logging in
if ! id admin 2>/dev/null; then
    useradd -c Administrator -G wheel admin
    echo admin:foobar | chpasswd
fi

# set root's password
echo root:foobar | chpasswd

# avoid sudo lecture during tests
su -c 'echo foobar | sudo --stdin whoami' - admin

# disable core dumps, we rather investigate them upstream where test VMs are accessible
echo core > /proc/sys/kernel/core_pattern

# image setup, shared with upstream tests
sh -x test/vm.install

CONTAINER="$(cat .cockpit-ci/container)"

# import the test CONTAINER image as a directory tree for nspawn
mkdir /var/tmp/tasks
podman export "$(podman create --name tasks-import "$CONTAINER")" | tar -x -C /var/tmp/tasks
podman rm tasks-import

systemctl enable --now cockpit.socket

# Run tests in the cockpit tasks container, as unprivileged user
# Use nspawn to avoid the tests killing the tasks container itself
chown -R 1111:1111 "${TMT_TEST_DATA}" .

SYSTEMD_SECCOMP=0 systemd-nspawn \
    -D /var/tmp/tasks/ \
    --ephemeral \
    --user user \
    --setenv=TEST_AUDIT_NO_SELINUX="${TEST_AUDIT_NO_SELINUX:-}" \
    --bind="${TMT_TEST_DATA}":/logs --setenv=LOGS=/logs \
    --bind="$(pwd)":/source --setenv=SOURCE=/source \
    --bind-ro=/usr/lib/os-release:/run/host/usr/lib/os-release \
    sh /source/test/browser/run-test.sh "$@"