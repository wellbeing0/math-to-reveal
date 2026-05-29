# Contributing

Math Rewards is developed first in a private canonical repo, then exported to a sanitized public repo for releases.

## Local Setup

Run:

- npm ci
- npm test
- npm run build

Run Playwright checks before larger UI changes:

- npm run test:e2e

Use Node 20.19 or newer. The project is tested with Node 24. Keep dependency changes intentional: commit package-lock.json updates, keep runtime dependencies out unless they materially improve the app, and prefer devDependencies for build/test tooling.

## Contribution Rules

- Keep gameplay usable without private media, generated audio, server paths, or protected deployment files.
- Do not add secrets, API keys, family-specific URLs, private hostnames, or local VPS paths.
- Document new assets in docs/asset-policy.md.
- Add or update tests for prompt generation, save migration, settings, and user-facing flows.
- Accepted public changes are applied back into the private canonical repo before family deployment.

## Pull Request Checklist

- Unit tests pass.
- Production build passes.
- Relevant Playwright checks pass.
- OpenSpec validation passes when specs change.
- Public-clean scan has no findings in the public export.
