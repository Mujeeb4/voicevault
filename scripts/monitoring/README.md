# VoiceVault production monitoring

`voicevault-watchdog.py` runs on the VPS every 2 hours (systemd timer) and emails
`ALERT_EMAILS` in `backend/.env` (or `ADMIN_EMAILS` if that's unset) only when something is wrong: a failed check, or any error the backend or
worker logged in those 2 hours. A clean run sends nothing. It sends with the SMTP settings in
`backend/.env` directly, so alerts work even when the app is down. It can't alert if the
whole server is down: an external uptime monitor covers that (see the end of this file).

Checks: main site, `/api/health/`, `/api/ready/` (database + cache), admin dashboard, the six
containers, disk usage (alert at 85%), HTTPS certificate expiry (alert under 14 days) for
both hosts, and every ERROR/CRITICAL line from the backend and worker since the last run
(grouped and counted; bots probing the Stripe webhook are ignored).

## Install or update on the VPS

```sh
scp scripts/monitoring/voicevault-watchdog.py root@72.61.76.103:/usr/local/sbin/voicevault-watchdog
scp scripts/monitoring/voicevault-watchdog.service scripts/monitoring/voicevault-watchdog.timer root@72.61.76.103:/etc/systemd/system/
ssh root@72.61.76.103 'chmod 700 /usr/local/sbin/voicevault-watchdog && systemctl daemon-reload && systemctl enable --now voicevault-watchdog.timer'
```

## Use

```sh
voicevault-watchdog --dry-run      # run every check and print results, send nothing
voicevault-watchdog --test-email   # confirm alert emails arrive
systemctl list-timers voicevault-watchdog.timer
journalctl -u voicevault-watchdog --since today
```

## Whole-server outages

The watchdog runs on the server, so it can't report the server itself being down. A free
external monitor covers that: in UptimeRobot (or Better Stack), add an HTTP(S) monitor for
`https://voicevault.life/api/ready/` (expects 200) with email alerts.
