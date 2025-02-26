
export const DEFAULT_CONNECT_PARAMS = {
  username: 'test',
  password: 'test',
  url: 'ws://localhost:7171/api/v1/',
};

export const DEFAULT_AUTH_RESPONSE = {
  auth_token: 'b823187f-4aab-4b71-9764-e63e88401a26',
  refresh_token: '5124faasf-4aab-4b71-9764-e63e88401a26',
  user: {
    permissions: [ 'admin' ],
    username: 'test',
    active_sessions: 1,
    last_login: 0,
  },
  system: {
    cid: 'AHLUODI2YZ2U7FDWMHFNJU65ERGKUN4MH7GW5LY',
    hostname: 'ubuntu-htpc',
    network_type: 'private',
    path_separator: '/',
    platform: 'other',
    language: 'fi',
  },
  wizard_pending: false,
};
