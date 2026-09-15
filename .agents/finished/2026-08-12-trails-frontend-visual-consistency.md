# Trails frontend visual consistency

## Status

Completed 2026-08-12. Plan-review `REJECT` was explicitly waived by user before approval; waiver is **not** reviewer `ACCEPT`. Adversarial review later returned `ACCEPT` after two repairs. Actual outcome is recorded below; plan sections retain pre-implementation requirements.

## Original request and scope

Improve Trails frontend visual consistency using existing Clarity-directed operational-interface guidance, current Taiga UI primitives, and existing `--trails-*` semantic styling tokens. Keep Metrics contextual: do **not** add static Metrics item to primary navigation. Preserve contextual Metrics caller from Test Plans.

User also directed cleanup: remove review-attempt artifacts only when they are present and did not materially improve initial feature request. Do not delete useful implementation, tests, or documentation. Do not invent current code changes.

### Product decisions and acceptance criteria

1. Primary navigation remains exact authenticated-navigation structure already owned by `ShellComponent`; it must not gain static Metrics navigation.
2. Exact existing primary-nav bindings, classes, and labels remain intentional unless approved plan step changes them:
   - Data management: `tuiAsideItem`, `routerLink="/data-management"`, `[class.disabled]="!authenticated()"`, `[attr.aria-disabled]="!authenticated()"`, `Data management`.
   - Test plan modeller: `tuiAsideItem`, `routerLink="/test-plan-modeller"`, same disabled and `aria-disabled` bindings, `Test plan modeller`.
   - Test results: `tuiAsideItem`, `routerLink="/test-results"`, same disabled and `aria-disabled` bindings, `Test results`.
   - Unauthenticated Login remains `tuiAsideItem`, `routerLink="/login"`, `Login`.
   - Existing click feedback remains on each existing link. Do not add duplicate `RouterLinkActive`; `tuiAsideItem` owns active-route presentation.
3. Metrics navigation remains initiated only by `TestPlansSectionComponent.openTestPlanMetrics`, with `applicationId`, `stageId`, and `testPlanId` query parameters and existing history-link eligibility check.
4. Direct `/metrics` access must not bypass required context. Route-level enforcement must require valid nonempty `applicationId`, `stageId`, and `testPlanId` query parameters before lazy Metrics page activation; absent, blank, or repeated/ambiguous values redirect to `/data-management` without attempting Metrics requests. Preserve valid contextual caller and its query values. This approved correction settles prior "route guard or clarify user" finding: implement route-level guard.
5. Keep feature boundary one-way: `core` must not import Metrics feature code or Metrics-only types. Route/query validation belongs in route/feature boundary using primitive query-parameter validation, not a core-to-feature dependency. Do not move Metrics domain code into `core` to satisfy guard.
6. Audit visual tokens across touched global, shell, and Metrics styles. Reuse existing semantic `--trails-*` tokens and Taiga tokens/primitives; replace duplicated raw visual values only where doing so improves requested consistency. Retain intentional non-token values required for geometry, transparent effects, chart data colors, or third-party integration, and document each retained category in implementation report. No new design-token system, UI library, or broad restyle.
7. Existing auth guard, lazy feature routing, workspace context panel, navigation feedback, notification behavior, theme persistence, and Metric loading/error behavior remain unchanged except required direct-route rejection before page activation.
8. Preserve accessibility: semantic anchors, keyboard navigation, labels, `aria-disabled` state, toggle pressed state, focus behavior, and adequate theme contrast.

## Repository facts and ownership

- Root instructions: `AGENTS.md`; frontend uses Angular standalone components, signals, OnPush, explicit named TypeScript types, Taiga UI, CSS-only styles, native control flow, and no hand edits to generated sources.
- Continuity routing: root `CONTINUITY.md` must be read before action and updated only for meaningful factual plan/outcome records. Root `REPOMAP.md` assigns shell to `src/app/layout`, routes to `src/app/app.routes.ts`, core to `src/app/core`, metrics to `src/app/features/metrics`, styles/tokens to `src/styles.css`, and generated clients to `src/app/generated/**`.
- Current shell: `src/app/layout/shell.component.{ts,html,css}` owns authenticated navigation, theme, profile controls, and navigation feedback. It currently imports `CapabilitiesService` from core and Taiga `TuiNavigation`.
- Current routes: `src/app/app.routes.ts` lazy-loads `/metrics` behind `authGuard` only. It has no route-level Metrics query enforcement.
- Current contextual caller: `src/app/features/data-management/test-plans-section.component.ts` checks application, stage, plan, and `history` link, then navigates to `/metrics` with three query parameters.
- Current Metrics page reads selection from query parameters. It is feature-owned and must remain lazy-loaded.
- Current generated `CapabilityName` does not contain a Metrics capability. Do not alter API contracts or generated clients for this UI-only change.
- `package.json` defines no `lint` script. Existing formatting/lint-equivalent script is exactly `npm run format:check`; do not claim `npm run lint` exists.
- Generated sources: `src/app/generated/{hateoas,asyncapi}` come from `scripts/generate-api.mjs`; never hand-edit. `npm run build` runs API generation and runtime config generation first.

