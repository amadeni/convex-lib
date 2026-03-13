import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import {
  AppError,
  ErrorCode,
  addSystemFields,
  createError,
  createPrimitives,
  zid,
} from './index';

describe('createError', () => {
  it('creates typed application errors', () => {
    const error = createError.forbidden('no access');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(ErrorCode.FORBIDDEN);
    expect(error.data).toEqual({ code: ErrorCode.FORBIDDEN });
  });

  it('uses the expected codes for the built-in factories', () => {
    expect(createError.unauthenticated().code).toBe(ErrorCode.UNAUTHENTICATED);
    expect(createError.notFound('User').code).toBe(ErrorCode.NOT_FOUND);
    expect(createError.conflict().code).toBe(ErrorCode.CONFLICT);
    expect(createError.badRequest().code).toBe(ErrorCode.BAD_REQUEST);
    expect(createError.internal().code).toBe(ErrorCode.INTERNAL_ERROR);
  });
});

describe('zod helpers', () => {
  it('validates convex ids as strings', () => {
    const schema = zid('users');

    expect(schema.parse('user_123')).toBe('user_123');
    expect(() => schema.parse(123)).toThrow();
  });

  it('adds convex system fields to a zod shape', () => {
    const schema = z.object(
      addSystemFields('users', {
        email: z.string().email(),
      }),
    );

    expect(
      schema.parse({
        email: 'test@example.com',
        _id: 'user_123',
        _creationTime: 123,
      }),
    ).toEqual({
      email: 'test@example.com',
      _id: 'user_123',
      _creationTime: 123,
    });
  });
});

describe('createPrimitives', () => {
  it('returns the expected custom function builders', () => {
    const primitives = createPrimitives({
      resolveUser: async () => ({
        _id: 'user_123',
        email: 'test@example.com',
        role: 'admin',
      }),
      isAdmin: user => user.role === 'admin',
    });

    expect(primitives).toMatchObject({
      authQuery: expect.any(Function),
      authMutation: expect.any(Function),
      authAction: expect.any(Function),
      adminQuery: expect.any(Function),
      adminMutation: expect.any(Function),
      adminAction: expect.any(Function),
    });
  });
});
