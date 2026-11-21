# NeuraChess Frontend

A bespoke, production-grade chess intelligence interface designed for the NeuraChess custom AI engine. Built with React 19, TypeScript, Vite, Tailwind CSS v4, and Motion.

---

## Creative Direction: "The Intelligence Atelier"

NeuraChess treats chess as a focused analytical laboratory where classical strategy meets deep neural assessment. The interface combines:
- **Atmospheric Palette:** Warm midnight charcoal (`#0e0d0b`), layered stone graphite, and restrained copper/amber accents (`#b87333`).
- **Typographic Precision:** Cormorant Garamond display serif for brand authority, DM Sans for interface clarity, and JetBrains Mono for exact numerical coordinates and metrics.
- **Micro-Engineered Motion:** Signature 5-node branching search tree thinking indicator, physical spring evaluation transitions, and smooth piece interpolation.
- **Architectural Integrity:** FastAPI owns the match rules, positions and move history. The board uses `chess.js` for previews and `react-chessboard` for rendering.

---

## Project Structure

```text
frontend/
├── src/
│   ├── app/
│   │   ├── App.tsx                     # Top-level state-based navigation
│   │   ├── providers.tsx               # Context providers (Settings)
│   │   └── pages/
│   │       ├── PlayPage.tsx            # Flagship human-vs-engine arena
│   │       ├── AnalysisPage.tsx        # Position inspection & FEN laboratory
│   │       ├── AboutPage.tsx           # Editorial engine architecture briefing
│   │       └── SettingsPage.tsx        # Themes, rules, and calculation settings
│   ├── components/
│   │   ├── chess/
│   │   │   ├── ChessBoard.tsx          # Responsive board with legal moves & highlights
│   │   │   ├── BoardCoordinates.tsx    # Precision rank & file markers
│   │   │   ├── CapturedPieces.tsx      # Captured piece tallies & material balance
│   │   │   ├── EvaluationBar.tsx       # Smooth spring-animated evaluation gauge
│   │   │   ├── ThinkingIndicator.tsx   # Signature branching search tree pulse
│   │   │   ├── PromotionDialog.tsx     # Accessible pawn promotion picker
│   │   │   ├── PlayerInfo.tsx          # Active turn indicators & player status
│   │   │   ├── GamePanel.tsx           # Moves ledger, status, and controls
│   │   │   ├── EngineStatus.tsx        # Calculation timer & mode badges
│   │   │   ├── MoveHistory.tsx         # Clickable SAN history & review mode
│   │   │   ├── GameControls.tsx        # Undo, redo, flip, FEN copy/import, resign
│   │   │   ├── GameSetupModal.tsx      # Color choice & depth configuration
│   │   │   └── GameOverOverlay.tsx     # Game termination presentation
│   │   ├── analysis/
│   │   │   ├── AnalysisPanel.tsx       # Search results and best move
│   │   │   ├── FenInput.tsx            # Validated FEN entry & clipboard copy
│   │   │   └── PositionPresets.tsx     # Notable curated chess positions
│   │   ├── layout/
│   │   │   ├── AppShell.tsx            # Sticky header with sliding nav indicator
│   │   │   └── PageTransition.tsx      # Cohesive entrance/exit animations
│   │   └── ui/
│   │       ├── Button.tsx              # Tactile buttons with tap animations
│   │       ├── IconButton.tsx          # Accessible square icon buttons
│   │       ├── Badge.tsx               # Status & mode badges
│   │       ├── Switch.tsx              # Accessible animated toggles
│   │       ├── Select.tsx              # Native accessible select menus
│   │       └── Separator.tsx           # Fine architectural dividers
│   ├── features/
│   │   ├── game/
│   │   │   └── useGameState.ts         # Server snapshots, move requests and history review
│   │   └── settings/
│   │       ├── useSettings.ts          # LocalStorage persistence hook
│   │       └── settingsContext.tsx     # Global settings provider
│   ├── api/
│   │   └── backendAdapter.ts           # FastAPI HTTP client
│   ├── lib/
│   │   └── chessUtils.ts               # Material valuation, SAN/UCI parsing, checks
│   ├── styles/
│   │   └── globals.css                 # Design tokens, fonts, and scrollbars
│   └── types/
│       ├── chess.ts                    # Full chess domain typings
│       ├── engine.ts                   # Request/response models
│       └── settings.ts                 # User preference schema
├── API_CONTRACT.md                     # FastAPI endpoint contract
└── package.json
```

---

## Getting Started

Start the [FastAPI backend](../README.md#run-neurachess-locally), then use Node.js 22 and npm from the frontend directory.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. The default API URL is `http://localhost:8000`. Set `VITE_API_URL` at development or build time to change it. The [API contract](API_CONTRACT.md) describes the requests and responses.

Choose a side and evaluation mode in the match setup dialog. Refreshing the browser restores your match and analysis position while the game server is running. Use **Settings** to set the search time budget for new games and analyses. To analyze a position, enter a FEN, select a preset, or move pieces on the Analysis board, then select **Analyze Position** to show the engine’s best-move arrow.

## Verification

```sh
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

With FastAPI and the production preview running locally, run the browser gameplay checks from this directory.

```sh
node scripts/e2e_gameplay.cjs
```

The browser check uses Google Chrome or the executable specified by `CHROME_BIN`, the real API and the trained checkpoint. It defaults to `http://127.0.0.1:4173` and `http://127.0.0.1:8000`. Override those with `E2E_FRONTEND_URL` and `E2E_API_URL`. Set `E2E_SCREENSHOT_DIR` to save gameplay screenshots.