## Approved plan

### 1. Documentation inspection gate and working-tree protection

Before edits, reread root `AGENTS.md`, `CONTINUITY.md`, `REPOMAP.md`, this artifact, relevant shell/routes/metrics/caller/tests/styles, and package scripts. Inspect current worktree/diff; preserve unrelated work. Do not modify README, REPOMAP, CONTINUITY, generated output, contracts, config, build files, or application code during this documentation phase.

During implementation, inspect source before selecting files. Identify all Metrics entry points and current design-token use before styling. Do not rely on a partial grep as proof of complete token coverage.

### 2. Route-level Metrics selection enforcement

At routing/feature boundary, add minimal typed guard for `/metrics` query selection. It must:

- run after existing auth protection and before lazy component activation;
- accept exactly one nonempty string each for `applicationId`, `stageId`, and `testPlanId`;
- reject missing, whitespace-only, array/repeated, or otherwise ambiguous required values;
- redirect invalid direct navigation to `/data-management`, with no Metrics HTTP work initiated;
- allow valid contextual navigation unchanged, including three query values;
- remain independent of `MetricsPageComponent` and core Metrics imports/types.

Use Angular route/guard APIs and existing feature organization. Keep lazy loading. Do not use broad global state, an interface with one implementation, a new capability, contract changes, or a duplicate page-level workaround. Page-level parsing may retain defensive handling but cannot be sole enforcement.

### 3. Navigation and visual consistency changes

Change only styles/template/component imports necessary for approved visual consistency. Use existing Taiga controls and existing semantic global tokens before creating any custom token. Keep exact nav semantics/bindings/labels above, contextual-only Metrics access, and current expand/collapse behavior.

For every style edit, preserve light/dark readability and focus visibility. Avoid static color duplication. Do not put style data in templates. Do not introduce new components, dependencies, configuration, or global CSS reshaping unless direct evidence shows smallest coherent fix requires it.

### 4. Robust token audit

Audit all touched `*.css` plus relevant `src/styles.css`, `shell.component.css`, and `features/metrics/**/*.css`; inspect both declarations and usages. Search raw colors/functions and token references, then classify results rather than blindly replacing chart/third-party/geometry values. Replace only inconsistent application-surface color/border/text/shadow values with existing semantic tokens or Taiga tokens. Confirm no new ad-hoc raw design colors are introduced in touched UI surfaces.

Required audit commands (PowerShell):

```powershell
rg --glob '*.css' --glob '!src/app/generated/**' '(?i)(#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|color-mix\()' src/styles.css src/app/layout src/app/features/metrics
rg --glob '*.css' --glob '!src/app/generated/**' -- '--trails-|--tui-' src/styles.css src/app/layout src/app/features/metrics
git diff -- src/styles.css src/app/layout src/app/features/metrics
```

### 5. Focused tests

Add or extend smallest meaningful unit tests for route guard behavior and shell/navigation invariants touched by change. Tests must prove:

- valid three-parameter contextual Metrics navigation activates route;
- each missing/blank/repeated required query parameter redirects to Data management before Metrics component/request path;
- no static Metrics primary-nav item exists;
- required existing nav labels/routes/disabled accessibility bindings remain intact where shell template is changed.

Use Angular/Vitest existing test conventions. Do not add tests for untouched visual internals or generated code. Update existing `app.spec.ts`/new focused guard spec only when this gives direct behavior coverage.

### 6. Cleanup and final documentation gate

Inspect review-attempt leftovers before deletion. Delete only files, comments, code, tests, or documentation that are both present and non-material to initial visual-consistency request. Retain useful design improvements, requested behavior, and documentation. Report every deletion or state that none qualified.

