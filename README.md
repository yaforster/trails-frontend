# TrailsFrontend

## Credential-free access

With the backend's `trails-auth-none` adapter, the frontend opens directly without login and all visitors use one
shared profile. Startup loads public `/api/capabilities`; only `AUTHENTICATION_REQUIRED=false` enables unrestricted
access. Missing or failed metadata does not grant access. Profile availability comes from `USER_FEATURES_ACTIVE`.
Requests, downloads, and execution streams omit bearer tokens in this mode, including any stored provider token.
There is no token refresh or logout action. `TRAILS_API_BASE_URL` remains required; `TRAILS_KEYCLOAK_TOKEN_URL` can
be omitted or empty for local builds and Docker startup. Provider-backed login still requires that token URL.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.11.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Test-plan graph limits

The modeller loads `TEST_PLAN_MAXIMUM_ACTIONS`, `TEST_PLAN_MAXIMUM_PATHS`, and
`TEST_PLAN_MAXIMUM_ACTION_OCCURRENCES` from startup capabilities. It displays validation feedback and prevents saving
graphs beyond those server-configured limits. Shared actions count once per execution path. Missing or invalid limit
metadata blocks saving with a reload message; there are no client-side default limits. The server independently
validates saved and executed plans. Deploy the matching SDK metadata contract with this client.

## Completion email

In **Run test plan**, select browsers and explicitly enable **Email test results after completion**.
Add recipient chips using Enter or the displayed separators. A focused chip can be removed with Backspace;
the editor restores input focus. Recipient feedback is associated with the labeled input, and rejected run
requests are announced in the dialog so the settings can be corrected.

Default execution and switching email off omit `completionNotification` entirely. Opt-in sends the generated
`{ emailEnabled: true, recipientEmails: [...] }` contract. Useful client checks enforce 1–100 ASCII mailboxes,
254 characters per address and 64 before `@`, and reject canonical duplicates. Domain case is normalized;
local-part case is preserved. The service is authoritative, including whether mail is available. Acceptance
of a run is not proof of mail delivery. Notifications are best effort after persisted completion, and result
links still require normal access permissions. Recipient state is transient to the run dialog.

`api/hateoas.yaml` mirrors the SDK's authoritative contract. Regenerate clients using `npm run generate:api`
after synchronization; never edit generated client types. Authentication continues through the existing
Keycloak/Bearer flow; notification controls do not depend on the selected backend authentication provider.

## Verification

Run repository checks from project root:

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
npm test -- --watch=false
npm run format:check
npx ng build
npm run generate:api
npm run build
```

`npm run build` regenerates API clients and runtime configuration first. Generated clients under
`src/app/generated` are output from `npm run generate:api`; do not edit them by hand.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
