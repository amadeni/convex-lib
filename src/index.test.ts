import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import {
  AppError,
  ErrorCode,
  addSystemFields,
  createAuthorized,
  createCapabilityChecker,
  createError,
  createPermissionChecker,
  createPrimitives,
  publicQuery,
  publicMutation,
  publicAction,
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
    expect(createError.unauthorized().code).toBe(ErrorCode.UNAUTHORIZED);
    expect(createError.inactiveUser().code).toBe(ErrorCode.INACTIVE_USER);
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

  it('returns capability builders when a capability checker is provided', () => {
    const capabilityChecker = createCapabilityChecker({
      registry: {
        'invoice.manage': {
          label: 'Manage invoices',
          category: 'invoices',
          defaultRoles: ['admin'] as const,
        },
      },
      getOverride: async () => null,
    });

    const primitives = createPrimitives({
      resolveUser: async () => ({
        _id: 'user_123',
        email: 'test@example.com',
        role: 'admin',
      }),
      isAdmin: user => user.role === 'admin',
      capabilityChecker,
    });

    expect(primitives).toMatchObject({
      authQuery: expect.any(Function),
      authMutation: expect.any(Function),
      authAction: expect.any(Function),
      adminQuery: expect.any(Function),
      adminMutation: expect.any(Function),
      adminAction: expect.any(Function),
      capabilityQuery: expect.any(Function),
      capabilityMutation: expect.any(Function),
      capabilityAction: expect.any(Function),
    });
  });
});

describe('public builders', () => {
  it('exports publicQuery, publicMutation, publicAction as functions', () => {
    expect(typeof publicQuery).toBe('function');
    expect(typeof publicMutation).toBe('function');
    expect(typeof publicAction).toBe('function');
  });
});

describe('createPermissionChecker', () => {
  it('bypasses permission checks for admin roles', async () => {
    const checker = createPermissionChecker({
      getPermission: async () => ({
        role: 'admin',
        resource: 'posts',
        read: false,
      }),
      getDocument: async () => null,
    });

    await expect(
      checker.hasPermission(
        {},
        { _id: 'user_1', email: 'admin@example.com', role: 'admin' },
        'posts',
        'read',
      ),
    ).resolves.toBe(true);
  });

  it('uses stored permissions and default allow when no entry exists', async () => {
    const checker = createPermissionChecker({
      getPermission: async (_ctx, role, resource) => {
        if (role === 'editor' && resource === 'posts') {
          return { role, resource, update: true };
        }

        return null;
      },
      getDocument: async () => null,
    });

    await expect(
      checker.hasPermission(
        {},
        { _id: 'user_1', email: 'editor@example.com', role: 'editor' },
        'posts',
        'update',
      ),
    ).resolves.toBe(true);

    await expect(
      checker.hasPermission(
        {},
        { _id: 'user_1', email: 'editor@example.com', role: 'editor' },
        'comments',
        'read',
      ),
    ).resolves.toBe(true);
  });

  it('supports deny-by-default behavior and ownership checks', async () => {
    const checker = createPermissionChecker({
      defaultAllow: false,
      getPermission: async (_ctx, role, resource) => {
        if (role === 'member' && resource === 'posts') {
          return {
            role,
            resource,
            read: true,
            ownOnly: true,
            ownership: 'ownerId',
          };
        }

        return null;
      },
      getDocument: async (_ctx, _table, id) =>
        id === 'post_1' ? { _id: id, ownerId: 'user_1' } : null,
    });

    await expect(
      checker.hasPermission(
        {},
        { _id: 'user_1', email: 'member@example.com', role: 'member' },
        'comments',
        'read',
      ),
    ).resolves.toBe(false);

    await expect(
      checker.checkOwnership({}, 'user_1', 'posts', 'post_1', 'member'),
    ).resolves.toBe(true);

    await expect(
      checker.checkOwnership({}, 'user_2', 'posts', 'post_1', 'member'),
    ).resolves.toBe(false);
  });
});

describe('createAuthorized', () => {
  it('returns the expected authorized builders', () => {
    const permissionChecker = createPermissionChecker({
      getPermission: async () => null,
      getDocument: async () => null,
    });

    const authorized = createAuthorized({
      resolveUser: async () => ({
        _id: 'user_123',
        email: 'test@example.com',
        role: 'admin',
      }),
      isAdmin: user => user.role === 'admin',
      permissionChecker,
    });

    expect(authorized).toMatchObject({
      authorizedQuery: expect.any(Function),
      authorizedMutation: expect.any(Function),
      authorizedAction: expect.any(Function),
    });
  });
});

describe('createCapabilityChecker', () => {
  const registry = {
    'invoice.manage': {
      label: 'Manage invoices',
      category: 'invoices',
      defaultRoles: ['accountant'] as const,
    },
    'client.create': {
      label: 'Create client',
      category: 'clients',
      defaultRoles: ['cob'] as const,
    },
    'system.config': {
      label: 'System config',
      category: 'system',
      defaultRoles: [] as const,
    },
  };

  it('grants all capabilities to admin roles', async () => {
    const checker = createCapabilityChecker({
      registry,
      getOverride: async () => null,
    });

    await expect(checker.has({}, 'admin', 'invoice.manage')).resolves.toBe(
      true,
    );
    await expect(checker.has({}, 'admin', 'system.config')).resolves.toBe(true);
  });

  it('checks default roles from registry', async () => {
    const checker = createCapabilityChecker({
      registry,
      getOverride: async () => null,
    });

    await expect(checker.has({}, 'accountant', 'invoice.manage')).resolves.toBe(
      true,
    );
    await expect(checker.has({}, 'cob', 'invoice.manage')).resolves.toBe(false);
    await expect(checker.has({}, 'cob', 'client.create')).resolves.toBe(true);
    await expect(checker.has({}, undefined, 'client.create')).resolves.toBe(
      false,
    );
  });

  it('uses DB overrides over registry defaults', async () => {
    const checker = createCapabilityChecker({
      registry,
      getOverride: async (_ctx, key) => {
        if (key === 'invoice.manage') {
          return { key, roles: ['cob', 'accountant'] };
        }
        return null;
      },
    });

    // cob now has invoice.manage via override
    await expect(checker.has({}, 'cob', 'invoice.manage')).resolves.toBe(true);
  });

  it('supports custom admin roles', async () => {
    const checker = createCapabilityChecker({
      registry,
      getOverride: async () => null,
      adminRoles: ['admin', 'superadmin'],
    });

    await expect(checker.has({}, 'superadmin', 'system.config')).resolves.toBe(
      true,
    );
  });

  it('checkAll returns all capabilities for a role', async () => {
    const checker = createCapabilityChecker({
      registry,
      getOverride: async () => null,
    });

    const result = await checker.checkAll({}, 'accountant');
    expect(result).toEqual({
      'invoice.manage': true,
      'client.create': false,
      'system.config': false,
    });
  });

  it('exposes registry keys', () => {
    const checker = createCapabilityChecker({
      registry,
      getOverride: async () => null,
    });

    expect(checker.keys).toEqual([
      'invoice.manage',
      'client.create',
      'system.config',
    ]);
  });
});
