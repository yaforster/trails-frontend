# CONTINUITY.md

This is the compact continuity briefing for `trails-frontend`. Read this file before acting, then update it only for
meaningful new plans, decisions, progress, discoveries, or outcomes. Keep entries factual, short, provenance-tagged, and
bounded.

## [PLANS]

- 2026-07-29 [USER] Prevent duplicate test-plan action edges in the modeller. When a user attempts to create an edge
  that already exists, discard the attempt without changing the ongoing model; retain serialization-boundary validation
  and add focused graph-service coverage.
- 2026-07-11 [USER] Add mouse-box creation of Foblex Flow action groups, persist/restore group geometry with test
  plans, and allow visual groups to be deleted without changing action-chain execution.

- 2026-07-04 [USER] Plan a migration from PrimeNG to Taiga UI before implementation. Preserve application look and
  behavior where practical, avoid technical debt, prefer cleaner Taiga UI usage over convenience shims, and use the
  migration to refactor touched code when warranted.
- 2026-07-04 [CODE] Migration should remove PrimeNG, `@primeuix/themes`, Prime runtime providers, Prime templates, and
  Prime CSS/token coupling from `trails-frontend` rather than leaving a mixed Prime/Taiga UI layer.

## [DECISIONS]

- 2026-07-04 [USER] Taiga UI is the target component library. Minor visual differences are acceptable; robust
  architecture and low custom CSS take priority over pixel-perfect PrimeNG parity.
- 2026-07-04 [CODE] Follow `AGENTS.md`: standalone Angular components, explicit named types, signals, OnPush,
  `input()`/`output()` for touched components, native control flow, reactive forms, and no style information in HTML.

## [PROGRESS]

- 2026-08-12 [CODE] Shell background image now applies only to Login; flexible Taiga main-grid columns use full available width; Login fills remaining viewport height for centered card; modeller aside hint is explicit; and Data Management section selection uses Taiga's model output instead of mixed native `ngModel` state.
- 2026-08-12 [CODE] Data Management now selects Test plans, Elements, Test data, or Deployments from URL-backed
  `section` state. Missing/invalid values display Test plans without URL rewrite; picker navigation merges unrelated
  query parameters; all four sections stay mounted and inactive sections use `[hidden]`.
- 2026-08-12 [CODE] Replaced ShellComponent's custom sticky top navigation with Taiga `TuiNavigation`: compact dark
  header, user/theme controls, expandable productivity sidebar, and card-contained execution context. Route/auth gates,
  navigation feedback, notifications, and theme persistence remain unchanged; `tuiAsideItem` supplies active-route
  behavior, so duplicate `RouterLinkActive` bindings were removed.
- 2026-08-09 [CODE] Modeller and result UI support `RESIZE_VIEWPORT` utility actions. Mirrored/generated contract,
  palette, icon, no-element handling, editor, mapper, data-management allowlist, and result rendering are aligned.
  Width and height have no palette defaults; imported missing, non-finite, non-integral, non-positive, or above-int32
  values remain editable but unsaveable. No device emulation, profile, or matrix UI was added.
- 2026-08-08 [CODE] Modeller supports locator-free `COORDINATE_CLICK` utility actions. Palette defaults coordinates to zero; editor exposes X/Y viewport CSS-pixel fields; mapper serializes exact coordinate details; and persistence validation keeps imported missing, fractional, non-finite, negative, or above-int32 values editable but unsaveable. Coordinate actions never require an element.
- 2026-08-02 [CODE] The modeller now uses node parent IDs as the only runtime group-membership source, preserving
  canvas coordinates across grouping/reparenting/detaching and deriving persisted membership at serialization.
- 2026-08-02 [CODE] Groups remain flat and auto-fit their actions; manual resizing was removed. Actions can leave by
  drag-out or an explicit control, and duplicate/missing imported memberships normalize to a single valid parent.
- 2026-08-02 [CODE] Added modeller viewport controls for zoom, reset, fit, local light/dark mode, and whole-panel
  fullscreen without changing the application theme.
