# Open Source Release Checklist

Use this checklist before creating or updating the public release repo.

## Decisions

- [x] Source license: MIT.
- [x] Public shape: separate sanitized public repo.
- [x] Canonical source through v0.1.0: private repo.
- [x] Public reward media: one Pexels video sample.
- [x] Public instruction audio: no Gemini WAVs; browser speech fallback.
- [ ] Public repo name and location confirmed.

## Local Gates

- [ ] Unit tests pass.
- [ ] Production build passes.
- [ ] Playwright e2e passes.
- [ ] OpenSpec validation passes.
- [ ] Production dependency audit passes.
- [ ] Git whitespace check passes.
- [ ] Public-clean scan passes against the public export.
- [ ] Fresh public clone install/build passes.

## Public Export

- [ ] Export only public-safe source, tests, docs, OpenSpec baselines, and the approved sample asset.
- [ ] Exclude private overlay files, generated Gemini WAVs, protected deployment scripts, VPS paths, private domains, handoff notes, dist/, reports, and local state.
- [ ] Verify docs/asset-policy.md matches the exported assets.
- [ ] Tag v0.1.0 only after Steve approves this checklist.

## Private Family Verification

- [ ] Private overlay still provides the current family reward videos and posters.
- [ ] Private overlay still provides Gemini Aoede instruction WAVs.
- [ ] Protected family deployment smoke check passes after any public-source change is applied back.
