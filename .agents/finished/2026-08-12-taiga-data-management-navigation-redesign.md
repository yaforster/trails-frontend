# Approved plan: Taiga navigation and Data Management redesign

## Original request and scope

Replace old top-row navigation with Taiga navigation. Redesign Data Management for productivity, then review prior redesign and optimize.

This approved change covers shell navigation and Data Management section switching only. Do not change production behavior outside these views. Do not edit generated output. Do not commit or push.

## Repository facts and ownership boundaries

- Repository root: `trails-frontend`.
- Shell navigation ownership: `src/app/layout/shell.component.ts`, `.html`, and `.css`; profile button styling is in `src/app/layout/current-user-profile-button.component.css`; shared visual tokens/styles are in `src/styles.css`.
- Data Management route-page ownership: `src/app/features/data-management/data-management-page.component.ts`, `.html`, and `.css` where present. Existing child sections own their loaded data, pagination, selected profile, dialogs, drafts, errors, and pending actions.
- Root application coverage currently includes `src/app/app.spec.ts`. Planned focused routed-page coverage belongs in a Data Management page spec.
- Angular 21 and Taiga UI 5.13 are installed. `@taiga-ui/layout` supplies `TuiNavigation`; Taiga segmented controls are available from installed packages.
- `CONTINUITY.md` must be read before work and updated only after verified final outcome.
- Existing applicable instructions require standalone Angular components, OnPush, signals, explicit named types, `inject()`, native control flow, no inline template styles, and Clarity guidance before custom styling.
- Taiga 5.13 segmented control indexes direct children. Do not put wrapper elements inside it.

## Approved decisions, assumptions, and plan review

- User explicitly approved implementation after plan-review `ACCEPT`.
- Default Data Management section: `test-plans`.
- Query parameter: `section`.
- Only valid values: `test-plans`, `elements`, `test-data`, `deployments`.
- Missing or invalid `section` displays Test plans without rewriting URL.
- Section picker navigation merges unrelated query parameters.
- Browser history restores section selection.
- All four existing child section components remain mounted. Use `[hidden]`, not conditional creation, to preserve each section's data, pagination, selected profile, dialogs, drafts, errors, and pending actions.
- Data page TypeScript uses local string-literal union, ordered immutable section list, signal/computed selected index, `FormsModule`, `TuiSegmented`, router query-param subscription with `takeUntilDestroyed`, and selection handler that only navigates. Retain one-time `ensureApplications` behavior.
- Markup hierarchy must be exactly: `fieldset` containing visible `legend`, containing scroll wrapper, containing `tui-segmented`; segmented has exactly four direct `label` children; each label contains same-name native radio input. No wrapper inside segmented.
- Use native radio semantics. Do not add `role="tab"` or `aria-selected`.
- CSS: scroll wrapper has bounded size and horizontal touch scrolling; segmented sizes to `max-content`; at viewport width `<=760px`, header stacks; visible keyboard focus treatment exists.
- No open questions.

## Observable acceptance criteria and unchanged behavior

1. Shell uses Taiga navigation instead of old top-row navigation while retaining route/auth gates, navigation feedback, notifications, theme persistence, workspace context, and current-user controls.
2. Data Management displays four picker choices in order: Test plans, Elements, Test data, Deployments.
3. Test plans is shown for absent, malformed, or unsupported `section`; URL stays unchanged for absent/invalid state.
4. Valid `section` reflects URL on direct navigation and browser back/forward navigation.
5. Selecting another section updates only `section` and retains unrelated query parameters.
6. Every existing child section remains instantiated across selection changes and is hidden when inactive.
7. Segment control meets exact direct-child/native-radio hierarchy and accessible native semantics.
8. Narrow layouts retain usable picker scrolling and keyboard focus visibility.
9. Existing Data Management initialization still calls `ensureApplications` once under existing conditions.

## Ordered implementation steps

1. **Shell layer** — Replace old custom top-row nav in shell template/component/style with Taiga `TuiNavigation`, sidebar navigation, and existing route links. Keep current guards, notification surface, workspace context, user/theme controls, active-route feedback, and theme behavior. Avoid duplicate active-route mechanisms where `tuiAsideItem` owns active state.
2. **Data Management types and state** — In page component, define local `DataManagementSection` union and ordered readonly section metadata. Derive selected index using signal/computed state from router query parameters. Validate externally supplied string before assigning selection; invalid/missing maps to `test-plans` display only. Preserve `ensureApplications` one-time initialization.
3. **Data Management router caller** — Subscribe to query parameters using router APIs and `takeUntilDestroyed`. Selection handler performs navigation only with `queryParamsHandling: 'merge'`; it must not directly mutate displayed selection or remove unrelated parameters. Browser history remains router source of truth.
4. **Data Management template** — Add required `fieldset`/visible `legend`/scroll wrapper/`tui-segmented` hierarchy. Keep exactly four direct label children in segmented, each containing same-name native radio. Bind native selection and index without tab ARIA. Render all four existing child components permanently; bind `[hidden]` to inactive sections.
5. **Data Management styles** — Apply small focused CSS only: bounded horizontal touch-scroll wrapper, `max-content` segmented sizing, stacked header at `<=760px`, keyboard `:focus-visible` treatment. Use existing semantic tokens/Clarity-compatible operational styling; no inline styles.
6. **Focused routed-page test** — Add shallow Data Management routed-page spec. Replace four child sections with named standalone stubs; spy workspace context; use real router/testing harness. Assert direct valid URL state, default/invalid non-rewrite behavior, history restoration, unrelated-param merge, component identity/mounted state, `[hidden]` behavior, exact hierarchy/direct-child contract, native-radio accessibility contract, selection navigation behavior, and CSS contract.
7. **Review and cleanup** — Inspect all affected callers and final diff. Remove no unrelated code. Do not hand-edit generated API/runtime files; if build regenerates them, confirm no content diff.