- 2026-08-02 [CODE] Consolidated modeller actions and viewport controls into one bottom-center toolbar; save feedback
  remains directly above it.
- 2026-08-02 [CODE] The TestPlanDefinitionDTO dialog now fills the modeller, supports copy/download/clipboard paste,
  and only replaces the graph after an explicit, structurally validated JSON import.
- 2026-07-26 [CODE] The modeller now validates serialized action graphs before test-plan creation: reference IDs must
  be unique, every successor must exist, the graph must be acyclic, and it must have exactly one starting action.
- 2026-07-26 [CODE] An unsavable modeller definition now leaves editing available while showing a persistent inline
  warning beside the toolbar and a visibly disabled save button.
- 2026-07-04 [TOOL] Created this frontend continuity file because `trails-frontend/AGENTS.md` requires a current
  workspace `CONTINUITY.md` and none existed in `trails-frontend`.
- 2026-07-04 [TOOL] Step 1 started: installed Taiga UI 5.13.0 with `ng add taiga-ui`, added `TuiRoot`/`provideTaiga`,
  kept Inter as the app font, added initial `--trails-*` semantic tokens, and synchronized the existing `app-dark`
  theme toggle with Taiga's `TUI_DARK_MODE` signal.
- 2026-07-04 [TOOL] Step 1 verification: targeted Prettier check for touched files passed, `npm test` passed, and
  `npm run build` passed.
- 2026-07-04 [TOOL] Step 2 complete: replaced PrimeNG toast/message plumbing with an app-owned signal notification
  service rendered by the shell with Taiga `tuiNotification`/`tuiButton`; test-plan execution notifications now use
  the app service and route action callbacks instead of Prime `MessageService`.
- 2026-07-04 [TOOL] Step 3 partial/simple-primitives slice complete: migrated the login page from Prime card,
  input/password, button, and spinner components to Taiga textfields/password toggle/button loading; migrated shell and
  current-user profile loading/icon-button primitives from Prime button/progress spinner to Taiga button/loader.
- 2026-07-04 [TOOL] Step 4 table slice complete: migrated the elements, test data profiles, and test plans resource
  table components from Prime card/toolbar/tabs/table/message/spinner/button usage to semantic tables with Taiga
  buttons, segmented tabs, messages, loaders, and pagination; touched components now use signal inputs/outputs and
  OnPush.
- 2026-07-04 [TOOL] Step 4 complete: migrated the remaining data-management section dialogs and deployment report off
  PrimeNG. Elements/test-plans/test-data dialogs now use Taiga template dialogs, Taiga buttons/loaders, and OnPush;
  deployment reporting uses the shared resource panel, Taiga messages/buttons/loaders, and native selects.
- 2026-07-04 [TOOL] Step 4.5 complete: standardized migrated icon-button sizing with `--trails-icon-*` tokens,
  normalized projected Material/SVG icon dimensions inside Taiga buttons, tightened data-management table action
  spacing, and restored semantic muted text color for resource panel helper text, table headers, and empty states.
- 2026-07-04 [TOOL] Step 5 complete: migrated workspace context controls/dialog, test results list/details, and the
  metrics page reload/loading surface from PrimeNG to Taiga/native controls. Test results list now owns sort and
  pagination state with signals; affected styles use `--trails-*` tokens instead of Prime variables.
- 2026-07-04 [TOOL] Step 6 complete: migrated the test-plan modeller create dialog, canvas toolbar, and palette sidebar
  from PrimeNG to Taiga/native controls. Touched modeller components now use `input()`/`output()` and OnPush; modeller
  styles no longer contain Prime component selectors or Prime token coupling.
- 2026-07-04 [TOOL] Step 7 complete: removed PrimeNG runtime provider/theme setup, uninstalled `primeng` and
  `@primeuix/themes`, and replaced remaining Prime CSS variable/class coupling in shell/profile/global styles with
  `--trails-*` tokens.
- 2026-07-04 [TOOL] Step 8 complete: performed final verification and migrated the remaining modeller action
  editor/node/canvas/definition-preview components to `input()`/`output()`, `inject()`, and OnPush so the migrated
  modeller feature follows the project component rules consistently.

