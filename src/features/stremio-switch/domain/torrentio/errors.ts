export type TorrentioErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_SCHEME'
  | 'UNSUPPORTED_HOST'
  | 'UNSUPPORTED_PORT'
  | 'INVALID_USERINFO'
  | 'INVALID_QUERY_OR_FRAGMENT'
  | 'INVALID_PATH'
  | 'INVALID_SYNTAX'
  | 'DUPLICATE_OPTION'
  | 'UNKNOWN_OPTION'
  | 'INVALID_OPTION_VALUE'
  | 'MISSING_CREDENTIAL'
  | 'UNSUPPORTED_CREDENTIAL'
  | 'MULTIPLE_CREDENTIALS'
  | 'INVALID_CREDENTIAL';

export class TorrentioConfigError extends Error {
  readonly code: TorrentioErrorCode;

  constructor(code: TorrentioErrorCode, message: string) {
    super(message);
    this.name = 'TorrentioConfigError';
    this.code = code;
    Object.setPrototypeOf(this, TorrentioConfigError.prototype);
  }
}
