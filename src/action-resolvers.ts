import type {
  FunctionReference,
  FunctionReturnType,
  GenericActionCtx,
  OptionalRestArgs,
} from 'convex/server';
import type { GenericDataModel } from 'convex/server';
import type { CapabilityRegistry, CapabilityOverride } from './capabilities';
import { createCapabilityChecker } from './capabilities';
import type { PermissionEntry, PermissionChecker } from './permissions';
import { createPermissionChecker } from './permissions';
import type {
  ConvexLibUser,
  MaybePromise,
  RuntimeResolverConfigEntry,
} from './types';

type QueryRef<
  Args extends Record<string, unknown> = Record<string, unknown>,
  Return = unknown,
> = FunctionReference<'query', 'public' | 'internal', Args, Return>;

type AnyQueryRef = QueryRef<Record<string, unknown>, unknown>;

type ActionContextWithRunQuery = Pick<
  GenericActionCtx<GenericDataModel>,
  | 'runQuery'
  | 'runMutation'
  | 'runAction'
  | 'scheduler'
  | 'auth'
  | 'storage'
  | 'vectorSearch'
>;

const runQueryRef = async <
  Ctx extends ActionContextWithRunQuery,
  Ref extends AnyQueryRef,
>(
  ctx: Ctx,
  ref: Ref,
  args: Record<string, unknown> | undefined,
): Promise<FunctionReturnType<Ref>> => {
  const runQuery = ctx.runQuery as (
    ref: Ref,
    ...args: OptionalRestArgs<Ref>
  ) => Promise<FunctionReturnType<Ref>>;

  if (args === undefined) {
    return runQuery(ref, ...([] as unknown as OptionalRestArgs<Ref>));
  }

  return runQuery(ref, ...([args] as unknown as OptionalRestArgs<Ref>));
};

export interface CreateActionResolversConfig<
  User extends ConvexLibUser,
  ActionCtx extends ActionContextWithRunQuery = ActionContextWithRunQuery,
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
  UserRef extends QueryRef<Record<string, unknown>, User> = QueryRef<
    Record<string, unknown>,
    User
  >,
  CapabilityOverrideRef extends QueryRef<
    Record<string, unknown>,
    CapabilityOverride | null
  > = QueryRef<Record<string, unknown>, CapabilityOverride | null>,
  PermissionRef extends QueryRef<
    Record<string, unknown>,
    PermissionEntry | null
  > = QueryRef<Record<string, unknown>, PermissionEntry | null>,
> {
  resolveUser?: (ctx: ActionCtx) => MaybePromise<User>;
  getUserRef?: UserRef;
  getUserArgs?: (
    ctx: ActionCtx,
  ) => MaybePromise<Record<string, unknown> | undefined>;
  registry?: TRegistry;
  getCapabilityOverrideRef?: CapabilityOverrideRef;
  getCapabilityOverrideArgs?: (
    ctx: ActionCtx,
    key: string & keyof TRegistry,
  ) => MaybePromise<Record<string, unknown> | undefined>;
  getPermissionRef?: PermissionRef;
  getPermissionArgs?: (
    ctx: ActionCtx,
    role: User['role'],
    resource: string,
  ) => MaybePromise<Record<string, unknown> | undefined>;
  adminRoles?: readonly Exclude<User['role'], undefined>[];
  defaultAllow?: boolean;
}

export interface ActionRuntimeResolvers<
  User extends ConvexLibUser,
  ActionCtx extends ActionContextWithRunQuery = ActionContextWithRunQuery,
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
> extends RuntimeResolverConfigEntry<ActionCtx, User> {
  capabilityChecker?: ReturnType<
    typeof createCapabilityChecker<ActionCtx, TRegistry, User['role']>
  >;
  permissionChecker?: PermissionChecker<
    ActionCtx,
    GenericDataModel,
    User['role']
  >;
}

export const createActionResolvers = <
  User extends ConvexLibUser,
  ActionCtx extends ActionContextWithRunQuery = ActionContextWithRunQuery,
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
  UserRef extends QueryRef<Record<string, unknown>, User> = QueryRef<
    Record<string, unknown>,
    User
  >,
  CapabilityOverrideRef extends QueryRef<
    Record<string, unknown>,
    CapabilityOverride | null
  > = QueryRef<Record<string, unknown>, CapabilityOverride | null>,
  PermissionRef extends QueryRef<
    Record<string, unknown>,
    PermissionEntry | null
  > = QueryRef<Record<string, unknown>, PermissionEntry | null>,
>(
  config: CreateActionResolversConfig<
    User,
    ActionCtx,
    TRegistry,
    UserRef,
    CapabilityOverrideRef,
    PermissionRef
  >,
): ActionRuntimeResolvers<User, ActionCtx, TRegistry> => {
  const directResolveUser = config.resolveUser;
  const resolveUser = directResolveUser
    ? async (ctx: ActionCtx) => directResolveUser(ctx)
    : async (ctx: ActionCtx) => {
        if (!config.getUserRef) {
          throw new Error(
            'createActionResolvers requires either `resolveUser` or `getUserRef`.',
          );
        }

        return runQueryRef(
          ctx,
          config.getUserRef,
          await config.getUserArgs?.(ctx),
        );
      };

  const capabilityChecker =
    config.registry && config.getCapabilityOverrideRef
      ? (() => {
          const capabilityOverrideRef = config.getCapabilityOverrideRef;

          return createCapabilityChecker<ActionCtx, TRegistry, User['role']>({
            registry: config.registry,
            adminRoles: config.adminRoles,
            getOverride: async (ctx, key) =>
              runQueryRef(
                ctx,
                capabilityOverrideRef,
                await config.getCapabilityOverrideArgs?.(ctx, key),
              ),
          });
        })()
      : undefined;

  const permissionChecker = config.getPermissionRef
    ? (() => {
        const permissionRef = config.getPermissionRef;

        return createPermissionChecker<
          ActionCtx,
          GenericDataModel,
          User['role']
        >({
          adminRoles: config.adminRoles,
          defaultAllow: config.defaultAllow,
          getDocument: async () => null,
          getPermission: async (ctx, role, resource) =>
            runQueryRef(
              ctx,
              permissionRef,
              await config.getPermissionArgs?.(ctx, role, resource),
            ),
        });
      })()
    : undefined;

  return {
    resolveUser,
    capabilityChecker,
    permissionChecker,
  };
};