After implementation and final verification, inspect actual diff and generated-output state. Update `CONTINUITY.md` with concise factual `[PLAN]`/`[OUTCOME]` result only when work is complete. Update `REPOMAP.md` only if route/ownership map changes materially; update `README.md` only if user/developer workflow changes. Do not document planned work as completed. This artifact moves unchanged in identity to `.agents/finished` only after adversarial `ACCEPT` or explicit user adversarial-review waiver.

## Reviewer findings waived during plan review; mandatory implementation corrections

User explicitly waived plan-review `REJECT`, then approved this plan. Waiver allows workflow to proceed; it does **not** waive these corrections. Implementer must address every finding below before handoff for adversarial review.

| Finding                            | Requirement and correction direction                                                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ambiguous navigation contract      | Preserve exact existing nav route bindings, disabled classes/ARIA bindings, click feedback, and labels listed in acceptance criteria. No static Metrics nav.                     |
| Direct Metrics route bypass        | `/metrics` must enforce required query selection at route level. Approved resolution: guard redirects invalid selection to `/data-management`; preserve valid contextual caller. |
| Core-to-feature coupling           | Keep Metrics-specific route validation/types outside core. Core must not import Metrics feature code.                                                                            |
| Incorrect/unspecified lint command | `package.json` has no lint script. Use exact `npm.cmd run format:check` verification; do not report `npm run lint`.                                                              |
| Verification incomplete            | Run every mandated command below and report each actual outcome, including generated-file check and diff whitespace check.                                                       |
| Token audit too weak               | Audit declarations and usages over global/shell/Metrics CSS, classify intentional raw values, and prevent new ad-hoc visual tokens.                                              |
| Documentation inspection omitted   | Complete documentation inspection gate before edits and final documentation routing gate after actual implementation.                                                            |

## Impact assessment

- API/contracts: None. Do not change `api/*.yaml` or generated API clients.
- Persistence/migration: None.
- Security: No auth-model change. Route guard improves direct-route input validity; auth guard remains authoritative.
- Configuration/deployment: None. Runtime-config generation may execute as build side effect; do not hand-edit output.
- Dependencies: None.
- Accessibility: Preserve and test navigation semantics and accessible labels/bindings.
- Documentation: Final state requires factual `CONTINUITY.md` update; conditional REPOMAP/README updates per documentation gate.
- Out of scope: static Metrics navigation, backend capability additions, contract changes, component-library changes, broad UI rewrite, chart redesign, new token framework, unrelated cleanup, commit, or push.

## Exact required verification

Run from repository root after implementation. Use Windows commands shown; record pass/fail, output summary, and reason for every unavailable command. Do not call planned commands passed.

```powershell
npm.cmd run format:check
npm.cmd test -- --watch=false
npm.cmd run generate:api
git diff --exit-code -- src/app/generated
npm.cmd run build
git diff --check
```

Then perform required audit commands from Step 4 and inspect full final diff/status. `npm.cmd run build` intentionally reruns generation/runtime config; generated tracked content must remain unchanged unless source contract/generator changed (not allowed in this scope). There is no repository `lint` script; `npm.cmd run format:check` is required lint/format verification.

## Risks and adversarial-review focus

- Guard ordering/lazy routing could accidentally load Metrics or send HTTP request before invalid-query redirect.
- Repeated query values can be coerced accidentally; reject them explicitly.
- Styling cleanup can damage dark-mode contrast, focus rings, Taiga state styling, or chart colors.
- A new core import of Metrics code would invert established ownership.
- Shell template edits can silently lose labels, disabled ARIA bindings, or click feedback.
- Build can regenerate files; distinguish generated side effects from intentional changes.

Adversarial reviewer must independently test direct URL and valid contextual navigation, inspect route guard execution/order, test repeated/blank query values, confirm no static Metrics nav, check dependency direction, audit touched raw style values/tokens and themes, inspect cleanup eligibility, rerun required verification where feasible, and return `ACCEPT` or `REJECT` with findings.

## Approval record

- Date: 2026-08-12.
- Plan review: `REJECT` was explicitly waived by user. This is a plan-review waiver, not acceptance.
- Plan approval: user explicitly approved reviewed plan after waiver.
- Approval scope: all plan-review findings above remain mandatory corrections during implementation.
- Adversarial review: `ACCEPT` after two repairs. No adversarial-review waiver exists.
- Documentation phase result: approved-plan artifact was created before implementation. Final documentation inspection updated README, REPOMAP, frontend CONTINUITY, this artifact, and parent deferred-feedback record; final outcome below records actual implementation separately.

## Final outcome

### Actual implementation