## [DISCOVERIES]

- 2026-08-12 [TOOL] Taiga UI 5.13 provides `TuiNavigation` only through uninstalled `@taiga-ui/layout` (five existing Taiga packages stay version-locked at 5.13). It is an opinionated application shell: dark 3rem header, optional expanding sidebar, and a 12-column main grid, rather than a drop-in horizontal navigation bar. Replacing `ShellComponent` would intentionally replace its custom sticky panel, responsive icon row, page background, and workspace-context placement.
- 2026-07-11 [USER] Supersedes the earlier pointer-event diagnosis: group creation already worked; Docker Compose was
  serving a stale frontend image because the application had not been rebuilt.
- 2026-07-11 [CODE] Foblex grouping requires `fNodeParentId` plus group-relative node coordinates. Membership is
  persisted by action reference ID and `fDropToGroup` handles actions dragged into an existing group.
- 2026-07-11 [USER] Selection-event/pointer-event ordering is not reliable for creating groups at selection release.
  Group creation uses Foblex's `fDragEnded` lifecycle and reads finalized node IDs from `FFlowComponent.getSelection()`.
- 2026-07-11 [USER] Group interaction should match the Foblex grouping demo: include padding, auto-fit children, and
  expand when a child reaches a boundary. Because the demo does not dynamically unparent children, Trails additionally
  ungroups a member when its center is deliberately dragged beyond the group's pre-drag bounds.
- 2026-07-11 [USER] Groups use a solid card treatment with a separate header, centered inline-editable label, header
  drag handle, delete control, and corner resize affordances; labels persist with group geometry and membership.

- 2026-07-04 [CODE] `package.json` currently uses Angular 21, `primeng` 21.1.7, `@primeuix/themes` 2.0.3,
  `@angular/material` icons, `@lucide/angular`, `@foblex/flow`, and Chart.js.
- 2026-07-04 [CODE] PrimeNG usage is spread across 19 TypeScript files and includes app config/providers,
  notifications, toast, dialogs, tables, cards, toolbar, tabs, messages, selects, skeletons, buttons, inputs/password,
  and progress spinners.
- 2026-07-04 [CODE] Global and feature CSS are coupled to Prime CSS variables/classes such as `--p-*`, `.p-toast`,
  `.p-select`, `.p-card`, `.p-toolbar`, and `.p-datatable-sm`; theme migration is therefore a first-class task.
- 2026-07-04 [CODE] Taiga UI 5 uses `provideTaiga()`, `TuiRoot`, Taiga style imports, copied icon assets, and
  `TUI_DARK_MODE`; `provideTaiga()` applies `tuiTheme="dark"` to `body` from that signal.
- 2026-07-04 [TOOL] After installing Taiga while PrimeNG is still present, production build reports a warning that the
  initial bundle is 1.11 MB, 10.04 kB above the 1.10 MB warning budget. Build still succeeds; expect this to improve
  as PrimeNG is removed.
- 2026-07-04 [TOOL] Supersedes prior bundle-warning measurement for step 2: after removing Prime toast/message usage,
  production build still warns but is only 2.61 kB above the 1.10 MB initial bundle warning budget.
- 2026-07-04 [TOOL] Step 3 build passes but the temporary initial bundle warning rose to 21.54 kB above the 1.10 MB
  warning budget while PrimeNG remains for other feature pages and Taiga form controls are now used by login.
- 2026-07-04 [TOOL] Step 4 table-slice build passes after trimming the shared data-management CSS back under its
  component budget; the only remaining build warning is the known temporary initial bundle warning, now 24.67 kB above
  the 1.10 MB budget while PrimeNG and Taiga UI coexist.
- 2026-07-04 [TOOL] Step 4 full data-management build passes with only the known temporary initial bundle warning, now
  28.36 kB above the 1.10 MB budget while PrimeNG remains for other feature areas.
- 2026-07-04 [TOOL] Step 4.5 build passes after icon/alignment normalization; the only remaining build warning is the
  known temporary initial bundle warning, now 29.14 kB above the 1.10 MB budget while PrimeNG remains elsewhere.
