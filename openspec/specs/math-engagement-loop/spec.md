# math-engagement-loop Specification

## Purpose
Define the short-session reward loop, feedback style, world reactions, and repeat-play motivation for Math Rewards.
## Requirements
### Requirement: Short practice sessions
The system SHALL organize child math play into short sessions with visible progress and a simple completion state.

#### Scenario: Session starts
- **WHEN** a child starts a practice path
- **THEN** the app shows the current prompt count and total prompt count

#### Scenario: Older-grade default session starts
- **WHEN** a child starts a Grade 2 or Grade 3 session with default settings
- **THEN** the session may use a slightly longer default than K/1 while staying short enough for one sitting

#### Scenario: Session completes
- **WHEN** the child completes the configured number of prompts
- **THEN** the app shows a brief child-friendly summary and offers continue, replay, and choose another path actions

### Requirement: Visible adventure or reward progress
The system SHALL show a persistent visible reason to keep solving prompts within the current session.

#### Scenario: Child answers correctly
- **WHEN** the child completes a reward-eligible prompt
- **THEN** the reward track advances through a map step, reveal piece, character action, treasure meter, or equivalent visible progress

#### Scenario: Reward animation plays
- **WHEN** reward progress changes
- **THEN** the animation is brief, does not obscure the next prompt for long, and respects reduced-motion settings

### Requirement: Character or world feedback
The system SHALL use character, world, or object reactions to make math practice feel like a game while keeping the prompt readable.

#### Scenario: Prompt is active
- **WHEN** the child is solving a prompt
- **THEN** the equation, quantity, array, or answer controls remain on a solid high-contrast surface

#### Scenario: Correct answer occurs
- **WHEN** the child answers correctly
- **THEN** the character/world gives a short positive reaction such as movement, obstacle clearing, treasure gain, video reveal progress, or visual cheer

#### Scenario: Grade 2/3 prompt appears
- **WHEN** an older-grade prompt requires more reading or calculation
- **THEN** decorative world elements stay secondary and do not compete with the problem statement or keypad

### Requirement: Timer is omitted from the first slice
The system SHALL provide relaxed practice without a countdown timer in the first six-year-old playtest slice.

#### Scenario: Relaxed mode starts
- **WHEN** a child starts a normal practice session
- **THEN** no countdown can fail the prompt or session

#### Scenario: Child is playing
- **WHEN** the child play surface is visible
- **THEN** no timer, countdown, or timed-failure state is visible

### Requirement: Varied feedback
The system SHALL provide varied encouragement for correct answers and gentle varied nudges for incorrect answers.

#### Scenario: Correct answers repeat
- **WHEN** the child answers multiple prompts correctly
- **THEN** feedback varies and may include streak-aware celebration without repeating the exact same message every time

#### Scenario: Incorrect answers repeat
- **WHEN** the child makes multiple incorrect attempts
- **THEN** feedback remains supportive and avoids shaming, score loss language, or adult-only terms

#### Scenario: Concept mistake occurs
- **WHEN** the child misses a place value, skip-counting, multiplication, division, or array prompt
- **THEN** the nudge can point toward the relevant strategy such as tens/ones, counting by groups, or missing-factor thinking

### Requirement: Grade 2/3 reward cadence remains quick
The system SHALL preserve the accepted video reveal reward while adapting session length for older-grade practice.

#### Scenario: Correct Grade 2/3 answer occurs
- **WHEN** the child answers a Grade 2 or Grade 3 prompt correctly
- **THEN** the video reveal reward advances without requiring a full session completion first

#### Scenario: Video completes
- **WHEN** the child reveals all pieces of a video
- **THEN** the next reward media item becomes available through continued play without resetting math progress

### Requirement: Fraction and decimal prompts include game-like visual actions
The system SHALL make fraction and decimal practice feel active by using visual actions such as painting, matching, comparing, and combining parts.

#### Scenario: Visual recognition prompt appears
- **WHEN** the child answers a name or match prompt
- **THEN** the visual model highlights the relevant colored parts or matching amount

#### Scenario: Compare prompt appears
- **WHEN** the child compares two fraction or decimal amounts
- **THEN** both choices are visible, tappable, and quickly readable without needing worksheet-style calculation

#### Scenario: Add/subtract prompt appears
- **WHEN** an add/subtract prompt appears
- **THEN** the prompt uses a combine/remove visual model before or alongside symbolic notation

### Requirement: Fraction and decimal reward pacing remains short
The system SHALL keep fraction and decimal sessions short enough that conceptual prompts still advance the video reveal cadence.

#### Scenario: Fraction or decimal answer is correct
- **WHEN** the child answers a fraction or decimal prompt correctly
- **THEN** reward reveal progress advances using the same non-punitive cadence as other paths
