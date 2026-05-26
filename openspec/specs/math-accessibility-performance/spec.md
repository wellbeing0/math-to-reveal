# math-accessibility-performance Specification

## Purpose
Define iPad-first layout, large touch controls, reduced-motion behavior, audio lifecycle safety, static deployment, and graceful asset fallback.
## Requirements
### Requirement: iPad-first responsive layout
The system SHALL be usable on iPad Safari/PWA with stable touch controls and no overlapping UI.

#### Scenario: iPad viewport loads
- **WHEN** the math game loads at an iPad-sized viewport
- **THEN** the prompt, answer controls, reward/progress track, and primary actions fit without incoherent overlap

#### Scenario: Phone-width viewport loads
- **WHEN** the math game loads at a narrow mobile viewport
- **THEN** controls do not cover the active prompt or reward track

#### Scenario: Keypad prompt loads
- **WHEN** a Grade 2 or Grade 3 broad-answer prompt uses the numeric keypad
- **THEN** the keypad, prompt, feedback, and reward panel fit without text clipping or control overlap on iPad and phone-width layouts

### Requirement: Large readable controls
The system SHALL use large, readable tap targets for child-facing actions.

#### Scenario: Answer controls render
- **WHEN** answer choices or keypad buttons are visible
- **THEN** each child-facing control is large enough for reliable touch input and uses text that fits within the control

#### Scenario: Keypad controls render
- **WHEN** the numeric keypad is visible
- **THEN** digit, clear, backspace, and submit controls have stable dimensions and do not shift layout while the answer changes

### Requirement: Reduced motion support
The system SHALL respect reduced-motion settings for gameplay feedback and reward animation.

#### Scenario: Reduced motion is enabled
- **WHEN** browser or app reduced-motion preference is active
- **THEN** character movement, reward animation, and feedback effects use static or minimal-motion alternatives

### Requirement: Audio lifecycle safety
The system SHALL handle optional sound effects in a way that does not break iPad browser behavior.

#### Scenario: Sound is enabled
- **WHEN** the child first triggers gameplay audio
- **THEN** audio starts from a user interaction and can be muted from child-safe controls

#### Scenario: Page is hidden
- **WHEN** the browser tab or PWA is backgrounded
- **THEN** gameplay audio pauses or stops cleanly

#### Scenario: Child repeats an instruction
- **WHEN** the child taps the repeat-instruction control on an active prompt
- **THEN** the app replays the prompt instruction from a local static audio asset when available, with a speech fallback if the asset cannot load

### Requirement: Static deployment and offline posture
The system SHALL be deployable as static web assets and avoid runtime backend dependencies for core play.

#### Scenario: Production build is deployed
- **WHEN** the game is built and deployed to the static host
- **THEN** core gameplay works without backend services, paid runtime APIs, or network calls outside local/static assets

#### Scenario: Asset fails to load
- **WHEN** a non-critical image or sound effect fails to load
- **THEN** the game remains playable with a graceful visual or silent fallback

### Requirement: Grade 2/3 visual prompts stay readable
The system SHALL render arrays, place-value visuals, and equal-groups visuals clearly on child devices.

#### Scenario: Array prompt renders
- **WHEN** an array or simple-area prompt appears
- **THEN** rows, columns, labels, and answer controls remain readable without requiring pinch zoom

#### Scenario: Place-value prompt renders
- **WHEN** a tens/ones prompt appears
- **THEN** visual groups or text labels fit in the prompt panel and do not overlap the answer controls

#### Scenario: Equal-groups prompt renders
- **WHEN** an equal-groups prompt appears
- **THEN** group visuals remain countable and do not create a dense worksheet-like grid

### Requirement: Expanded asset and logic cost stays bounded
The system SHALL keep the Grade 2/3 expansion within the existing static app performance posture.

#### Scenario: Production build completes
- **WHEN** the Grade 2/3 update is built
- **THEN** the app remains a static deployment with no new runtime backend dependency

#### Scenario: Older device loads game
- **WHEN** the game runs on iPad Safari or phone-width browser
- **THEN** Grade 2/3 prompt rendering avoids expensive animation or asset loading that would block core play

### Requirement: Fraction and decimal visuals remain readable on child devices
The system SHALL render fraction and decimal visual models at sizes that remain readable on iPad and phone-width layouts.

#### Scenario: Tenths strip renders
- **WHEN** a tenths prompt appears
- **THEN** the 10 equal parts are large enough to count and do not overlap answer controls

#### Scenario: Hundredths model renders
- **WHEN** a hundredths prompt appears
- **THEN** the 100-part model is readable or replaced with an approved simplified representation on small screens

#### Scenario: Fraction comparison renders
- **WHEN** two fraction models are compared
- **THEN** both models fit on screen with clear labels and tappable choices

#### Scenario: Equivalent representation renders
- **WHEN** equivalent fraction or decimal models appear
- **THEN** paired visuals are aligned so the equal amount can be visually compared without tiny text
