# @amadeni/convex-lib

Typed auth, admin, capability, and authorization primitives for Convex apps.

The library is designed for real Convex projects using:

- generated `convex/_generated/*` builders and context types
- `convex-helpers`
- Convex Auth
- strict TypeScript
- capability-based access control
- action/query/mutation wrappers

## Install

```bash
pnpm add @amadeni/convex-lib convex convex-helpers zod
```

## Recommended Setup

For most apps, keep one central [`convex/lib.ts`](./convex/lib.ts) setup file and export all wrappers from a single composer:

```ts
import {
  createActionResolvers,
  createCapabilityChecker,
  createConvexLib,
  createError,
  createPermissionCheckerFromCapabilities,
} from '@amadeni/convex-lib';
import { action, mutation, query } from './_generated/server';

// Keep generated function refs outside `convex/` to avoid API cycles.
import {
  getCapabilityOverrideRef,
  getPermissionEntryRef,
  getUserBySubjectRef,
} from '../lib/convex-refs';

const capabilityRegistry = {
  'posts.manage': {
    label: 'Manage posts',
    category: 'content',
    defaultRoles: ['admin', 'editor'] as const,
    grants: {
      posts: {
        read: true as const,
        update: true as const,
      },
    },
  },
  'posts.delete': {
    label: 'Delete posts',
    category: 'content',
    defaultRoles: ['admin'] as const,
    grants: {
      posts: {
        delete: true as const,
      },
    },
  },
};

const resolveUser = async (
  ctx: typeof query._handlerCtx | typeof mutation._handlerCtx,
) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw createError.unauthenticated();
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_subject', q => q.eq('subject', identity.subject))
    .unique();

  if (!user) {
    throw createError.notFound('users', identity.subject);
  }

  return user;
};

const capabilityChecker = createCapabilityChecker({
  registry: capabilityRegistry,
  getOverride: async (ctx, key) => {
    return await ctx.db
      .query('capabilityOverrides')
      .withIndex('by_key', q => q.eq('key', key))
      .first();
  },
});

const permissionChecker = createPermissionCheckerFromCapabilities({
  registry: capabilityRegistry,
  getOverride: async (ctx, key) => {
    return await ctx.db
      .query('capabilityOverrides')
      .withIndex('by_key', q => q.eq('key', key))
      .first();
  },
  getDocument: async (ctx, _table, id) => await ctx.db.get(id),
  defaultAllow: false,
});

const actionRuntime = createActionResolvers({
  registry: capabilityRegistry,
  getUserRef: getUserBySubjectRef,
  getUserArgs: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw createError.unauthenticated();
    }

    return { subject: identity.subject };
  },
  getCapabilityOverrideRef,
  getCapabilityOverrideArgs: (_ctx, key) => ({ key }),
  getPermissionRef: getPermissionEntryRef,
  getPermissionArgs: (_ctx, role, resource) => ({ role, resource }),
});

export const {
  authQuery,
  authMutation,
  authAction,
  adminQuery,
  adminMutation,
  adminAction,
  capabilityQuery,
  capabilityMutation,
  capabilityAction,
  authorizedQuery,
  authorizedMutation,
  authorizedAction,
} = createConvexLib({
  query,
  mutation,
  action,
  isAdmin: user => user.role === 'admin',
  runtime: {
    query: {
      resolveUser,
      capabilityChecker,
      permissionChecker,
    },
    mutation: {
      resolveUser,
      capabilityChecker,
      permissionChecker,
    },
    action: actionRuntime,
  },
});
```

This keeps the app-specific Convex types from `_generated/server` intact, so wrapped handlers still behave like your real `QueryCtx`, `MutationCtx`, and `ActionCtx`.

## Composer

`createConvexLib(...)` is the recommended top-level API for apps that want one central setup and one flat export surface.

It returns:

- `authQuery`, `authMutation`, `authAction`
- `adminQuery`, `adminMutation`, `adminAction`
- `capabilityQuery`, `capabilityMutation`, `capabilityAction`
- `authorizedQuery`, `authorizedMutation`, `authorizedAction`

If you prefer lower-level composition, `createPrimitives(...)` and `createAuthorized(...)` are still exported separately.

## Runtime Config

The preferred config shape is runtime-aware:

```ts
runtime: {
  query: { resolveUser, capabilityChecker, permissionChecker },
  mutation: { resolveUser, capabilityChecker, permissionChecker },
  action: { resolveUser, capabilityChecker, permissionChecker },
}
```