## Invariants and failure behavior

- Router query parameter is untrusted input: only four union members become selected state.
- Unknown/missing value never crashes page or changes URL; it displays default Test plans.
- Picker updates flow through router so browser history works.
- `[hidden]` prevents visual display without destroying child component instances.
- Native radios share a name and retain browser semantics; no competing ARIA tab model.
- Direct Taiga segmented children stay labels so Taiga 5.13 indexing remains correct.
- No API, persistence, security, config, deployment, migration, dependency, contract, or generated-source behavior changes.

## Tests and exact verification commands

Run after implementation; record actual outcome only:

1. Targeted page test including new routed-page spec: `npm.cmd test -- --watch=false --include src/app/features/data-management/data-management-page.component.spec.ts`
2. Full test suite: `npm.cmd test -- --watch=false`
3. Formatting check: `npm.cmd run format:check`
4. Angular build: `npx ng build`
5. Repository build: `npm.cmd run build`
6. Diff whitespace check: `git diff --check`
7. Final worktree inspection: `git status --short` and `git diff --check` / relevant `git diff`

Never run `npm run format`.

## Risks and adversarial-review focus

- Query-param subscription timing can desynchronize native-radio model from router state.
- Using conditional blocks could silently destroy child dialogs/drafts/pagination; verify object identity and hidden state.
- Nested segmented markup breaks Taiga direct-child indexing.
- Invalid/default URL handling could accidentally rewrite or strip query parameters.
- Query merge could discard unrelated parameters.
- Router test harness may mask native input semantics; assert DOM hierarchy and radio attributes directly.
- Verify responsive/focus CSS selectors and breakpoint contract, not only visual intent.
- Verify shell replacement did not remove existing route/auth/navigation feedback/theme/workspace-context behavior.

## Out of scope

- New Data Management API, persistence, security, permissions, backend, deployment, migration, or configuration work.
- New dependencies.
- Generated API/runtime output edits.
- Redesign of existing child-section internals.
- Unrelated worktree cleanup or formatting.

## Impact summary

- API: None.
- Persistence: None.
- Security: None.
- Configuration: None.
- Deployment: None.
- Documentation: `CONTINUITY.md` only after final verification and adversarial `ACCEPT` or explicit waiver.
- Migration: None.
- Generated sources: None; do not hand-edit.

## Preserved pre-existing worktree changes

At plan-artifact creation, these uncommitted files already differ and must be preserved without assumption of ownership:

- `CONTINUITY.md`
- `package-lock.json`
- `package.json`
- `src/app/app.spec.ts`
- `src/app/features/data-management/data-management-page.component.html`
- `src/app/features/data-management/data-management-page.component.ts`
- `src/app/layout/current-user-profile-button.component.css`
- `src/app/layout/shell.component.css`
- `src/app/layout/shell.component.html`
- `src/app/layout/shell.component.ts`
- `src/styles.css`

## Approval record

- 2026-08-12 — Plan review: `ACCEPT` (user-provided).
- 2026-08-12 — User explicitly approved implementation (user-provided).
- Plan status: approved; implementation not yet recorded in this artifact.

## Final outcome

### Actual implementation outcome

- Replaced ShellComponent's old custom top-row navigation with Taiga `TuiNavigation`: compact dark header, expandable productivity sidebar, retained workspace context, current-user and theme controls, notifications, route/auth gates, navigation feedback, and theme persistence. `tuiAsideItem` owns active-route state; duplicate `RouterLinkActive` bindings were removed.
- Data Management now selects Test plans, Elements, Test data, or Deployments from URL-backed `section` state. Test plans displays for missing/invalid values without rewriting URL. Picker navigation merges unrelated query parameters, and all four child sections stay mounted while inactive sections use `[hidden]`.
- Added focused Data Management page coverage for URL/default/history/merge behavior, mounted-section identity, DOM/radio hierarchy, and native semantics.
- Added `@taiga-ui/layout` 5.13.0 because it supplies `TuiNavigation`. This is an actual dependency change and an approved-plan impact-summary deviation; package manifest and lockfile changed together. No generated API/runtime source was hand-edited.

### Actual verification

- `npm.cmd test -- --watch=false --include src/app/features/data-management/data-management-page.component.spec.ts` — passed: 4 tests.
- `npm.cmd test -- --watch=false` — passed: 53 tests across 9 files.
- `npm.cmd run format:check` — passed.
- `npx ng build` — passed.
- `npm.cmd run build` — passed.
- `git diff --check` — passed; final documentation inspection reran it successfully.
- Build/API-runtime generation produced no tracked content diff.

### Adversarial review and residual risks

- Independent adversarial review reran focused and full tests, `npx ng build`, formatting check, and diff check; verdict: `ACCEPT`, zero rejected findings.
- Reviewer did not rerun `npm.cmd run build`; implementation verification did pass it.
- No lint script exists, so no lint command was available.
- Browser/manual visual and interaction QA remains unverified, including narrow-layout picker scrolling/focus and responsive Taiga navigation behavior.
- Adversarial-review waiver: none; `ACCEPT` received.

### Documentation and completion record

- Validated existing `CONTINUITY.md` additions: Data Management behavior, Taiga navigation behavior, Taiga-layout discovery, and reported verification are factual and match final worktree. No duplicate continuity entry added.
- Documentation changed: this finalized plan artifact only; `CONTINUITY.md` was already updated by implementation and was left unchanged during finalization.
- Status: complete. No commit or push.