- 2026-07-04 [TOOL] Step 5 build passes with no budget warnings. Removing Prime from the eager workspace context path
  brought the initial bundle down to 859.72 kB against the 1.10 MB warning budget.
- 2026-07-04 [TOOL] Step 6 build initially exposed the modeller component stylesheet budget after Prime removal; trimming
  redundant local shadows, button sizing, and duplicate icon rules brought `test-plan-modeller-page.component.css` back
  under the 8 kB component budget.
- 2026-07-04 [TOOL] Step 6 final build passes with no warnings. Initial bundle is 837.06 kB and the modeller lazy chunk
  is 448.98 kB after migrating Prime controls and removing modeller Prime token fallbacks.
- 2026-07-04 [TOOL] Step 7 final build passes with no warnings. Removing Prime packages and providers reduced the
  initial bundle to 698.26 kB; no `primeng`, `@primeuix`, `providePrimeNG`, `--p-*`, or Prime class selector references
  remain in `package.json`, `package-lock.json`, `angular.json`, or `src`.
- 2026-07-04 [TOOL] Step 8 final verification: `npm run build` passes with no warnings (initial bundle 698.26 kB),
  `npm test -- --watch=false` passes 10 tests across 3 files, migration residue scans find no Prime references outside
  `CONTINUITY.md`, and generated API/runtime files have no content diff.
- 2026-07-04 [TOOL] Full `npm run format:check` is not clean for the repository baseline and reports formatting issues
  in 48 files. Targeted Prettier check for the files modified in steps 7-8 passes.
- 2026-07-04 [TOOL] `npm audit --omit=dev` reports 7 production vulnerabilities from Angular 21.2.x packages
  (`@angular/common`, `@angular/compiler`, `@angular/core`, `@angular/forms`, `@angular/platform-browser`,
  `@angular/router`, `@angular/animations`); `npm audit fix` is available but was not applied in step 1.

## [OUTCOMES]

- 2026-09-19 [TOOL] Opening persisted test plans now retains `COORDINATE_CLICK` actions and predecessor edges in the modeller. Added focused mapper coverage for action-ID to reference-ID edge translation; targeted test, full 86-test suite, lint, touched-file Prettier, and production build/API generation pass. Rebuilt and recreated `trails-frontend` with `trails-edge/public-runtime.env.template`; local and public roots return HTTP 200, and its API and Keycloak runtime URLs target `https://trailstestplatform.org`. No commit or push.
- 2026-09-05 [TOOL] Data Management section hosts now explicitly fill their routed shell width, and the shared page grid
  has one shrink-safe column. The shell sizes every activated routed host after `router-outlet`, preventing future shell
  flex changes from reintroducing intrinsic-width pages. Selection coverage cycles all four URL-backed sections (Test
  plans, Elements, Test data, Deployments). Full suite passes (85 tests); lint, targeted Prettier, production build/API
  generation, and `git diff --check` pass. The data-management CSS budget warning is eliminated. Browser visual QA is
  unavailable.
- 2026-09-05 [TOOL] Follow-up layout repair: Taiga Navigation Main's inherited `align-items: start` made direct shell
  children shrink to intrinsic width after its grid was converted to a column flex layout. Shell now explicitly stretches
  children and gives workspace/outlet panels full inline size, restoring result and modeller width beside either navigation
  state while preserving remaining-height allocation to the modeller. Full suite passes (85 tests); app TypeScript,
  targeted Prettier, production build/API generation, and `git diff --check` pass. Browser visual QA unavailable.
- 2026-09-05 [TOOL] Result details now retain a Taiga skeleton until the existing aggregate loader returns every test-set,
  path, action, artifact, and screenshot; partial detail content never renders. The JSON dialog retains editable/copy/
  paste/download behavior and adds Taiga's default single JSON-file picker: readable selection replaces only the draft,
  while explicit Import JSON remains graph mutation boundary; rejected/read-failed files show errors. Shell router content
  now fills space beside expanded or collapsed navigation; result and modeller retain inner scrolling/full-height canvas
  ownership. Focused tests and full suite pass (85 tests across 14 files); lint, app/spec TypeScript checks, targeted
  Prettier, API generation/build, and `git diff --check` pass. Full Prettier remains blocked by 12 unrelated dirty files.
  No browser visual QA, commit, or push.