This is clearer than parallel flat options and maps directly to how Convex runtimes differ in practice.

Flat legacy options like `resolveUserAction`, `capabilityCheckerAction`, and `permissionCheckerAction` are still supported as compatibility aliases.

## Action Bridging

Actions often cannot use `ctx.db` directly the same way as queries and mutations. Use `createActionResolvers(...)` to build a `runtime.action` entry from `runQuery(...)` refs:

```ts
const actionRuntime = createActionResolvers({
  registry: capabilityRegistry,
  getUserRef,
  getUserArgs: async ctx => ({
    subject: (await ctx.auth.getUserIdentity())?.subject,
  }),
  getCapabilityOverrideRef,
  getCapabilityOverrideArgs: (_ctx, key) => ({ key }),
  getPermissionRef,
  getPermissionArgs: (_ctx, role, resource) => ({ role, resource }),
});
```

It returns:

- `resolveUser`
- `capabilityChecker` when `registry` and `getCapabilityOverrideRef` are provided
- `permissionChecker` when `getPermissionRef` is provided

That object can be passed directly to `runtime.action`.

## Capabilities To CRUD

If your app derives CRUD authorization from capability grants plus capability overrides, use `createPermissionCheckerFromCapabilities(...)`.

Add `grants` to capability definitions:

```ts
const capabilityRegistry = {
  'posts.manage': {
    label: 'Manage posts',
    category: 'content',
    defaultRoles: ['editor'] as const,
    grants: {
      posts: {
        read: true as const,
        update: true as const,
      },
    },
  },
};
```

Then create the permission checker:

```ts
const permissionChecker = createPermissionCheckerFromCapabilities({
  registry: capabilityRegistry,
  getOverride: async (ctx, key) => {
    return await ctx.db
      .query('capabilityOverrides')
      .withIndex('by_key', q => q.eq('key', key))
      .first();
  },
  getDocument: async (ctx, _table, id) => await ctx.db.get(id),
  defaultAllow: false,
});
```

This removes the common local adapter that translates capability grants into CRUD permissions.

## Generated API Cycle Guidance

Avoid importing `convex/_generated/api` inside `convex/lib.ts` when that file is itself part of your Convex API surface. That can create circular type dependencies during code generation.

Recommended pattern:

1. Keep generated builders like `query`, `mutation`, and `action` inside `convex/lib.ts`.
2. Keep function refs used by action bridges in a file outside `convex/`, for example `src/lib/convex-refs.ts`.
3. Import those refs into `convex/lib.ts`.

That keeps the setup typed without feeding `convex/_generated/api` back into the same module graph being generated.

## Handler Context

Wrapped handlers preserve the app’s real Convex context and add auth fields on top:

- `ctx.user`
- `ctx.userId`
- `ctx.role`

The original Convex surface remains available and typed:

- `ctx.db.query('table')`
- `ctx.runQuery(...)`
- `ctx.runMutation(...)`
- `ctx.storage`
- `ctx.scheduler`

That means helper functions expecting real `QueryCtx`, `MutationCtx`, or `ActionCtx` still accept the wrapped `ctx`.

## Authorized Helpers

`authorizedQuery(...)` adds:

- `ctx.ownedQuery(tableName)`
- `ctx.ownedDoc(tableName, documentId)`

`authorizedMutation(...)` adds:

- `ctx.ownedDoc(tableName, documentId)`
- `ctx.ownedMutation.patch(tableName, documentId, patch)`
- `ctx.ownedMutation.delete(tableName, documentId)`

These remain typed against your app’s data model when you pass generated builders from `_generated/server`.

## Error Helpers

`createError` includes:

- `unauthenticated()`
- `unauthorized(message?)`
- `forbidden(message?)`
- `inactiveUser(message?)`
- `notFound(entity, id?)`
- `conflict(message?)`
- `badRequest(message?)`
- `internal(message?)`

## Zod Helpers

```ts
import { addSystemFields, zid } from '@amadeni/convex-lib';
import { z } from 'zod';

const userSchema = z.object(
  addSystemFields('users', {
    email: z.string().email(),
    role: z.string().optional(),
  }),
);

const userId = zid('users');
```

`addSystemFields(...)` returns a Zod object shape, so wrap it with `z.object(...)`.
