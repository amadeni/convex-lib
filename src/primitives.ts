import { actionGeneric, mutationGeneric, queryGeneric } from 'convex/server';
import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from 'convex-helpers/server/customFunctions';
import type { CapabilityChecker, CapabilityRegistry } from './capabilities';
import { createError } from './errors';
import type { AnyCtx, ConvexLibConfig, ConvexLibUser } from './types';

export type { ConvexLibConfig, ConvexLibUser } from './types';

export interface ConvexLibPrimitives {
  authQuery: ReturnType<typeof customQuery>;
  authMutation: ReturnType<typeof customMutation>;
  authAction: ReturnType<typeof customAction>;
  adminQuery: ReturnType<typeof customQuery>;
  adminMutation: ReturnType<typeof customMutation>;
  adminAction: ReturnType<typeof customAction>;
}

export interface CapabilityPrimitives<
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
> {
  capabilityQuery: (
    key: string & keyof TRegistry,
  ) => ReturnType<typeof customQuery>;
  capabilityMutation: (
    key: string & keyof TRegistry,
  ) => ReturnType<typeof customMutation>;
  capabilityAction: (
    key: string & keyof TRegistry,
  ) => ReturnType<typeof customAction>;
}

export interface CapabilityPrimitivesConfig<
  User extends ConvexLibUser,
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
> extends ConvexLibConfig<User> {
  capabilityChecker: CapabilityChecker<TRegistry>;
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

const resolveCapabilityContext = async <
  User extends ConvexLibUser,
  TRegistry extends CapabilityRegistry,
>(
  ctx: AnyCtx,
  config: CapabilityPrimitivesConfig<User, TRegistry>,
  key: string & keyof TRegistry,
) => {
  const auth = await resolveAuthContext(ctx, config);
  const role = auth.user.role;
  const allowed = await config.capabilityChecker.has(ctx, role, key);

  if (!allowed) {
    throw createError.unauthorized(`User lacks capability ${key}`);
  }

  return { ...auth, role };
};

const hasCapabilityChecker = <
  User extends ConvexLibUser,
  TRegistry extends CapabilityRegistry,
>(
  config: ConvexLibConfig<User> | CapabilityPrimitivesConfig<User, TRegistry>,
): config is CapabilityPrimitivesConfig<User, TRegistry> =>
  'capabilityChecker' in config;

export function createPrimitives<User extends ConvexLibUser>(
  config: ConvexLibConfig<User>,
): ConvexLibPrimitives;
export function createPrimitives<
  User extends ConvexLibUser,
  TRegistry extends CapabilityRegistry,
>(
  config: CapabilityPrimitivesConfig<User, TRegistry>,
): ConvexLibPrimitives & CapabilityPrimitives<TRegistry>;
export function createPrimitives<
  User extends ConvexLibUser,
  TRegistry extends CapabilityRegistry,
>(config: ConvexLibConfig<User> | CapabilityPrimitivesConfig<User, TRegistry>) {
  const authCtx = customCtx((ctx: AnyCtx) => resolveAuthContext(ctx, config));
  const adminCtx = customCtx((ctx: AnyCtx) => resolveAdminContext(ctx, config));
  const primitives: ConvexLibPrimitives = {
    authQuery: customQuery(queryGeneric, authCtx),
    authMutation: customMutation(mutationGeneric, authCtx),
    authAction: customAction(actionGeneric, authCtx),
    adminQuery: customQuery(queryGeneric, adminCtx),
    adminMutation: customMutation(mutationGeneric, adminCtx),
    adminAction: customAction(actionGeneric, adminCtx),
  };

  if (!hasCapabilityChecker(config)) {
    return primitives;
  }

  return {
    ...primitives,
    capabilityQuery: (key: string & keyof TRegistry) =>
      customQuery(
        queryGeneric,
        customCtx((ctx: AnyCtx) => resolveCapabilityContext(ctx, config, key)),
      ),
    capabilityMutation: (key: string & keyof TRegistry) =>
      customMutation(
        mutationGeneric,
        customCtx((ctx: AnyCtx) => resolveCapabilityContext(ctx, config, key)),
      ),
    capabilityAction: (key: string & keyof TRegistry) =>
      customAction(
        actionGeneric,
        customCtx((ctx: AnyCtx) => resolveCapabilityContext(ctx, config, key)),
      ),
  };
}

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
