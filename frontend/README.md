# NeuraChess Frontend

A bespoke, production-grade chess intelligence interface designed for the NeuraChess custom AI engine. Built with React 19, TypeScript, Vite, Tailwind CSS v4, and Motion.

---

## Creative Direction: "The Intelligence Atelier"

NeuraChess treats chess as a focused analytical laboratory where classical strategy meets deep neural assessment. The interface combines:
- **Atmospheric Palette:** Warm midnight charcoal (`#0e0d0b`), layered stone graphite, and restrained copper/amber accents (`#b87333`).
- **Typographic Precision:** Cormorant Garamond display serif for brand authority, DM Sans for interface clarity, and JetBrains Mono for exact numerical coordinates and metrics.
- **Micro-Engineered Motion:** Signature 5-node branching search tree thinking indicator, physical spring evaluation transitions, and smooth piece interpolation.
- **Architectural Integrity:** Complete separation between chess rules (`chess.js`), view rendering (`react-chessboard`), and engine communication adapters (`DemoAdapter` vs `BackendAdapter`).

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
│   │   │   ├── AnalysisPanel.tsx       # Analytical metrics & PV visualization
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
│   │   │   └── useGameState.ts         # Central chess logic & race-condition safety
│   │   ├── engine/
│   │   │   └── useEngine.ts            # Adapter lifecycle & asynchronous moves
│   │   └── settings/
│   │       ├── useSettings.ts          # LocalStorage persistence hook
│   │       └── settingsContext.tsx     # Global settings provider
│   ├── api/
│   │   ├── adapter.ts                  # EngineAdapter interface definition
│   │   ├── demoAdapter.ts              # Local legal move generator (offline demo)
│   │   ├── backendAdapter.ts           # Future FastAPI HTTP client
│   │   └── index.ts                    # Dynamic adapter factory
│   ├── lib/
│   │   └── chessUtils.ts               # Material valuation, SAN/UCI parsing, checks
│   ├── styles/
│   │   └── globals.css                 # Design tokens, fonts, and scrollbars
│   └── types/
│       ├── chess.ts                    # Full chess domain typings
│       ├── engine.ts                   # Request/response models
│       └── settings.ts                 # User preference schema
├── API_CONTRACT.md                     # Proposed FastAPI endpoint specifications
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js >= 20.0
- npm >= 9.0

### Installation

```bash
cd frontend
npm install
```

### Running the Development Server

```bash
npm run dev
```

The application will start at `http://localhost:5173`. By default, it operates in **Demo Mode**, using the internal chess engine adapter to guarantee legal moves and instant interactivity without requiring the Python backend to be running.

### Connecting the FastAPI Backend (When Available)

Set the `VITE_ENGINE_MODE` and `VITE_API_URL` environment variables:

```bash
VITE_ENGINE_MODE=backend VITE_API_URL=http://localhost:8000 npm run dev
```

See [API_CONTRACT.md](./API_CONTRACT.md) for endpoint definitions.

---

## Verification & Build

### Type Checking & Build

```bash
npm run build
```

Creates an optimized production bundle in `dist/`.
