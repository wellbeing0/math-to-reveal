# Math Rewards v0.3.0 OSS Release Notes - 2026-05-29

This release updates the public Math Rewards app with the OSS-safe improvements made since `v0.2.0`, while keeping the repo static-hostable and free of private deployment routes, generated private audio, and private reward catalogs.

## Highlights

- Adds optional workbench handoff support. Public builds can set `VITE_WORKBENCH_HANDOFF_URL` to show a Workbench command for supported prompts.
- Tightens long fraction and decimal prompt layouts so instructions remain readable on phone and iPad-sized screens.
- Keeps teaching aids support-only: repeated-miss recovery can help a child finish the prompt without awarding clean mastery/reward credit.
- Adds icon-labeled command controls for the child game, adult settings, teaching-aid panels, summary actions, keypad Check, and optional Workbench action.
- Hides prompt-specific teaching help until the child chooses Think or Clue, reducing up-front clutter.
- Adds a shared command-icon source and phone e2e coverage for one-line icon command rows and horizontal overflow.

## Public Asset Policy

- Generated Gemini/Aoede audio files are not included in this public release.
- Teaching-aid audio falls back to browser speech in the public build.
- The private full reward-media catalog is not included; the public repo continues to bundle one attributed sample video.
- No backend, accounts, telemetry, private deployment route, or runtime secret is required for the default public app.

## Verification

The release was checked with:

- Public-clean scan.
- Unit tests: 29 passed.
- Production build.
- OpenSpec spec validation.
- Playwright phone e2e: 21 passed.
- Playwright iPad e2e: 19 passed, 2 phone-only checks skipped.

## Commits Since v0.2.0

- `6b53eb6 Keep teaching aids reward-neutral`
- `3d48b9e Tighten math prompt instruction sizing`
- `b563051 Add optional workbench handoff`
