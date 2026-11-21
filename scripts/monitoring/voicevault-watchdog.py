#!/usr/bin/env python3
"""
VoiceVault production watchdog (runs on the VPS every 2 hours via a systemd timer).

Checks the public site, the API's database/cache readiness, the containers, disk space and
HTTPS certificate expiry, and collects every error the backend and worker logged since the
last run. It emails ALERT_EMAILS (or, if unset, ADMIN_EMAILS) only when something is wrong;
a clean run sends nothing.

It uses only the Python standard library and sends mail with the SMTP settings in the
backend's .env directly, so alerts still go out when the app itself is down.

  voicevault-watchdog.py              run the checks (what the timer does)
  voicevault-watchdog.py --dry-run    run the checks and print results, send nothing
  voicevault-watchdog.py --test-email send a test alert to confirm delivery
"""
import os
import re
import shutil
import smtplib
import socket
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.message import EmailMessage

ENV_FILE = '/root/voicevault/voicevault/backend/.env'

URLS = {
    'Main site': ('https://voicevault.life/', 200),
    'API health': ('https://voicevault.life/api/health/', 200),
    'API readiness (database + cache)': ('https://voicevault.life/api/ready/', 200),
    'Admin dashboard': ('https://admin.voicevault.life/admin', 200),
}
SLOW_SECONDS = 10
CONTAINERS = [
    'voicevault-production-backend-1',
    'voicevault-production-frontend-1',
    'voicevault-production-worker-1',
    'voicevault-production-beat-1',
    'voicevault-production-redis-1',
    'voicevault-postgres',
]
CERT_HOSTS = ['voicevault.life', 'admin.voicevault.life']
CERT_WARN_DAYS = 14
DISK_WARN_PERCENT = 85
# Matches the timer interval, so each run reports the errors logged since the previous one
ERROR_WINDOW = '2h'
ERROR_SOURCES = ['voicevault-production-backend-1', 'voicevault-production-worker-1']
ERROR_PATTERN = re.compile(r'\b(ERROR|CRITICAL)\b')
# Known noise, not bugs: bots posting unsigned requests to the Stripe webhook (rejected)
IGNORED_ERRORS = ('Invalid webhook signature', 'Invalid webhook payload')


def load_env(path):
    values = {}
    with open(path) as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def check_url(url, expected):
    started = time.monotonic()
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'voicevault-watchdog'})
        with urllib.request.urlopen(request, timeout=20) as response:
            status = response.status
    except urllib.error.HTTPError as exc:
        status = exc.code
    except Exception as exc:  # DNS, TLS, timeout, connection refused
        return False, f'unreachable ({exc.__class__.__name__}: {exc})'
    elapsed = time.monotonic() - started
    if status != expected:
        return False, f'HTTP {status} (expected {expected})'
    if elapsed > SLOW_SECONDS:
        return False, f'very slow: {elapsed:.1f}s'
    return True, f'HTTP {status} in {elapsed:.1f}s'


def check_container(name):
    result = subprocess.run(
        ['docker', 'inspect', '-f',
         '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.RestartCount}}', name],
        capture_output=True, text=True, timeout=20,
    )
    if result.returncode:
        return False, 'container not found'
    state, health, restarts = result.stdout.strip().split('|')
    if state != 'running':
        return False, f'{state} (restarts: {restarts})'
    if health == 'unhealthy':
        return False, f'running but unhealthy (restarts: {restarts})'
    return True, f'{state}, health {health}'


def check_disk():
    usage = shutil.disk_usage('/')
    percent = usage.used / usage.total * 100
    free_gb = usage.free / 1024 ** 3
    return percent < DISK_WARN_PERCENT, f'{percent:.0f}% used, {free_gb:.1f} GB free'


def check_cert(host):
    context = ssl.create_default_context()
    try:
        with socket.create_connection((host, 443), timeout=15) as sock:
            with context.wrap_socket(sock, server_hostname=host) as tls:
                expires = ssl.cert_time_to_seconds(tls.getpeercert()['notAfter'])
    except Exception as exc:
        return False, f'certificate check failed ({exc.__class__.__name__}: {exc})'
    days = (expires - time.time()) / 86400
    return days > CERT_WARN_DAYS, f'expires in {days:.0f} days'


