# math-practice-core Specification

## Purpose
Define Math Rewards's deterministic prompt generation, child-facing practice lanes, answer input, retry behavior, and session progression.
## Requirements
### Requirement: Grade and skill lane selection
The system SHALL support adult-configured Kindergarten, Grade 1, Grade 2, Grade 3, and Grade 4 math practice lanes while presenting child-facing choices in simple play-path language.

#### Scenario: Adult chooses grade lanes
- **WHEN** an adult selects one or more grade lanes in math settings
- **THEN** the available child play paths use the union of skills and number ranges eligible for those selections

#### Scenario: Kindergarten lane is active
- **WHEN** the child opens the play launcher
- **THEN** counting and small addition/subtraction paths are available

#### Scenario: First grade lane is active
- **WHEN** the child opens the play launcher
- **THEN** addition and subtraction paths within the selected answer range are available

#### Scenario: Second grade lane is active
- **WHEN** the child opens the play launcher
- **THEN** Grade 2-eligible paths such as Add, Subtract, Place Value, Skip Count, Groups, and Mix are available according to adult settings

#### Scenario: Third grade lane is active
- **WHEN** the child opens the play launcher
- **THEN** Grade 3-eligible paths such as Times, Divide, Arrays, and Mix are available according to adult settings

#### Scenario: Fourth grade lane is active
- **WHEN** the child opens the play launcher
- **THEN** Grade 4-eligible paths such as Fractions, Decimals, and Mix are available according to adult settings

#### Scenario: Multiple grade lanes are active
- **WHEN** an adult enables multiple grade lanes
- **THEN** the child can choose paths across those grade boundaries without returning to adult settings

#### Scenario: Child opens the play launcher
- **WHEN** a child opens the math game
- **THEN** the child sees a small set of large play choices rather than a full adult settings matrix

### Requirement: One-prompt practice flow
The system SHALL present one active math prompt at a time with one clear answer area and one clear next action.

#### Scenario: Prompt appears
- **WHEN** a practice session starts
- **THEN** the app displays one math prompt, large answer controls, current session progress, and the current reward/progress target

#### Scenario: Prompt advances
- **WHEN** the child completes the active prompt correctly
- **THEN** the app gives immediate feedback and advances to the next prompt or session summary

### Requirement: Touch-first answer input
The system SHALL provide touch-friendly answer input suitable for iPad Safari and early elementary children.

#### Scenario: Young-grade prompt has limited answers
- **WHEN** a Kindergarten, Grade 1, or constrained Grade 2 prompt appears
- **THEN** the app offers large tappable answer choices or visual quantity choices

#### Scenario: Concept prompt has useful distractors
- **WHEN** a place value, skip-counting, equal-groups, array, or constrained multiplication prompt appears
- **THEN** the app may offer large multiple-choice answers with plausible deterministic distractors

#### Scenario: Prompt answer is broad
- **WHEN** a Grade 2 or Grade 3 prompt requires a broader numeric answer
- **THEN** the app offers a large touch keypad with clear and backspace controls rather than relying on the browser keyboard

### Requirement: Deterministic prompt generation
The system SHALL generate prompts through deterministic, testable functions rather than ad hoc UI code.

#### Scenario: Addition/subtraction prompt is generated
- **WHEN** the prompt generator receives operation, range, grade lane, and random source inputs
- **THEN** it returns a prompt, accepted answer, distractors if needed, and skill metadata

#### Scenario: Grade 2 prompt is generated
- **WHEN** the prompt generator receives a Grade 2 skill selection
- **THEN** it can generate eligible two-digit add/subtract, place value, skip-counting, or equal-groups prompts within configured ranges

#### Scenario: Grade 3 prompt is generated
- **WHEN** the prompt generator receives a Grade 3 skill selection
- **THEN** it can generate eligible multiplication, division-as-missing-factor, arrays/simple-area, fractions, decimals, or mixed review prompts within configured ranges

#### Scenario: Unsupported operations are requested
- **WHEN** unavailable operations are present in saved or imported settings
- **THEN** they are ignored and prompts are generated only from enabled operations valid for the selected grade lanes without evaluating answer strings as code

### Requirement: Non-punitive retry behavior
The system SHALL let children recover from incorrect answers without adult intervention.

#### Scenario: Child answers incorrectly
- **WHEN** the child taps or enters an incorrect answer
- **THEN** the app gives a gentle hint or nudge, keeps the prompt available, and allows another attempt

#### Scenario: Child later answers correctly
- **WHEN** the child answers correctly after one or more incorrect attempts
- **THEN** the app records the completion and may mark it as helped for adult review without subtracting previously earned progress

### Requirement: Grade 2 arithmetic and concept prompts
The system SHALL provide Grade 2 practice that includes arithmetic fluency and conceptual number understanding.

#### Scenario: Two-digit addition/subtraction starts
- **WHEN** a Grade 2 Add or Subtract session starts
- **THEN** prompts use two-digit operands within adult-configured ranges and avoid regrouping unless regrouping is explicitly enabled

