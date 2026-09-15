# super-dollop

Self-hosted Home Assistant, driving Govee + Hue light presets you can
trigger from Google Home — by voice or from routines — over your own
domain.

## Your setup

| Room | Brand | Lights |
|---|---|---|
| Living Room | Govee | Bookshelf (1), TV (4), Sofa (1), Rincon (6) — 12 total |
| Hallway | Hue | 4, linear arrangement |
| Bedroom | Hue | Trevor Lamp, Vivi Lamp, Sofa Lamp |

## What's here

- `homeassistant/lights.yaml` — light *groups* that bundle the Living
  Room banks and the Hallway run into single dimmable/colorable
  entities, so scenes and Google Home see clean targets like "Living
  Room TV" instead of 22 individual bulbs.
- `homeassistant/scenes.yaml` — the actual presets: Movie Night, Relax,
  Bright Daytime, Reading, Party, Goodnight.
- `homeassistant/configuration.yaml` — config keys to load the above and
  expose the presets to Google Assistant. Merge into your real config,
  don't overwrite it.
- `homeassistant/secrets.yaml.example` — copy to `secrets.yaml` and fill
  in (gitignored).
- `docker/` — `docker-compose.yml` + `.env.example` for running Home
  Assistant in Docker on a machine you already own, plus a Cloudflare
  Tunnel sidecar for remote/Google access. Skip this folder entirely if
  you go with a dedicated Raspberry Pi instead (Option A below).

Nothing here is plug-and-play yet — Govee/Hue haven't been paired, and
Google hasn't been linked. Follow the steps below in order.

## 1. Pick your hardware

