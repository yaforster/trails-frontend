import type {
  ActionResult,
  Artifact,
  PersistedTestRunResult,
  TestPathResult,
  TestSetResult,
} from '../../generated/hateoas/types.gen';

export type DetailsRoute = {
  applicationId: number;
  stageId: number;
  testRunId: number;
};

export type ActionResultView = {
  result: ActionResult;
  screenshotBlob: Blob | null;
  screenshotUrl: string | null;
};

export type ArtifactView = {
  artifact: Artifact;
  downloadUrl: string | null;
};

export type TestPathResultView = {
  result: TestPathResult;
  actions: ActionResultView[];
  artifacts: ArtifactView[];
};

export type TestSetResultView = {
  result: TestSetResult;
  paths: TestPathResultView[];
};

export type TestRunDetailsView = {
  result: PersistedTestRunResult;
  testSets: TestSetResultView[];
};

export type ActionResultType = NonNullable<ActionResult['resultType']>;
