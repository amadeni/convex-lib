import { ConvexError } from 'convex/values';

export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
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
  unauthenticated: () => new AppError(ErrorCode.UNAUTHENTICATED, 'User not authenticated'),
  forbidden: (msg?: string) => new AppError(ErrorCode.FORBIDDEN, msg ?? 'Access forbidden'),
  notFound: (entity?: string) =>
    new AppError(
      ErrorCode.NOT_FOUND,
      entity ? `${entity} not found` : 'Resource not found',
    ),
  conflict: (msg?: string) => new AppError(ErrorCode.CONFLICT, msg ?? 'Conflict'),
  badRequest: (msg?: string) => new AppError(ErrorCode.BAD_REQUEST, msg ?? 'Bad request'),
  internal: (msg?: string) =>
    new AppError(ErrorCode.INTERNAL_ERROR, msg ?? 'Internal server error'),
};
