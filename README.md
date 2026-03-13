# @amadeni/convex-lib

Reusable Convex primitives for authenticated and admin-only functions, lightweight error helpers, and Zod utilities for Convex IDs and system fields.

## Install

```bash
pnpm add @amadeni/convex-lib convex convex-helpers zod
```

## Setup

```ts
import { createPrimitives } from '@amadeni/convex-lib';

export const {
  authQuery,
  authMutation,
  authAction,
  adminQuery,
  adminMutation,
  adminAction,
} = createPrimitives({
  resolveUser: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthenticated');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', q => q.eq('email', identity.email ?? ''))
      .unique();

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  },
  isAdmin: user => user.role === 'admin',
});
```

`createPrimitives` returns six helpers:

- `authQuery`: Query that requires an authenticated user.
- `authMutation`: Mutation that requires an authenticated user.
- `authAction`: Action that requires an authenticated user.
- `adminQuery`: Query that requires an authenticated admin user.
- `adminMutation`: Mutation that requires an authenticated admin user.
- `adminAction`: Action that requires an authenticated admin user.

All six helpers resolve your user through `resolveUser`. They add `ctx.user` and `ctx.userId` to the handler context, and the `admin*` variants also enforce `isAdmin(user)`.

## Usage

```ts
import {
  adminAction,
  adminMutation,
  adminQuery,
  authAction,
  authMutation,
  authQuery,
  createError,
} from '@amadeni/convex-lib';

export const getProfile = authQuery({
  args: {},
  handler: async ctx => {
    return ctx.user;
  },
});

export const updateProfile = authMutation({
  args: {},
  handler: async ctx => {
    return { userId: ctx.userId };
  },
});

export const syncProfile = authAction({
  args: {},
  handler: async ctx => {
    return { email: ctx.user.email };
  },
});

export const listUsers = adminQuery({
  args: {},
  handler: async ctx => {
    return { requestedBy: ctx.user.email };
  },
});

export const deleteAccount = adminMutation({
  args: {},
  handler: async (ctx, args) => {
    void args;
    throw createError.forbidden();
  },
});

export const rebuildSearchIndex = adminAction({
  args: {},
  handler: async ctx => {
    return { requestedBy: ctx.userId };
  },
});
```

## Zod Helpers

```ts
import { addSystemFields, zid } from '@amadeni/convex-lib';
import { z } from 'zod';

const userId = zid('users');

const userSchema = z.object(
  addSystemFields('users', {
    email: z.string().email(),
    role: z.string(),
  }),
);
```

`zid('users')` gives you a Zod validator for a Convex document ID represented as a string. The table name is mainly for readability and type intent.

`addSystemFields('users', shape)` is useful when you already have a base document shape and want to extend it with the Convex-managed fields every stored document has:

- `_id`: The document ID for that table.
- `_creationTime`: The timestamp assigned by Convex.

It returns a Zod object shape, not a finished schema, so wrap it with `z.object(...)` as shown above.

```ts
const parsedUser = userSchema.parse({
  _id: 'abc123',
  _creationTime: Date.now(),
  email: 'hello@example.com',
  role: 'admin',
});
```
