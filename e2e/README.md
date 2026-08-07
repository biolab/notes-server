# E2E Browser Tests

This directory contains the small Playwright baseline for rendering a deterministic Notes book page in desktop Chromium and mobile WebKit with Playwright's built-in `iPhone 13` device profile.

Install dependencies and browsers:

```bash
yarn install --frozen-lockfile
npx playwright install chromium webkit
```

On Linux systems that need browser runtime packages, run:

```bash
sudo npx playwright install-deps chromium webkit
```

Run all E2E tests:

```bash
yarn test:e2e
```

Run only the mobile WebKit/iPhone-emulation project:

```bash
yarn test:e2e:mobile
```

Playwright starts the app with `e2e/notes.config.yml`, bootstraps the fixture database with `yarn e2e:bootstrap`, and writes disposable runtime state under `e2e/.runtime/`. The committed fixture content is under `e2e/fixtures/notes/`.

Configured projects:

- `desktop-chromium`: Playwright desktop Chromium using the built-in `Desktop Chrome` descriptor.
- `mobile-webkit-iphone`: Playwright WebKit using the built-in `iPhone 13` descriptor.

Artifacts are written under `test-results/e2e/`; the HTML report is written under `playwright-report/`. The mobile test attaches JSON layout measurements and a full-page screenshot for diagnostic evidence.

The mobile project is Playwright WebKit plus iPhone device emulation. It is useful for repeatable browser testing, but it is not certification from a physical iPhone running iOS Safari.
