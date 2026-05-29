# adult-math-controls Specification

## Purpose
Define adult-visible settings for grade scope, operations, ranges, session length, rewards, persistence, and reset behavior while keeping child play uncluttered.
## Requirements
### Requirement: Adult settings are separated from child play
The system SHALL keep grade, operation, range, persistence, and reset settings behind adult-oriented navigation rather than on the main child play surface.

#### Scenario: Child is playing
- **WHEN** the main child play surface is visible
- **THEN** adult configuration controls, reset controls, import/export controls, and debugging details are not visible

#### Scenario: Adult opens settings
- **WHEN** an adult opens the settings area
- **THEN** adult controls for grade lanes, operations, ranges, session length, and reward settings are available

### Requirement: Adult-configurable skill scope
The system SHALL let adults narrow or broaden the math skills available to the child without editing source code.

#### Scenario: Adult enables operations
- **WHEN** an adult enables addition, subtraction, multiplication, division, fractions, or decimals
- **THEN** future generated prompts only use enabled operations that are valid for the selected grade lanes

#### Scenario: Adult enables multiple grade lanes
- **WHEN** an adult checks more than one grade lane
- **THEN** the child launcher exposes paths from each selected lane without requiring a grade dropdown change

#### Scenario: Adult enables Grade 2 skills
- **WHEN** an adult selects Grade 2
- **THEN** controls are available for Add, Subtract, Place Value, Skip Count, Groups, Mix, and relevant range/difficulty settings

#### Scenario: Adult enables Grade 3 skills
- **WHEN** an adult selects Grade 3
- **THEN** controls are available for Times, Divide, Arrays, Mix, factor ranges, and relevant range/difficulty settings

#### Scenario: Adult enables Grade 4 skills
- **WHEN** an adult selects Grade 4
- **THEN** controls are available for Fractions, Decimals, Mix, and relevant visual model difficulty settings

#### Scenario: Adult changes number ranges
- **WHEN** an adult changes allowed number ranges
- **THEN** future prompts respect those ranges and avoid generating out-of-range answers

### Requirement: Adult-configurable session length
The system SHALL let adults configure default session length while preserving child-safe defaults.

#### Scenario: Default settings are used
- **WHEN** no adult setting has changed
- **THEN** early-grade sessions use a short default and older-grade sessions use a slightly longer default

#### Scenario: Session length changes
- **WHEN** an adult changes session length
- **THEN** future sessions use the configured length within a reasonable bounded range

### Requirement: Local progress controls
The system SHALL persist meaningful progress locally and provide adult-visible reset behavior.

#### Scenario: Progress is saved
- **WHEN** the child completes prompts or sessions
- **THEN** the app saves versioned local progress that can survive page reloads

#### Scenario: Adult resets progress
- **WHEN** an adult chooses to reset math progress
- **THEN** the app asks for confirmation and resets math progress without affecting other Grandkid Games apps

### Requirement: Grade 2/3 defaults are conservative
The system SHALL default new Grade 2/3 settings to readable, low-friction practice before enabling harder variants.

#### Scenario: Grade 2 is selected for the first time
- **WHEN** an adult switches to Grade 2 without custom settings
- **THEN** two-digit add/subtract starts without regrouping and uses bounded ranges suitable for an initial playtest

#### Scenario: Grade 3 is selected for the first time
- **WHEN** an adult switches to Grade 3 without custom settings
- **THEN** multiplication, division, and arrays are enabled with bounded ranges while fractions and decimals remain disabled until an adult enables them

#### Scenario: Harder variants are available
- **WHEN** an adult opens detailed settings
- **THEN** regrouping, fractions, decimals, broader factor ranges, mixed review, and optional challenge settings are visible as adult choices rather than child launcher clutter

### Requirement: Save migration preserves existing progress
The system SHALL migrate existing Math Rewards local saves without losing accepted first-slice progress.

#### Scenario: Existing save loads after Grade 2/3 update
- **WHEN** the app loads a current K/1 save
- **THEN** completed prompt counts, completed sessions, best streak, reward reveal progress, and compatible settings are preserved

#### Scenario: New settings are missing from old save
- **WHEN** the app migrates an old save without Grade 2/3 fields
- **THEN** new fields receive safe defaults and gameplay remains available

### Requirement: Adults can stage fraction and decimal difficulty
The system SHALL let adults tune which Grade 4 fraction and decimal prompt families are available while keeping child choices simple on the play surface.

#### Scenario: Adult opens fraction settings
- **WHEN** an adult configures fraction practice
- **THEN** controls are available for name/match, compare, equivalent, and same-denominator add/subtract modes

#### Scenario: Adult opens decimal settings
- **WHEN** an adult configures decimal practice
- **THEN** controls are available for tenths name/match, tenths compare, equivalent tenths/hundredths, add/subtract tenths, hundredths name/match, and hundredths add/subtract modes

#### Scenario: Defaults are used
- **WHEN** no adult has changed fraction/decimal mode settings
- **THEN** fractions default to name/match plus compare, and decimals default to child-selectable tenths and hundredths name/match plus compare

#### Scenario: Child chooses decimal size
- **WHEN** the child opens Grade 4 decimal practice
- **THEN** the child can choose tenths or hundredths without entering adult settings

#### Scenario: Advanced operation modes exist
- **WHEN** add/subtract modes are available
- **THEN** adult settings can tune or disable them if playtest shows frustration
