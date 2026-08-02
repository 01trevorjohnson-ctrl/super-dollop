# super-dollop

Home Assistant light presets, wired up to Google Home so you can trigger
them by voice or from Google Home routines/automations.

## What's here

- `scenes.yaml` — the presets themselves (Movie Night, Relax, Bright
  Daytime, Reading, Party, Goodnight). Each one is a Home Assistant
  `scene` entity that sets a group of lights to specific on/off,
  brightness, and color values in one shot.
- `configuration.yaml` — the config keys needed to load `scenes.yaml` and
  expose the scenes to the Google Assistant integration. Merge these keys
  into your existing Home Assistant `configuration.yaml`; don't overwrite
  it wholesale if you already have other integrations set up.

## Setup

1. **Fix the entity IDs.** The `entity_id`s in `scenes.yaml` (e.g.
   `light.living_room_main`) are placeholders. In Home Assistant, go to
   *Settings > Devices & Services > Entities*, filter to `light.`, and
   swap in your real light entity IDs. Adjust brightness (0–255) and
   color values per preset to taste.

2. **Add the scenes to Home Assistant.** Copy `scenes.yaml` into your HA
   config directory (same folder as your main `configuration.yaml`), and
   merge the `scene:` and `google_assistant:` blocks from this repo's
   `configuration.yaml` into yours.

3. **Expose scenes to Google Home.** Two options:
   - **Home Assistant Cloud (Nabu Casa)** — easiest. In HA:
     *Settings > Home Assistant Cloud > Google Assistant*, turn it on,
     and select the `scene.*` entities to expose. No YAML `google_assistant:`
     block needed; skip that part of `configuration.yaml`.
   - **Manual Google Assistant integration** — if you're not on Nabu
     Casa, add the `Google Assistant` integration from *Settings >
     Devices & Services*, which walks you through creating a Google
     Actions project and a service account key. Reference that key's
     path and project ID in the `google_assistant:` block (as
     `SERVICE_ACCOUNT.JSON` / `!secret google_assistant_project_id` in
     the example — put the real project ID in your `secrets.yaml` and
     the downloaded JSON key file alongside your config, and **do not
     commit either to this repo**).

4. **Restart Home Assistant** to load the new config, then check
   *Developer Tools > States* for `scene.preset_movie_night` etc. to
   confirm they loaded.

5. **Link Google Home.** In the Google Home app: profile icon > *Works
   with Google > Home Assistant* (or search *Home Assistant* under
   "Works with Google"), sign in, and your exposed scenes will show up
   as devices you can trigger by name: *"Hey Google, activate Movie
   Night."* Scenes can also be added as buttons in Google Home
   dashboards or as actions inside Google Home routines.

## Adding more presets

Add a new entry to `scenes.yaml` with a unique `id`, a `name` (this is
what Google Home will call it), and the light states you want. Then add
a matching `entity_config` block in `configuration.yaml` if you're using
the manual `google_assistant:` integration (Nabu Casa users just tick the
new scene in the Cloud UI).

## Security note

Never commit `secrets.yaml`, your Google service account JSON key, or
any other credentials to this repo.
