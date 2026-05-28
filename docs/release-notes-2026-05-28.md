# Math to Reveal v0.2.0 OSS Release Notes - 2026-05-28

This release brings the public Math to Reveal app up to date with the latest OSS-safe gameplay improvements while keeping the repository static-hostable and free of private deployment details or generated private assets.

## Highlights

- Adds cleaner internal boundaries for math settings, session flow, reward progress, and visual rendering.
- Adds answer-cycling support so repeated misses can offer help without awarding clean mastery credit.
- Adds a local teaching-aid catalog with child-facing step panels for understand, plan, try, and check moments.
- Adds prompt-aware SVG teaching-aid visuals that use the active problem numbers.
- Adds adult controls to preview, hide, and restore teaching aids locally.
- Adds optional reward themes backed by live GIPHY assets when a public app build is configured with a GIPHY API key.
- Keeps the default public reward experience on the bundled Pexels sample video.

## Public Asset Policy

- Generated Gemini/Aoede audio files are not included in this public release.
- Teaching-aid audio falls back to browser speech in the public build.
- The private full reward-media catalog is not included; the public repo continues to bundle one attributed sample video.
- No backend, accounts, telemetry, private deployment route, or runtime secret is required for the default public app.

## Verification

The release sync was checked with:

- Public-clean scan.
- Unit tests: 29 passed.
- Production build.
- OpenSpec spec validation.
- Playwright e2e: 39 passed, 1 skipped.

## Commit

- `4929a57 Sync public math app improvements`