- 2026-08-31 [TOOL] Terminal execution-result toasts now use a compact opaque Taiga notification surface: solid
  severity composition stays green for completed and red for failed outcomes; existing summary/detail, 10-second life,
  exact conditional result route, polite live region, native `View`/`Dismiss`, and callback-before-dismiss behavior are
  retained. `npm.cmd test -- --watch=false` passed 81 tests across 13 files (targeted app 5/5); lint, app/spec TypeScript
  checks, build, and `git diff --check` passed. PowerShell blocked `npm.ps1`, so `.cmd` equivalents were used. Full
  Prettier failed 11/12 files, including task-owned `app.spec.ts`; code review returned `REFINE` only for that MAJOR
  formatting finding and user explicitly waived it with `Move on`. Browser light/dark/narrow and live View QA were
  unavailable. No commit or push. The untracked service spec is intended; unrelated dirty baseline was preserved by
  scoped/full diff and status inspection but cannot be independently proven byte-for-byte.
- 2026-08-12 [TOOL] Visual-consistency outcome: Metrics remains contextual-only; route activation now rejects missing, repeated, blank, noninteger, or negative application/stage/test-plan selection before Metrics loads. Theme-settled chart palettes refresh Chart.js colors across light/dark Taiga body scope; shell/profile/header token cleanup and preview-dialog modal focus handling were completed. ESLint now runs through `npm run lint`. Mandatory verification passed: lint, exact app/spec type checks, 76 tests across 12 files, Prettier, direct Angular build, API generation, npm build, generated-content checks, and `git diff --check`; generation/build emitted Node `DEP0190` warning but generated tracked output stayed unchanged. Adversarial review returned `ACCEPT` after two repairs. Browser and assistive-technology visual QA were not run. No generated source was hand-edited, commit, or push.
- 2026-08-12 [TOOL] Data Management navigation verification: focused page test passes 4 tests; full suite passes 53
  tests across 9 files; Prettier, direct `npx ng build`, `npm.cmd run build`, and `git diff --check` pass. API/runtime
  generation produces no tracked content diff. No commit or push.
- 2026-08-12 [TOOL] Taiga navigation verification: `npm.cmd test -- --watch=false` passes 49 tests across 8 files,
  including direct shell expand/collapse coverage; targeted Prettier and `npm.cmd run build` pass. Build regenerates
  HATEOAS/runtime files without content changes. No commit or push.
- 2026-08-09 [TOOL] Resize-viewport frontend verification passed: `npm run generate:api`, `npm test -- --watch=false`
  (48 tests), `npm run build`, `npm run format:check`, and `git diff --check`. Initial format check failed and was
  corrected through Prettier before passing. Independent adversarial review reran 48 frontend tests and diff checks,
  then returned `ACCEPT` with zero findings; no adversarial-review waiver. No commit or push.
- 2026-08-09 [TOOL] Direct dependency vulnerability remediation: Angular 21 patch releases, Less 4.8.1, and `@hey-api/openapi-ts` 0.97.3 are locked with scoped safe transitive overrides. `npm.cmd audit --json` and `npm.cmd audit --omit=dev --json` report no direct findings. API generation, 36 tests across 7 files, Prettier, and production build pass; generated HATEOAS client output was refreshed. No commit or push.
- 2026-08-09 [TOOL] Repository-wide Prettier remediation verified: `npm.cmd run format:check` passes; `npm.cmd test -- --watch=false` passes 36 tests across 7 files; `npm run build` passes after API generation/runtime-config output; and `git diff --check` passes. The earlier 67-file formatting failure is resolved. No commit or push.
- 2026-08-08 [TOOL] Coordinate-click frontend verification passed: `npm run generate:api`, `npm test -- --watch=false` (36 tests), `npm run build`, changed-file Prettier, and `git diff --check`. Full `npm run format:check` fails for 67 pre-existing untouched files; changed files format clean. Adversarial review: `ACCEPT`, no findings. No commit or push.
- 2026-08-02 [TOOL] Added focused graph-group tests for coordinate conversion, reparenting, deletion, and import
  normalization. `npm test -- --watch=false` passes 19 tests across 5 files, targeted Prettier passes, and
  `npm run build` passes without warnings.
