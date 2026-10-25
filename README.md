# RegenRadar

Free, open-source (MIT) rain app in the style of Buienalarm. No API keys, no backend, no tracking.

- **Rain forecast** in 15-minute steps for the next 2 h, with "rain starts at …" summary (Open-Meteo; KNMI HARMONIE / DWD ICON in Europe)
- **Live radar** with animation (RainViewer) on OpenStreetMap
- Current weather, 24 h and 7-day forecast, city search + GPS
- **Notifications** before rain starts (configurable intensity and lead time)
- Installable PWA, works offline for the shell

## Run
Any static host (GitHub Pages, Netlify, `python3 -m http.server`). Geolocation and notifications need HTTPS or localhost.

## Always-on alerts (free)
Browsers can't run reliably when closed, so for true background alerts:
1. Install the **ntfy** app and subscribe to a private random topic.
2. In your fork: Settings → Secrets → `NTFY_TOPIC`; Variables → `LAT`, `LON`.
3. The `rain-alert` workflow checks every ~10 min (GitHub cron may be delayed).

## Notes
RainViewer's free tier has limited zoom (≤7) and little/no future radar; the 2 h rain bars come from Open-Meteo's model nowcast, which is less precise than Buienalarm's radar-based 5-min nowcast.
