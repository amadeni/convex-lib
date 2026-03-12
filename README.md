# @amadeni/convex-lib

Reusable Convex primitives for authenticated and admin-only functions, lightweight error helpers, and Zod utilities for Convex IDs and system fields.

## Install

```bash
pnpm add @amadeni/convex-lib convex convex-helpers zod
```

## Setup

```ts
import { createPrimitives } from '@amadeni/convex-lib';

export const { authQuery, authMutation, authAction, adminQuery, adminMutation, adminAction } =
  createPrimitives({
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

## Usage

```ts
import { adminMutation, authQuery, createError } from './primitives';

export const getProfile = authQuery({
  args: {},
  handler: async ctx => {
    return ctx.user;
  },
});

export const deleteAccount = adminMutation({
  args: {},
  handler: async (ctx, args) => {
    void args;
    throw createError.forbidden();
  },
});
```

```ts
import { addSystemFields, zid } from '@amadeni/convex-lib';
import { z } from 'zod';

const userId = zid('users');

const userShape = addSystemFields('users', {
  email: z.string().email(),
  role: z.string(),
});
```