#### Scenario: Place value prompt starts
- **WHEN** a Grade 2 Place Value session starts
- **THEN** prompts ask the child to compose, decompose, or identify tens and ones using child-readable text or visuals

#### Scenario: Skip-counting prompt starts
- **WHEN** a Grade 2 Skip Count session starts
- **THEN** prompts ask for next, previous, or missing values in deterministic 2, 5, or 10 count sequences

#### Scenario: Equal-groups prompt starts
- **WHEN** a Grade 2 Groups session starts
- **THEN** prompts show or describe equal groups as multiplication readiness without requiring formal multiplication terminology

### Requirement: Grade 3 multiplication and division prompts
The system SHALL provide Grade 3 practice for multiplication, division, arrays, and simple area.

#### Scenario: Multiplication prompt starts
- **WHEN** a Grade 3 Times session starts
- **THEN** prompts use multiplication facts within adult-configured factor ranges up to 12

#### Scenario: Division prompt starts
- **WHEN** a Grade 3 Divide session starts
- **THEN** prompts frame division as sharing, grouping, or missing factor with whole-number answers

#### Scenario: Array prompt starts
- **WHEN** a Grade 3 Arrays session starts
- **THEN** prompts use rows and columns or simple area to connect multiplication facts to visuals

#### Scenario: Mixed review starts
- **WHEN** a Grade 3 Mix session starts
- **THEN** prompts combine enabled multiplication, division, array, fraction, decimal, and review skills without introducing disabled skills

#### Scenario: Fraction prompt starts
- **WHEN** a Grade 3 Fractions session starts
- **THEN** prompts introduce parts-of-a-whole concepts through adult-enabled fraction skills

#### Scenario: Decimal prompt starts
- **WHEN** a Grade 3 Decimals session starts
- **THEN** prompts introduce tenths concepts through adult-enabled decimal skills

### Requirement: Grade 4 includes fraction and decimal practice
The system SHALL present fractions and decimals as Grade 4 practice paths rather than Grade 3 adult-only extensions.

#### Scenario: Child opens Grade 4
- **WHEN** the child chooses Grade 4
- **THEN** fraction and decimal paths are available with child-facing labels and visual practice options

### Requirement: Fraction and decimal concepts use shared visual part models
The system SHALL teach fractions and decimals as related representations of parts of a whole, using visible models before expecting notation fluency.

#### Scenario: Decimal tenths prompt appears
- **WHEN** a child starts a decimal tenths prompt
- **THEN** the app shows a whole split into 10 equal parts and uses wording that connects the visual model to tenths notation

#### Scenario: Decimal hundredths prompt appears
- **WHEN** a child starts a hundredths decimal prompt
- **THEN** the app shows or clearly represents a whole split into 100 equal parts and connects the visual model to hundredths notation

#### Scenario: Fraction prompt appears
- **WHEN** a child starts a fraction prompt
- **THEN** the app shows equal parts of one whole and uses wording that connects colored parts, total parts, and fraction notation

### Requirement: Fraction and decimal prompt families are varied
The system SHALL provide multiple prompt families for fraction and decimal practice rather than repeating a single recognition question.

#### Scenario: Decimal path is active
- **WHEN** the decimal path generates a short session
- **THEN** prompts can include identifying, matching notation, comparing amounts, recognizing equivalent decimals, and add/subtract practice

#### Scenario: Fraction path is active
- **WHEN** the fraction path generates a short session
- **THEN** prompts can include identifying, matching notation, comparing same-denominator amounts, recognizing equivalent fractions, and same-denominator add/subtract practice

#### Scenario: Prompt generation repeats
- **WHEN** fraction or decimal prompts are generated within a short session
- **THEN** the app avoids repeating the same exact prompt while enough alternate prompts remain available

### Requirement: Fraction and decimal operations stay grade-appropriate
The system SHALL introduce operations through visual same-unit addition/subtraction before harder symbolic operation drills.

#### Scenario: Decimal addition/subtraction is enabled
- **WHEN** decimal operation prompts appear
- **THEN** they use tenths first, optionally hundredths later, and show visual combine/remove models with sums and differences in a child-safe range

#### Scenario: Fraction addition/subtraction is enabled
- **WHEN** fraction operation prompts appear
- **THEN** they use the same denominator and a visible model of one whole, avoiding unlike-denominator operations

#### Scenario: Decimal multiplication/division is requested
- **WHEN** decimal multiplication or division would be considered
- **THEN** it remains deferred unless a later approved change introduces a visual groups-of-decimals mode

### Requirement: Fraction and decimal feedback is concept-specific
The system SHALL give wrong-answer hints that explain the relevant visual concept.

#### Scenario: Tenths answer is wrong
- **WHEN** the child answers a tenths prompt incorrectly
- **THEN** feedback explains that tenths split one whole into 10 equal parts

#### Scenario: Hundredths answer is wrong
- **WHEN** the child answers a hundredths prompt incorrectly
- **THEN** feedback explains that hundredths split one whole into 100 equal parts

#### Scenario: Fraction answer is wrong
- **WHEN** the child answers a fraction prompt incorrectly
- **THEN** feedback references colored parts, total equal parts, or same denominator as appropriate
