const IAM_OVERVIEW_PATH = '/iam/overview';

function normalizeHomePath(homePath?: null | string) {
  return homePath || IAM_OVERVIEW_PATH;
}

export { IAM_OVERVIEW_PATH, normalizeHomePath };
