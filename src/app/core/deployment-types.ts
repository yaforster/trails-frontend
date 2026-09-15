export type Deployment = {
  id?: number;
  applicationId?: number;
  stageId?: number;
  version?: string;
  deployedAt?: string;
};

export type DeploymentDefinition = {
  version: string;
  deployedAt: string;
};

export type PagedDeployment = {
  applicationId?: number;
  stageId?: number;
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
  items?: Deployment[];
};
