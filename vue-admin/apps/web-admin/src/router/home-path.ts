const LEGACY_WORKSPACE_HOME_PATHS = new Set([
  '/dashboard/workspace',
  '/dashboard/workbench',
  '/workbench',
  '/workspace',
]);

const LEGACY_ANALYTICS_HOME_PATHS = new Set(['/analytics', '/dashboard/analytics']);

const WORKSPACE_HOME_PATH = '/Dashboard/Workspace';
const ANALYTICS_HOME_PATH = '/Dashboard/Analytics';
const CLIENT_HOME_PATH = '/home';

function normalizeHomePath(homePath?: null | string) {
  if (!homePath) {
    return WORKSPACE_HOME_PATH;
  }

  if (LEGACY_WORKSPACE_HOME_PATHS.has(homePath)) {
    return WORKSPACE_HOME_PATH;
  }

  if (LEGACY_ANALYTICS_HOME_PATHS.has(homePath)) {
    return ANALYTICS_HOME_PATH;
  }

  if (homePath === '/client' || homePath.startsWith('/client/')) {
    return CLIENT_HOME_PATH;
  }

  return homePath;
}

export { CLIENT_HOME_PATH, normalizeHomePath, WORKSPACE_HOME_PATH };
