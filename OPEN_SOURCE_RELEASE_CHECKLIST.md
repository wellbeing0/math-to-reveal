# Open Source Release Checklist

Use this checklist before creating or updating the public release repo.

## Decisions

- [x] Source license: MIT.
- [x] Public shape: separate sanitized public repo.
- [x] Canonical source through v0.1.0: private repo.
- [x] Public reward media: one Pexels video sample.
- [x] Public instruction audio: browser speech fallback.
- [x] Public repo name and location confirmed: `wellbeing0/math-to-reveal`.

## Local Gates

- [x] Unit tests pass.
- [x] Production build passes.
- [x] Playwright e2e passes.
- [x] OpenSpec validation passes.
- [x] Production dependency audit passes.
- [x] Git whitespace check passes.
- [x] Public-clean scan passes against the public export.
- [ ] Fresh public clone install/build passes from Steve's machine.

## Public Export

- [x] Export only public-safe source, tests, docs, OpenSpec baselines, and the approved sample asset.
- [x] Exclude private assets, deployment operations, dist/, reports, and local state.
- [x] Verify docs/asset-policy.md matches the exported assets.
- [ ] Tag v0.1.0 only after Steve approves this checklist.

## Private Family Verification

- [x] Private canonical repo still provides family-specific media needed for family deployment.
- [ ] Protected family deployment smoke check passes after the final public-source release tag.
