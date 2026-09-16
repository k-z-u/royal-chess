# Royal Chess

A refined 3D chess game that runs entirely in the browser — a full tournament-rules
engine, a thinking opponent, and a premium dark board you can orbit and zoom.

No external 3D models: every piece is generated in code, so the whole game is a
single self-contained bundle.

## Play

```bash
npx royal-chess
```

That starts a local server and opens the game in your browser. Nothing is uploaded
anywhere — the game runs completely client-side.

Options:

```
-p, --port <number>   Port to listen on (default 4173, auto-increments if busy)
    --host <address>  Address to bind (default 127.0.0.1)
    --no-open         Do not open the browser automatically
-h, --help            Show help
-v, --version         Print the version
```

## Features

**Full chess rules** — castling, en passant, promotion, check, checkmate,
stalemate, threefold repetition, the fifty-move rule and insufficient material.
Illegal moves are impossible: the board only offers legal targets.

**A real opponent** — a from-scratch alpha-beta search with iterative deepening,
quiescence search, move ordering and a hand-written evaluation, running in a Web
Worker so the board never stutters while it thinks. Three difficulties, plus a
two-player mode.

**Feel** — smooth arc-eased piece movement, a capture effect, red glow on a king
in check, the last move marked on the board, and a move list you can scroll.

**Look** — wood, stone and metal-inspired PBR materials, soft shadowed lighting,
a reflective table, and a board that stays the hero. Dark, quiet UI with no neon.

**Controls** — drag to orbit, scroll or pinch to zoom, click a piece then a square
to move. Responsive from phone through desktop, including a dedicated portrait
framing.

## Development

```bash
npm install
npm run dev          # dev server with hot reload
npm run build        # type-check and build to dist/
npm start            # serve the production build
```

## Verification

The project ships with its own test harnesses rather than trusting the eye alone:

```bash
npm run verify:engine   # perft against chess.js, rules, tactics, speed, strength
npm run lint            # oxlint
```

```bash
npm run build
npm start -- --port 4173 --no-open &
node scripts/ui-check.mjs http://127.0.0.1:4173/
node scripts/probe.mjs    http://127.0.0.1:4173/    # real clicks via the camera matrices
node scripts/visual.mjs   http://127.0.0.1:4173/    # states worth eyeballing
```

- `scripts/verify-engine.mjs` — perft on six standard positions against chess.js,
  legality on tricky positions, mate-in-one, hanging-queen tactics and a match
  against a random mover.
- `scripts/ui-check.mjs` — headless Playwright pass over selection, illegal moves,
  promotion, en passant, castling, checkmate, undo, the CPU reply and view flip,
  plus responsive screenshots.

## Tech

React · TypeScript · Three.js · React Three Fiber · drei · zustand · chess.js ·
Vite. The engine is written from scratch and verified against chess.js; chess.js
is used for the position model in the UI.

## Licence

MIT