**Option A — Raspberry Pi + Home Assistant OS (recommended default).**
A Pi 4 or 5 (4GB) with an SSD (avoid SD cards long-term — they wear out),
~$80–110 total. Flash the official Home Assistant OS image with
[balenaEtcher](https://etcher.balena.io/), boot it, and finish setup at
`http://homeassistant.local:8123`. No Docker file needed for this path;
ignore the `docker/` folder.

**Option B — Docker on a machine you already own** (old PC, mini PC,
NAS, spare Mac). Uses `docker/docker-compose.yml` in this repo:

```bash
cd docker
cp .env.example .env   # fill in CLOUDFLARE_TUNNEL_TOKEN once you have it (step 3)
docker compose up -d
```

Home Assistant will be at `http://<that machine's IP>:8123`. Either way,
the machine needs to stay on your home LAN (WiFi is fine, Ethernet isn't
required) so it can reach the Hue Bridge locally — that's not optional,
Hue's local API doesn't work across the internet.

**Running this on a spare MacBook specifically**: needs Docker Desktop
installed, and needs to be kept from sleeping while on AC power —
otherwise Home Assistant goes offline whenever the machine dozes off.
Leave the lid open and go to *System Settings > Battery > Options* and
enable "Prevent automatic sleeping when the display is off" (or run `sudo
pmset -c sleep 0 disksleep 0`); closed-lid operation is unreliable
without an external display attached. Also note: because Docker Desktop
for Mac runs containers inside a VM rather than natively, Hue Bridge
auto-discovery in step 2 may not find your bridge automatically — if so,
add it by entering the bridge's IP address manually when prompted, which
works fine.

## 2. Name your devices, then pair them

Before adding anything to Home Assistant, rename each bulb in its native
app to match the names this repo expects — it saves you from hand-editing
entity IDs afterward:

- **Govee Home app**: name the 14 Living Room lights "Living Room
  Bookshelf", "Living Room TV 1"–"TV 4", "Living Room Sofa", "Living Room
  Rincon 1"–"Rincon 6".
- **Hue app**: keep "Trevor Lamp", "Vivi Lamp", name the third one
  "Bedroom Sofa Lamp" (to avoid colliding with the Living Room Sofa), and
  name the hallway lights "Hallway 1"–"Hallway 4" in their physical
  left-to-right order.

Then in Home Assistant: *Settings > Devices & Services > Add
Integration*, add **Govee** (needs a free API key from the Govee Home
app: profile icon > Settings > Apply for API Key) and **Philips Hue**
(auto-discovers your bridge on the LAN — press the physical button on
the bridge when prompted).

After both are added, check *Settings > Devices & Services > Entities*
and compare the generated `entity_id`s against `homeassistant/lights.yaml`
and `homeassistant/scenes.yaml`. Fix any mismatches — Govee in particular
sometimes appends numeric suffixes that don't match your naming exactly.

## 3. Copy the config in

Copy `homeassistant/lights.yaml`, `homeassistant/scenes.yaml`, and the
relevant keys from `homeassistant/configuration.yaml` into your actual
running config directory (`./homeassistant` for the Docker route, or
`/config` on Home Assistant OS, reachable via the Studio Code Server /
File Editor add-on or Samba). Also copy `secrets.yaml.example` to
`secrets.yaml` there (you'll fill in real values in step 5). Restart Home
Assistant, then check *Developer Tools > States* for `scene.preset_*`
entities to confirm everything loaded.

## 4. Cloudflare Tunnel (remote access on your domain)

This gets `home.yourdomain.com` pointing at your Home Assistant instance
without opening ports on your router or exposing your home IP — and
gives Google Assistant the stable HTTPS URL it requires.

1. In the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/)
   (your domain needs to be on Cloudflare's free DNS): *Networks >
   Tunnels > Create a tunnel*, choose **Docker** as the connector.
2. Cloudflare gives you a `TUNNEL_TOKEN` — put it in `docker/.env` (Option
   B) or run `cloudflared` directly on the Pi (Option A: `sudo
   cloudflared service install <token>`).
3. Back in the dashboard, add a **Public Hostname**: subdomain `home`,
   domain `yourdomain.com`, service `http://homeassistant:8123` if you're
   running the `docker/docker-compose.yml` in this repo (cloudflared
   reaches Home Assistant by its container name on the shared Docker
   network), or `http://localhost:8123` if cloudflared is installed
   directly on Home Assistant OS (Option A).
4. Visit `https://home.yourdomain.com` to confirm it reaches your Home
   Assistant instance.

## 5. Google Assistant (self-hosted)

This is the fiddly part — Google's console has moved around over the
years, so follow Home Assistant's current instructions rather than a
fixed set of clicks here:
https://www.home-assistant.io/integrations/google_assistant/

Broadly, you will:

1. Create a project in the Google Cloud Console, enable the **HomeGraph
   API**.
2. Create a Smart Home Action for that project (currently done via the
   [Google Home Developer Console](https://console.home.google.com)) and
   set the fulfillment URL to `https://home.yourdomain.com/api/google_assistant`.
3. Create a service account with HomeGraph permissions, download its JSON
   key as `homeassistant/google_service_account.json` (gitignored — never
   commit it).
4. Put the project ID in `secrets.yaml` as `google_assistant_project_id`.
5. Restart Home Assistant.

## 6. Link Google Home

In the Google Home app: profile icon > **Works with Google** > search
for **Home Assistant** (shows as a test/dev app tied to your account
since it isn't a published public integration) > sign in. Your six
exposed scenes will show up as devices. Try: *"Hey Google, activate
Movie Night."*

## Adding more presets

Add an entry to `homeassistant/scenes.yaml` with a unique `id` and
`name`, using the entities/groups from `lights.yaml` (or add a new group
there first). Add a matching block under `entity_config` in
`configuration.yaml` so it gets exposed to Google.

## Security notes

- Never commit `secrets.yaml`, `google_service_account.json`, or `.env`
  — all three are gitignored.
- Set a strong Home Assistant account password before exposing it via
  the tunnel; consider enabling multi-factor auth (*Settings > People >
  your profile > Multi-factor Authentication*).
