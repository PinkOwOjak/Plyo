# Plyo

Plyo is a set of quick head-to-head games. You can play against a bot, against a friend on the same device, or online. It ships as a **web app** (desktop-first, responsive) and a dedicated **mobile app** (portrait-first, packaged for Android and iOS with Capacitor). Both run on one shared game engine, one 3D hand system and one design system.

The first game is **Hand Cricket**, played with a rigged 3D hand.

## Hand Cricket

Every ball, the batter and the bowler each choose a hand in secret, then both hands are revealed together. Fingers are always read in the order **thumb, index, middle, ring, little**: `1` means raised, `0` means folded. That gives exactly 32 hands.

| Hand | Runs |
|---|---:|
| Closed fist `00000` | 0 |
| Thumb only `10000` (the thumbs-up) | **6** |
| Any other single finger | 1 |
| Any two / three / four fingers | 2 / 3 / 4 |
| All five `11111` | 5 |

### OUT rules

You choose the OUT rule before every match. It is then locked until the match ends. Scoring and OUT detection are separate code (`packages/engine/src/gestures.ts` for scoring, `rules.ts` for OUT detection).

- **Exact match:** the batter is out only when the bowler shows the identical hand, finger for finger. `01111` against `11101` is **not out** (the batter scores 4). `01111` against `01111` is **out**.
- **Finger count:** the batter is out when both hands show the same *number* of raised fingers. `01111` against `11101` is **out**. Thumb only is the exception, because it is the six. Only another thumb-only hand gets it out, and a thumb-only bowl never dismisses a single non-thumb finger (and the reverse).

In online matches the host proposes the rule. Changing it clears both players' ready status, so the toss only starts once both players have readied up under the rule on screen.

### Match

A coin toss decides who chooses to bat or bowl first. Each side gets the same overs (2, 5 or 10, six balls each) and one wicket. The first innings total plus one is the target. Reach it and you win; fall short and the side that batted first wins; equal scores are a tie.

### Ways to play

| | Web | Mobile |
|---|---|---|
| vs bot (easy, medium, hard; the bot picks before you do and learns your habits) | ✓ | ✓ |
| Pass the device (each player picks in secret behind a hand-off screen) | ✓ | ✓ |
| Face to face (phone flat between two players; both tap ready, then three seconds to set fingers) | — | ✓ |
| Online rooms (code or link, rule agreement, 30 s shot clock, 45 s reconnect window, rematches) | ✓ | ✓ |

## The 3D hand

- One skinned, single-mesh right hand with a 25-joint rig. Its forward kinematics are computed in code (`packages/hand3d/src/HandRig.ts`), so each digit bends through its own joints. Every joint rotation carries the rest of the digit with it.
- The default pose is palm down towards the pitch, back of the hand to the camera, fingers extended away from the wrist. Each digit springs between an extended and a folded pose, so all 32 gestures come from the same rig.
- **The six (`10000`) has its own dedicated pose.** The hand closes into a fist with the thumb held straight up and the joint at the thumb's tip locked straight. The forearm rolls 90° so the thumb side is on top, the wrist lifts slightly, and the arm turns so the back of the thumb and its nail face the viewer. This was checked from the gameplay camera on desktop and phone.
- Fingernails are added meshes attached to the tip bones. The thumbnail's direction and depth are measured from the mesh itself.
- The opponent's wrist is lifted slightly so their fingers, which point at the camera, stay readable.
- Hand-art credit: the base mesh is the WebXR “generic-hand” model (MIT licence, see `packages/hand3d/src/assets/LICENSE-webxr-hand.md`). The posing, nails, forearm, sleeves, materials and lighting are Plyo's. The lobby key art is rendered from this same rig.

## Getting started

You need **Node.js 20 or newer**.

```bash
npm install
npm run dev          # web app on http://localhost:5173 + game server on :8787
npm run dev:mobile   # mobile app in the browser on http://localhost:5174 + game server
```

Open the mobile app on a phone on the same network at `http://<your-computer-ip>:5174`.

### Building the mobile app (Android / iOS)

The native projects are in `apps/mobile/android` and `apps/mobile/ios`.

```bash
npm run mobile:android   # builds the mobile web bundle, syncs it, opens Android Studio
npm run mobile:ios       # same for Xcode (macOS only)
```

Then press **Run** in Android Studio or Xcode. The installed app has no same-origin server, so for online play either set the server address in the app's **Settings** (for example `wss://plyo.example.com/ws`), or bake it in at build time with `VITE_PLYO_SERVER=wss://…/ws npm run mobile:android`.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run dev:mobile` | Web or mobile app, plus the game server, with hot reload |
| `npm run server` | Game server only |
| `npm test` | Engine, rules, bot, rooms and end-to-end server tests (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run build` | Typecheck and build both apps |
| `npm start` | Build the web app and serve it with the game server from one process on `PORT` |
| `npm run visual` | Screenshot smoke test of both apps (`CHROME_PATH=…`, dev servers running) |

Dev-only pages: `http://localhost:5173/lab.html?p=10000&o=01111` renders any pair of hands. `keyart.html` renders the lobby art.

## Deploying

`npm start` serves the web app, the WebSocket at `/ws` and `/health` from a single Node process. Any host with WebSocket support works.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | HTTP and WebSocket port |
| `PLYO_ORIGINS` | any | Comma-separated list of allowed browser origins |
| `PLYO_DIST` | `apps/web/dist` | Static files to serve |

No secrets, API keys or paid services are involved.

## Project structure

```
packages/
  engine/    @plyo/engine   gestures and scoring, OUT rules, match reducer, bot, wire protocol (pure TS)
  hand3d/    @plyo/hand3d   rigged hand, poses, six pose, stage, camera presets (Three.js)
  core/      @plyo/core     prefs, profile, sound, haptics adapter, router, net client,
                            match sessions (bot / pass / face to face / online), shared UI pieces
             @plyo/core/arena  React glue for the 3D stage (loaded only with match screens)
  tokens/    @plyo/tokens   design tokens and original artwork
apps/
  web/       desktop-first web app (Vite + React)
  mobile/    portrait mobile app (Vite + React) with Capacitor android/ and ios/ projects
server/      authoritative WebSocket game server (runs the same engine)
tests/       Vitest suites
config/      shared module aliases
```

To add a game, put its rules in a new engine module, register its metadata in `packages/core/src/games.ts`, and give each app its own screens for it. The lobby, navigation, profiles and settings need no changes.

## Status

- Hand Cricket is complete on web and mobile in every mode listed above.
- Odd or Even, Paper Duel and Dots & Boxes are shown as “in development” and can't be opened.
- The Android and iOS projects are generated and configured (portrait lock, haptics, status bar), but they have not been compiled into an APK or IPA from this repository's CI. Build them with Android Studio or Xcode as described above. The app icon is still Capacitor's default.
- Online play has no accounts or matchmaking: friends join by room code. Stats are stored on each device.
