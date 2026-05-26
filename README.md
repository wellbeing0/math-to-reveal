# Math to Reveal

Math to Reveal is a browser-first elementary math practice game. Children solve short math sessions and reveal pieces of a reward video as they answer correctly.

## Features

- Kindergarten through Grade 4 math lanes.
- Count, Add, Subtract, Place Value, Skip Count, Groups, Times, Divide, Arrays, Fractions, Decimals, and Mix paths.
- Adult-controlled grade lanes and operations.
- Touch-friendly choices and numeric keypad input.
- Visual fraction and decimal models.
- Local-only progress in browser storage.
- Static build with no backend, accounts, telemetry, or runtime API keys.

## Assets

The public repo includes one Pexels sample reward video with attribution in the app and in public/media/pexels-kittens/.

Instruction audio uses browser speech fallback in the public build. Generated voice files are not part of the public release.

See docs/asset-policy.md before adding or replacing assets.

## Development

Use Node 20.19 or newer. The project is tested with Node 24.

    npm ci
    npm test
    npm run build
    npm run test:e2e

Run a local dev server:

    npm run dev

## Static Hosting

Build output is written to dist/ and can be hosted by any static file server:

    npm run build

No server-side runtime is required.

## Dependencies

Runtime dependencies are intentionally avoided. Build, test, and validation tools live in devDependencies and are pinned by package-lock.json. Use npm ci for reproducible installs, and use npm install only when intentionally updating dependencies.

## Release Process

Public releases are exported from a private canonical development repo. See OPEN_SOURCE_RELEASE_CHECKLIST.md for the gates used before tagging a release.

## Contributors

- wellbeing0 - project owner and maintainer
- OpenClaw Codex - code, docs, testing, and release support

## License

Source code is licensed under the MIT License. Media assets have their own documented license/provenance.
