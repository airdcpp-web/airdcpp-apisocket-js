
export const DEFAULT_CONNECT_PARAMS = {
  username: 'test',
  password: 'test',
  url: 'ws://localhost:7171/api/v1/',
};

export const DEFAULT_CONNECT_RESPONSE = {
  session_id: 1,
  auth_token: 'b823187f-4aab-4b71-9764-e63e88401a26',
  token_type: 'Bearer',
  user: {
    permissions: [ 'admin' ],
    username: 'test',
    active_sessions: 1,
    last_login: 0,
  },
  system_info: {
    api_version: 1,
    api_feature_level: 0,
    cid: 'AHLUODI2YZ2U7FDWMHFNJU65ERGKUN4MH7GW5LY',
    hostname: 'ubuntu-htpc',
    network_type: 'private',
    path_separator: '/',
    platform: 'other',
    language: 'fi',
    client_started: 1483972366,
    client_version: 'AirDC++w 2.14.0b-39-g3af3 x86_64',
  },
  wizard_pending: false,
};

export const DEFAULT_AUTH_RESPONSE = {
  ...DEFAULT_CONNECT_RESPONSE,
  refresh_token: '5124faasf-4aab-4b71-9764-e63e88401a26',
}
