// AUTHENTICATION

export type AuthTokenType = string;

export interface AuthenticationResponse {
  auth_token: AuthTokenType;
}

export interface LogoutResponse {

}


export interface CredentialsAuthenticationData {
  username: string;
  password: string;
  grant_type: 'password';
  max_inactivity?: number;
}

export interface RefreshTokenAuthenticationData {
  refresh_token: string;
  grant_type: 'refresh_token';
  max_inactivity?: number;
}

export interface TokenAuthenticationData {
  auth_token: string;
}


// ERRORS
export type FieldErrorCode = 'missing_field' | 'invalid' | 'already_exists';

export interface FieldError extends ErrorBase {
  message: string;
  field: string;
  code: FieldErrorCode;
}

export interface ErrorBase {
  message: string;
}

// GENERIC

export type EntityId = string | number;
