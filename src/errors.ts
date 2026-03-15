import { ConvexError } from 'convex/values';

export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INACTIVE_USER: 'INACTIVE_USER',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends ConvexError<{ code: ErrorCode }> {
  constructor(code: ErrorCode, detailedMessage?: string) {
    super({ code });

    if (detailedMessage) {
      console.error(`[${code}] ${detailedMessage}`);
    }
  }

  get code(): ErrorCode {
    return this.data.code;
  }
}

export const createError = {
  unauthenticated: () =>
    new AppError(ErrorCode.UNAUTHENTICATED, 'User not authenticated'),
  unauthorized: (msg?: string) =>
    new AppError(ErrorCode.UNAUTHORIZED, msg ?? 'Insufficient permissions'),
  forbidden: (msg?: string) =>
    new AppError(ErrorCode.FORBIDDEN, msg ?? 'Access forbidden'),
  inactiveUser: (msg?: string) =>
    new AppError(ErrorCode.INACTIVE_USER, msg ?? 'User account is inactive'),
  notFound: (entity?: string, id?: string) =>
    new AppError(
      ErrorCode.NOT_FOUND,
      entity
        ? id
          ? `${entity} ${id} not found`
          : `${entity} not found`
        : 'Resource not found',
    ),
  conflict: (msg?: string) =>
    new AppError(ErrorCode.CONFLICT, msg ?? 'Conflict'),
  badRequest: (msg?: string) =>
    new AppError(ErrorCode.BAD_REQUEST, msg ?? 'Bad request'),
  internal: (msg?: string) =>
    new AppError(ErrorCode.INTERNAL_ERROR, msg ?? 'Internal server error'),
};
