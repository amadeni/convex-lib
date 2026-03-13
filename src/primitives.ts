import { actionGeneric, mutationGeneric, queryGeneric } from 'convex/server';
import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from 'convex-helpers/server/customFunctions';
import { createError } from './errors';
import type { ConvexLibConfig, ConvexLibUser } from './types';

export type { ConvexLibConfig, ConvexLibUser } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = Record<string, any>;

export interface ConvexLibPrimitives {
  authQuery: ReturnType<typeof customQuery>;
  authMutation: ReturnType<typeof customMutation>;
  authAction: ReturnType<typeof customAction>;
  adminQuery: ReturnType<typeof customQuery>;
  adminMutation: ReturnType<typeof customMutation>;
  adminAction: ReturnType<typeof customAction>;
}

const resolveAuthContext = async <User extends ConvexLibUser>(
  ctx: AnyCtx,
  config: ConvexLibConfig<User>,
) => {
  const user = await config.resolveUser(ctx);
  return { user, userId: user._id };
};

const resolveAdminContext = async <User extends ConvexLibUser>(
  ctx: AnyCtx,
  config: ConvexLibConfig<User>,
) => {
  const auth = await resolveAuthContext(ctx, config);

  if (!config.isAdmin(auth.user)) {
    throw createError.forbidden('Admin access required');
  }

  return auth;
};

export const createPrimitives = <User extends ConvexLibUser>(
  config: ConvexLibConfig<User>,
): ConvexLibPrimitives => {
  const authCtx = customCtx((ctx: AnyCtx) => resolveAuthContext(ctx, config));
  const adminCtx = customCtx((ctx: AnyCtx) => resolveAdminContext(ctx, config));

  return {
    authQuery: customQuery(queryGeneric, authCtx),
    authMutation: customMutation(mutationGeneric, authCtx),
    authAction: customAction(actionGeneric, authCtx),
    adminQuery: customQuery(queryGeneric, adminCtx),
    adminMutation: customMutation(mutationGeneric, adminCtx),
    adminAction: customAction(actionGeneric, adminCtx),
  };
};

/**
 * Public (unauthenticated) query/mutation/action builders.
 *
 * Use these for intentionally public endpoints (e.g. tenant config, health checks).
 * They are thin wrappers around the generic Convex builders — their purpose is to
 * make the intent explicit and detectable by CI auth-enforcement checks.
 *
 * Any file importing from `_generated/server` directly should be flagged by CI.
 * Using `publicQuery` instead signals "this is intentionally unauthenticated".
 *
 * @example
 * ```ts
 * import { publicQuery } from '@amadeni/convex-lib';
 *
 * export const getTenantConfig = publicQuery({
 *   args: { subdomain: v.string() },
 *   handler: async (ctx, args) => {
 *     return await ctx.db.query('tenantConfig')
 *       .filter(q => q.eq(q.field('subdomain'), args.subdomain))
 *       .first();
 *   },
 * });
 * ```
 */
export const publicQuery = queryGeneric;
export const publicMutation = mutationGeneric;
export const publicAction = actionGeneric;
