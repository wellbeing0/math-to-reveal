# Branch Protection and CI

This repo is public and uses `main` as the default branch. As of this note, `main` is not protected. The recommended setup is a lightweight GitHub ruleset backed by CI, so changes to `main` go through pull requests and the app is checked before merge.

## Recommended Order

1. Add a GitHub Actions CI workflow.
2. Push the workflow and confirm it passes on `main`.
3. Create a repository ruleset for `main`.
4. Make the CI workflow a required status check.
5. Let Dependabot updates merge through PRs after CI passes.

Branch protection without CI prevents accidental direct pushes, but it does not prove the app still builds or works. Add CI first.

## CI Workflow

GitHub Actions documentation:

- [GitHub Actions quickstart](https://docs.github.com/en/actions/writing-workflows/quickstart)
- [Node.js workflow guide](https://docs.github.com/en/actions/use-cases-and-examples/building-and-testing/building-and-testing-nodejs)
- [Playwright CI guide](https://playwright.dev/docs/ci-intro)

Create `.github/workflows/ci.yml` with this starter workflow:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  check:
    name: Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Public clean scan
        run: npm run check:public-clean

      - name: Unit tests
        run: npm test

      - name: Build
        run: npm run build

      - name: OpenSpec validation
        run: npm run spec:validate

      - name: End-to-end tests
        run: npm run test:e2e
```

After adding the file:

```bash
git checkout -b add-ci
git add .github/workflows/ci.yml docs/branch-protection-and-ci.md
git commit -m "Add CI and branch protection notes"
git push -u origin add-ci
```

Open a pull request from `add-ci` to `main`. GitHub should run the workflow automatically on the PR. Merge it after the workflow passes.

## Protect `main`

GitHub ruleset documentation:

- [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [Create rulesets for a repository](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)

Recommended UI path:

1. Open `https://github.com/wellbeing0/math-to-reveal/settings/rules`.
2. Choose **New ruleset**.
3. Choose **New branch ruleset**.
4. Name it `Protect main`.
5. Set enforcement status to **Active**.
6. Target branches: include `main`.
7. Enable these rules:
   - Require a pull request before merging.
   - Require status checks to pass.
   - Require branches to be up to date before merging, if CI runtime stays reasonable.
   - Require conversation resolution before merging.
   - Block force pushes.
   - Block deletions.
8. Select the CI status check from the workflow, likely `Check`.
9. Save the ruleset.

For now, do not enable **Do not allow bypassing the above settings**. Steve is the sole maintainer, and keeping owner bypass available is useful if CI breaks or a release fix needs manual recovery. Revisit this if other maintainers get write access.

## Settings to Skip for Now

- Signed commits: useful in higher-compliance repos, but unnecessary friction here.
- Linear history: fine as a preference, not important enough to require yet.
- Deployment approvals: unnecessary until the public repo owns a production deployment pipeline.
- Required review count greater than one: not useful while this is single-maintainer.

## Dependabot

Dependabot is active for this repo. Keep dependency updates on branches and merge them through PRs after CI passes. Do not let dependency updates land directly on `main`.

## Suggested Steady State

The final target is:

- `main` accepts changes only through PRs.
- CI runs on every PR and every push to `main`.
- CI must pass before merge.
- Force pushes and branch deletion are blocked.
- Owner bypass remains available until the project has more maintainers or stricter release needs.
