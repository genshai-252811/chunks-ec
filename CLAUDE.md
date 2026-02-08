# CLAUDE.md - Chunks EC

## Project Overview

Chunks EC is a voice energy practice application for Vietnamese/English pronunciation training. Users record sentences, and the app measures 5 audio metrics (volume, speech rate, acceleration, response time, pause management) with real-time visual feedback and device-independent calibration.

## Tech Stack

- **Framework:** React 18 + TypeScript 5.8
- **Build:** Vite 7 with SWC plugin
- **Styling:** Tailwind CSS 3 + shadcn/ui (Radix UI primitives)
- **State:** TanStack React Query (server state), React hooks (local state)
- **Routing:** React Router DOM 6
- **Backend:** Supabase (PostgreSQL, auth, storage)
- **Audio/ML:** Web Audio API, VAD (Silero via @ricky0123/vad-web), TensorFlow.js, MediaPipe (face/hand tracking)
- **Forms:** React Hook Form + Zod validation
- **Testing:** Vitest + Testing Library + jsdom

## Commands

```bash
npm run dev          # Dev server on localhost:8080
npm run build        # Production build to dist/
npm run build:dev    # Development build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
```

## Project Structure

```
src/
├── pages/           # Route-level components (Index, Auth, Settings, Progress, Admin, NotFound)
├── components/      # Feature components (CameraFeed, ResultsView, CalibrationWizard, EnergyMeter...)
│   ├── admin/       # Admin dashboard components (ImportLessonsDialog, LearnersTab, MetricsTab...)
│   └── ui/          # shadcn/ui components (DO NOT edit manually - use shadcn CLI)
├── hooks/           # Custom React hooks (useAuth, useEnhancedAudioRecorder, useFaceTracking, useVAD...)
├── lib/             # Core business logic (audioAnalysis, lufsNormalization, energyCalculator, metricSettings)
├── integrations/    # Supabase client config & auto-generated types
├── test/            # Test setup (setup.ts with window.matchMedia mock)
└── assets/          # Static files
```

## Architecture

- **SPA** with 5 routes: `/` (practice), `/auth`, `/settings`, `/progress`, `/admin`
- **Data flow:** Components -> Custom Hooks -> Lib utilities -> Supabase / LocalStorage / Browser APIs
- All components are functional with hooks. No class components.
- Audio processing pipeline: MediaRecorder -> VAD -> LUFS normalization -> metric scoring
- Supabase tables: `profiles`, `sentences`, `practice_results`, `metric_settings`, `display_settings`, `user_roles`

## Code Conventions

- **Path alias:** `@/` maps to `./src/` (use for all imports)
- **Components:** PascalCase filenames and exports
- **Hooks:** `use` prefix, camelCase, one hook per file
- **Constants:** UPPER_SNAKE_CASE
- **TypeScript:** Lenient config (no strict null checks, no implicit any allowed). Use interfaces for component props (e.g., `CameraFeedProps`).
- **Styling:** Tailwind utility classes. Use `cn()` from `@/lib/utils` for conditional classes.
- **Notifications:** Use `sonner` toast for user-facing messages
- **Icons:** `lucide-react`

## Key Libraries & Patterns

- **shadcn/ui components** live in `src/components/ui/` - these are generated/managed by shadcn CLI. Don't edit directly unless necessary.
- **React Query** for all Supabase data fetching (queries and mutations)
- **Zod** schemas for form validation paired with `@hookform/resolvers`
- **Framer Motion** for animations
- **Refs** for mutable state (audio contexts, streams, VAD models)
- **useCallback** for stable function references in audio processing

## Environment

- Supabase credentials in `.env` (prefixed with `VITE_`)
- Dev server runs on port 8080
- MediaPipe deps need special Vite optimization (configured in `vite.config.ts`)

## Documentation

Detailed docs in `docs/`:
- `PRD.md` - Product requirements and metric definitions
- `CURRENT-FEATURES.md` - Feature list and architecture overview
- `LUFS-IMPLEMENTATION.md` - Audio normalization technical details
- `AUTO-RECALIBRATION.md` - Calibration system docs