- 2026-07-26 [TOOL] Frontend graph-validation tests pass (5 tests); the full frontend test suite passes (15 tests),
  and the production Angular compile passes.
- 2026-07-11 [TOOL] Shift-drag box selection now creates a real Foblex parent group whose actions move with it;
  drag-to-group joins existing actions, deletion preserves members' canvas positions, and membership/geometry
  round-trip through test-plan definitions. Frontend tests pass (10 tests) and production build passes without warnings.

- 2026-07-04 [TOOL] Step 1 complete: Taiga UI foundation is installed/configured, root dark-mode integration works with
  the existing theme toggle, `less` is installed for Taiga styles, and tests/build pass.
- 2026-07-04 [TOOL] Step 2 outcome: no remaining `MessageService`, `ToastModule`, `p-toast`, `.p-toast`,
  `ToastMessageOptions`, or `TestResultToastData` references under `src/app`/`src/styles.css`; `npm test` passes
  10 tests across 3 files, `npm run build` passes with the temporary budget warning, and touched files pass Prettier.
- 2026-07-04 [TOOL] Step 3 outcome: no remaining Prime component/directive references in `src/app/features/login` or
  `src/app/layout` except the global `providePrimeNG` in app config needed by unmigrated pages; `npm test` passes
  10 tests across 3 files, `npm run build` passes with the temporary budget warning, and touched files pass Prettier.
- 2026-07-04 [TOOL] Step 4 table-slice outcome: no remaining Prime references in `*table.component.*` under
  `src/app/features/data-management`; `npm test` passes 10 tests across 3 files, `npm run build` passes with only the
  temporary initial bundle warning, touched files pass Prettier, and generated API/runtime files have no content diff.
- 2026-07-04 [TOOL] Step 4 outcome: no remaining `primeng`, `--p-*`, `p-*`, `pButton`, or `p-datatable` references
  under `src/app/features/data-management`; `npm test` passes 10 tests across 3 files, `npm run build` passes with only
  the temporary initial bundle warning, and generated API/runtime files have no content diff.
- 2026-07-04 [TOOL] Step 4.5 outcome: `npm test` passes 10 tests across 3 files, `npm run build` passes with only the
  temporary initial bundle warning, touched stylesheets pass Prettier, and generated API/runtime files have no content
  diff.
- 2026-07-04 [TOOL] Step 5 outcome: no remaining Prime references under `src/app/context`,
  `src/app/features/test-results`, or `src/app/features/metrics`; `npm test` passes 10 tests across 3 files,
  `npm run build` passes with no warnings, touched files pass Prettier, and generated API/runtime files have no content
  diff.
- 2026-07-04 [TOOL] Step 6 outcome: no remaining Prime references under
  `src/app/features/test-plan-modeller`; modeller-specific global styles have no `--p-*` or `p-progress-spinner`
  references; `npm test` passes 10 tests across 3 files, `npm run build` passes with no warnings, and generated
  API/runtime files have no content diff.
- 2026-07-04 [TOOL] Step 7 outcome: PrimeNG is removed from dependencies and app bootstrap. `npm test` passes 10 tests
  across 3 files, `npm run build` passes with no warnings, touched files pass Prettier, and generated API/runtime files
  have no content diff.
- 2026-07-04 [TOOL] Migration outcome: PrimeNG and `@primeuix/themes` have been removed from trails-frontend; migrated
  views use Taiga UI/native controls plus app-owned `--trails-*` tokens. Remaining work is manual browser visual QA and
  addressing the existing repo-wide Prettier baseline if desired.