Completed 2026-08-12. Metrics stays contextual-only: no static Metrics primary-navigation item exists.
`metricsSelectionGuard` runs with existing auth guard before lazy Metrics activation and redirects invalid selection
to `/data-management`. Shared selection parsing accepts exactly one trimmed, nonnegative safe integer for each of
`applicationId`, `stageId`, and `testPlanId`; it rejects missing, blank, repeated, noninteger, fractional, and negative
values before Metrics requests begin.

Visual work uses existing semantic/Taiga styling boundaries: shell/header/profile surfaces and Metrics panels use
semantic tokens; chart colors resolve from CSS custom properties after Taiga body-theme settlement and both chart
panels recreate their charts when palette changes. Preview dialog now behaves as modal: focus enters dialog, Tab is
trapped, background siblings are inert, Escape/backdrop close it, and opener focus returns. Existing navigation,
authentication, lazy loading, contextual Metrics caller, theme persistence, and generated contract behavior remain
unchanged.

### Actual changed implementation files

- `package.json`, `package-lock.json`, `angular.json`, `eslint.config.js`
- `src/app/app.routes.ts`, `src/app/app.spec.ts`, `src/app/core/theme.service.ts`, `src/styles.css`
- `src/app/layout/shell.component.ts`, `src/app/layout/shell.component.html`, `src/app/layout/shell.component.css`
- `src/app/layout/current-user-profile-button.component.html`,
  `src/app/layout/current-user-profile-button.component.css`
- `src/app/features/metrics/metrics-selection.ts`,
  `src/app/features/metrics/metrics-selection.guard.ts`,
  `src/app/features/metrics/metrics-selection.guard.spec.ts`,
  `src/app/features/metrics/metrics-page.component.ts`,
  `src/app/features/metrics/metrics-page.component.css`,
  `src/app/features/metrics/chart-theme-palette.service.ts`,
  `src/app/features/metrics/chart-theme-palette.service.spec.ts`,
  `src/app/features/metrics/metrics-result-mix-panel.component.ts`,
  `src/app/features/metrics/metrics-result-mix-panel.component.spec.ts`, and
  `src/app/features/metrics/metrics-timeline-panel.component.ts`
- `src/app/features/test-plan-modeller/test-plan-definition-preview-dialog.component.ts`,
  `src/app/features/test-plan-modeller/test-plan-definition-preview-dialog.component.html`, and
  `src/app/features/test-plan-modeller/test-plan-definition-preview-dialog.component.spec.ts`

No generated source was edited by hand. API generation and builds produced no generated tracked-content diff.

### Verification results

Mandatory ordered verification completed successfully: initial/final `git status --short`; generated-name/content
diff checks before and after generation; `npm.cmd run lint`; `npx.cmd tsc --noEmit -p tsconfig.app.json`;
`npx.cmd tsc --noEmit -p tsconfig.spec.json`; `npm.cmd test -- --watch=false`; `npm.cmd run format:check`;
`npx.cmd ng build`; `npm.cmd run generate:api`; `npm.cmd run build`; and `git diff --check`.

Tests passed: 76 tests across 12 files. API/build generation emitted Node `DEP0190` warning. It did not fail
verification. Implementation report records final worktree-status inspection; no clean-worktree claim is made because
unrelated changes may exist.

### Review, approval, and waivers

- Original plan review returned `REJECT`; user explicitly waived it, then explicitly approved implementation. This
  waiver was not `ACCEPT`.
- Recovery-plan review later returned `REJECT`; user explicitly waived it. This waiver was not `ACCEPT`.
- Deferred findings required actual-plan use, exact ESLint dependency contract, ordered verification, and shared strict
  Metrics validation. All were addressed; parent deferred-feedback record was retained and marked resolved.
- Adversarial review ran after two repairs and returned `ACCEPT`. Detailed rejected adversarial finding text was not
  supplied in final handoff, so none is invented here. No adversarial-review waiver was used.

### Documentation and residual risk

Updated `README.md` for lint/type/build/generation workflow, `REPOMAP.md` for theme and contextual Metrics/palette
ownership, and frontend `CONTINUITY.md` with factual outcome. Workspace `CONTINUITY.md` was not changed: no material
cross-repository coordination state changed. No review-attempt artifact qualified for deletion; deferred feedback was
preserved with factual resolution.

Browser visual QA and assistive-technology QA were not performed. Manual light/dark navigation, header/profile,
Metrics charts, invalid deep-link redirect, and preview-dialog keyboard/focus QA remain residual risk.