def collect_errors():
    """Error lines logged since the previous run, grouped by message with a count."""
    groups = {}
    for container in ERROR_SOURCES:
        result = subprocess.run(['docker', 'logs', '--since', ERROR_WINDOW, container],
                                capture_output=True, text=True, timeout=60)
        for line in (result.stdout + result.stderr).splitlines():
            if not ERROR_PATTERN.search(line) or any(noise in line for noise in IGNORED_ERRORS):
                continue
            # Drop the timestamp so repeats of the same error group together
            message = re.sub(r'^\S+ \S+ |^\[[^\]]*\] ', '', line).strip()[:300]
            key = f'{container.removeprefix("voicevault-production-").removesuffix("-1")}: {message}'
            groups[key] = groups.get(key, 0) + 1
    return sorted(groups.items(), key=lambda item: -item[1])


def run_checks():
    checks = {}
    for label, (url, expected) in URLS.items():
        checks[label] = check_url(url, expected)
    for name in CONTAINERS:
        checks[f'Container {name}'] = check_container(name)
    checks['Disk space'] = check_disk()
    for host in CERT_HOSTS:
        checks[f'HTTPS certificate {host}'] = check_cert(host)
    return checks


def send_email(env, subject, body):
    # ALERT_EMAILS if set, otherwise the admins
    configured = env.get('ALERT_EMAILS') or env.get('ADMIN_EMAILS', '')
    recipients = [e.strip() for e in configured.split(',') if e.strip()]
    if not recipients:
        raise RuntimeError('ALERT_EMAILS and ADMIN_EMAILS are empty')
    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = env.get('DEFAULT_FROM_EMAIL') or env['EMAIL_HOST_USER']
    message['To'] = ', '.join(recipients)
    message.set_content(body)
    host, port = env['EMAIL_HOST'], int(env.get('EMAIL_PORT', 465))
    user, password = env.get('EMAIL_HOST_USER'), env.get('EMAIL_HOST_PASSWORD')
    if env.get('EMAIL_USE_SSL', '').lower() == 'true':
        server = smtplib.SMTP_SSL(host, port, timeout=30, context=ssl.create_default_context())
    else:
        server = smtplib.SMTP(host, port, timeout=30)
        if env.get('EMAIL_USE_TLS', '').lower() == 'true':
            server.starttls(context=ssl.create_default_context())
    with server:
        if user:
            server.login(user, password)
        server.send_message(message)


def main():
    env = load_env(ENV_FILE)
    stamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')

    if '--test-email' in sys.argv:
        send_email(env, '[VoiceVault] Monitoring test',
                   f'This is a test from the VoiceVault watchdog on the VPS ({stamp}).\n\n'
                   'If you received it, outage alerts will reach you too.')
        print('Test email sent.')
        return

    checks = run_checks()
    failures = [(label, detail) for label, (ok, detail) in checks.items() if not ok]
    errors = collect_errors()

    if '--dry-run' in sys.argv:
        for label, (ok, detail) in checks.items():
            print(f"{'OK  ' if ok else 'FAIL'} {label}: {detail}")
        print(f'{sum(count for _, count in errors)} error lines in the last {ERROR_WINDOW}')
        for message, count in errors[:10]:
            print(f'  {count}x {message}')
        return

    # Nothing wrong: no email
    if not failures and not errors:
        return

    sections = []
    if failures:
        sections.append('PROBLEMS\n' + '\n'.join(f'- {label}: {detail}' for label, detail in failures))
    if errors:
        total = sum(count for _, count in errors)
        listed = '\n'.join(f'- {count}x {message}' for message, count in errors[:20])
        more = f'\n...and {len(errors) - 20} more kinds of error' if len(errors) > 20 else ''
        sections.append(f'ERRORS LOGGED IN THE LAST {ERROR_WINDOW.upper()} ({total} lines)\n{listed}{more}')
    subject = f'[VoiceVault] PROBLEM: {failures[0][0]}' if failures else f'[VoiceVault] {sum(c for _, c in errors)} errors logged'
    if failures and len(failures) > 1:
        subject += f' (+{len(failures) - 1} more)'
    body = (f'VoiceVault watchdog report, {stamp}\n\n' + '\n\n'.join(sections) +
            '\n\nServer: ssh root@72.61.76.103, then: docker ps; docker logs --since 2h <container>\n')
    send_email(env, subject, body)


if __name__ == '__main__':
    main()
