# Plyo

A lightweight hub of casual games you can play against a bot, with a friend on the same device, or online.

The first game is **Hand Cricket**: a digital take on the playground game, played with a stylised 3D hand that can show all 32 finger combinations.

## Hand Cricket

Every ball, the batter and the bowler each choose which fingers to raise, in secret. Both hands are revealed at the same moment.

- **Runs:** closed fist `00000` = 0, thumb only `10000` = **6**, any other hand = one run per raised finger (so all five, `11111`, = 5).
- **Out:** only when the bowler's hand is **exactly** the batter's hand, finger for finger. Two different four-finger hands (`01111` vs `11101`) are *not out*; the batter scores 4.
- **Match:** coin toss, then two innings with one wicket each and 2, 5 or 10 overs a side. The chasing side wins by passing the target. Equal scores are a tie.

Fingers are always written in the order **thumb, index, middle, ring, little**, where `1` is raised and `0` is folded.

### Modes

| Mode | What it is |
|---|---|
| Play the bot | Easy, medium or hard. The bot commits to its hand before you choose, and only ever sees hands already revealed. Medium and hard learn your habits (frequency plus what you tend to play next). |
| Pass & play | Two players on one device. Each player picks behind a hand-off screen, then both hands are revealed together. |
| Play online | Create a room, share the 5-character code or invite link, ready up, and play on two devices through the Plyo server. |

### Features

- Procedurally modelled 3D right hand (Three.js), with no image assets. It is shown palm-down with the back of the hand to the camera, hovering over a cricket pitch. Each digit has its own joints and moves on a damped spring, so one model covers all 32 gestures.
- Tap fingers directly on your 3D hand, use the on-screen finger buttons, or press keys `1`–`5` (thumb to little) and `Enter`.
- Countdown with fist pumps, a simultaneous reveal, and animations for runs, sixes and wickets. Manual-scoreboard tiles flip when the score changes.
- Synthesised sound effects (Web Audio) with a mute button. Optional vibration. A reduced-motion setting that follows the device by default.
- Profile with name, hand skin tone, right or left hand, and career stats per mode, stored on the device.
- A rules screen with an interactive OUT example and all 32 hands. It is shown before your first match.
- Online play: an authoritative server that never sends a hand before both players lock in. It also has:
  - a 30-second shot clock
  - a 45-second reconnect window (the match resumes after a dropped connection or a page reload)
  - clear messages when a match is abandoned
  - rematches

## Getting started

Requires **Node.js 20+**.

```bash
npm install
npm run dev
```

`npm run dev` starts both the web app (Vite, http://localhost:5173) and the multiplayer server (port 8787). Vite proxies `/ws` to the server, so online play works locally.

To try online play on two devices on your network, open `http://<your-computer-ip>:5173` on the second device.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | App and multiplayer server with hot reload |
| `npm run dev:web` | App only (online mode will report that the server is unreachable) |
| `npm run server` | Multiplayer server only |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript project check |
| `npm run build` | Type-check and build the web app to `dist/` |
| `npm start` | Build, then serve the app and WebSocket from one Node process on `PORT` (default 8787) |

### Deploying

`npm start` serves everything from a single process: static files from `dist/`, the game socket at `/ws`, and `/health` for health checks. Any Node host that supports WebSockets works. If the app is hosted separately from the server, set the server address in **Settings → Online** (for example `wss://your-server/ws`). You can also restrict browser origins with `PLYO_ORIGINS=https://your-site.example`.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | HTTP and WebSocket port |
| `PLYO_ORIGINS` | *(any)* | Comma-separated list of allowed browser origins |

No secrets or API keys are needed.

## Project structure

```
src/
  App.tsx                    App shell routing (hash routes)
  platform/                  Shared, game-agnostic services
    games.ts                 Game registry: the lobby only sees metadata; games load lazily
    router.ts  store.ts      Tiny hash router and localStorage-backed stores
    prefs.ts  profile.ts     Settings and player profile/stats
    sound.ts                 Synthesised sound effects
  shell/                     Layout, tab bar, icons, form controls
  screens/                   Lobby, Profile, Settings
  styles/global.css          Design tokens and shared components
  games/hand-cricket/
    HandCricketGame.tsx      Module entry: owns every #/hand-cricket route
    engine/                  Pure TypeScript, shared by browser and server
      gestures.ts            32 gestures, scoring, exact-match OUT rule
      match.ts               Match reducer: toss, innings, overs, target, result
      ai.ts                  Bot opponent (easy, medium, hard)
    hand/                    3D hand model and stage (Three.js)
    ui/                      Match view, finger picker, scoreboard, toss, result, rules
    modes/                   Bot, pass & play and online controllers
    net/                     Wire protocol and reconnecting WebSocket client
server/
  index.ts                   HTTP + WebSocket server
  rooms.ts                   Rooms, toss, simultaneous reveal, timeouts, reconnects
tests/                       Engine, bot, room and end-to-end server tests
dev/lab.html                 Hand lab for development: /dev/lab.html?p=01111&o=11101
```

### Adding a game

1. Create `src/games/<id>/` with a default-exported component that takes `{ route }`.
2. Register it in `src/platform/games.ts` with `status: 'playable'` and a lazy `Component`.

The lobby, navigation, profile and settings need no changes. Shared pieces (sound, preferences, stats, scoreboard tiles, buttons) live in `platform/`, `shell/` and `styles/`.

## Dependencies

Runtime: `react`, `react-dom`, `three` (3D hand), `ws` (multiplayer server), `tsx` (runs the TypeScript server), and `@fontsource-variable/big-shoulders-display` and `@fontsource-variable/instrument-sans` (self-hosted fonts).

Development: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `concurrently`, `cross-env`, and type packages.

Everything is free and open source. No paid services are used.

## Status

Not yet built: the other games shown in the lobby (Odd or Even, Paper Duel, Dots & Boxes) are marked "Coming soon" and can't be opened. Online play has no accounts or matchmaking. You play friends by room code, and stats are stored per device.
