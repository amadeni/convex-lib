import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from 'convex-helpers/server/customFunctions';
import type { CustomBuilder } from 'convex-helpers/server/customFunctions';
import type {
  FunctionVisibility,
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from 'convex/server';
import type {
  CapabilityChecker,
  CapabilityKey,
  CapabilityRegistry,
} from './capabilities';
import { createError } from './errors';
import {
  getActionUserResolver,
  getBuilders,
  getMutationUserResolver,
  getQueryUserResolver,
} from './runtime';
import type { AuthContext, ConvexLibConfig, ConvexLibUser } from './types';

export type { ConvexLibConfig, ConvexLibUser } from './types';

type EmptyObject = Record<string, never>;

type QueryPrimitiveBuilder<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
> = CustomBuilder<
  'query',
  EmptyObject,
  AuthContext<User>,
  EmptyObject,
  GenericQueryCtx<DataModel>,
  Visibility,
  object
>;

type MutationPrimitiveBuilder<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
> = CustomBuilder<
  'mutation',
  EmptyObject,
  AuthContext<User>,
  EmptyObject,
  GenericMutationCtx<DataModel>,
  Visibility,
  object
>;

type ActionPrimitiveBuilder<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
> = CustomBuilder<
  'action',
  EmptyObject,
  AuthContext<User>,
  EmptyObject,
  GenericActionCtx<DataModel>,
  Visibility,
  object
>;

export interface ConvexLibPrimitives<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
> {
  authQuery: QueryPrimitiveBuilder<User, DataModel, QueryVisibility>;
  authMutation: MutationPrimitiveBuilder<User, DataModel, MutationVisibility>;
  authAction: ActionPrimitiveBuilder<User, DataModel, ActionVisibility>;
  adminQuery: QueryPrimitiveBuilder<User, DataModel, QueryVisibility>;
  adminMutation: MutationPrimitiveBuilder<User, DataModel, MutationVisibility>;
  adminAction: ActionPrimitiveBuilder<User, DataModel, ActionVisibility>;
}

export interface CapabilityPrimitives<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
> {
  capabilityQuery: (
    key: CapabilityKey<TRegistry>,
  ) => QueryPrimitiveBuilder<User, DataModel, QueryVisibility>;
  capabilityMutation: (
    key: CapabilityKey<TRegistry>,
  ) => MutationPrimitiveBuilder<User, DataModel, MutationVisibility>;
  capabilityAction: (
    key: CapabilityKey<TRegistry>,
  ) => ActionPrimitiveBuilder<User, DataModel, ActionVisibility>;
}

export interface CapabilityPrimitivesConfig<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
> extends ConvexLibConfig<
  User,
  DataModel,
  QueryVisibility,
  MutationVisibility,
  ActionVisibility
> {
  runtime?: ConvexLibConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >['runtime'] & {
    query?: NonNullable<
      ConvexLibConfig<
        User,
        DataModel,
        QueryVisibility,
        MutationVisibility,
        ActionVisibility
      >['runtime']
    >['query'] & {
      capabilityChecker?: CapabilityChecker<
        GenericQueryCtx<DataModel>,
        TRegistry,
        User['role']
      >;
    };
    mutation?: NonNullable<
      ConvexLibConfig<
        User,
        DataModel,
        QueryVisibility,
        MutationVisibility,
        ActionVisibility
      >['runtime']
    >['mutation'] & {
      capabilityChecker?: CapabilityChecker<
        GenericMutationCtx<DataModel>,
        TRegistry,
        User['role']
      >;
    };
    action?: NonNullable<
      ConvexLibConfig<
        User,
        DataModel,
        QueryVisibility,
        MutationVisibility,
        ActionVisibility
      >['runtime']
    >['action'] & {
      capabilityChecker?: CapabilityChecker<
        GenericActionCtx<DataModel>,
        TRegistry,
        User['role']
      >;
    };
  };
  capabilityChecker?: CapabilityChecker<
    | GenericQueryCtx<DataModel>
    | GenericMutationCtx<DataModel>
    | GenericActionCtx<DataModel>,
    TRegistry,
    User['role']
  >;
  capabilityCheckerQuery?: CapabilityChecker<
    GenericQueryCtx<DataModel>,
    TRegistry,
    User['role']
  >;
  capabilityCheckerMutation?: CapabilityChecker<
    GenericMutationCtx<DataModel>,
    TRegistry,
    User['role']
  >;
  capabilityCheckerAction?: CapabilityChecker<
    GenericActionCtx<DataModel>,
    TRegistry,
    User['role']
  >;
}

const toAuthContext = <User extends ConvexLibUser>(
  user: User,
): AuthContext<User> => ({
  user,
  userId: user._id,
  role: user.role,
});

const resolveQueryAuthContext = async <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
>(
  ctx: GenericQueryCtx<DataModel>,
  config: ConvexLibConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >,
) => toAuthContext(await getQueryUserResolver(config)(ctx));

const resolveMutationAuthContext = async <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
>(
  ctx: GenericMutationCtx<DataModel>,
  config: ConvexLibConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >,
) => toAuthContext(await getMutationUserResolver(config)(ctx));

const resolveActionAuthContext = async <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
>(
  ctx: GenericActionCtx<DataModel>,
  config: ConvexLibConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >,
) => toAuthContext(await getActionUserResolver(config)(ctx));

const assertAdmin = <User extends ConvexLibUser>(
  auth: AuthContext<User>,
  isAdmin: (user: User) => boolean,
) => {
  if (!isAdmin(auth.user)) {
    throw createError.forbidden('Admin access required');
  }

  return auth;
};

const missingCapabilityCheckerMessage = (
  runtime: 'query' | 'mutation' | 'action',
) =>
  `No capability checker configured for ${runtime}. Provide ${
    runtime === 'query'
      ? '`runtime.query.capabilityChecker` or `capabilityChecker`'
      : runtime === 'mutation'
        ? '`runtime.mutation.capabilityChecker` or `capabilityChecker`'
        : '`runtime.action.capabilityChecker`, `capabilityCheckerAction`, or `capabilityChecker`'
  }.`;

const getCapabilityCheckerForQuery = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
  TRegistry extends CapabilityRegistry,
>(
  config: CapabilityPrimitivesConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility,
    TRegistry
  >,
) =>
  (() => {
    const checker =
      config.runtime?.query?.capabilityChecker ??
      config.capabilityCheckerQuery ??
      config.capabilityChecker;

    if (!checker) {
      throw new Error(missingCapabilityCheckerMessage('query'));
    }

    return checker as CapabilityChecker<
      GenericQueryCtx<DataModel>,
      TRegistry,
      User['role']
    >;
  })();

const getCapabilityCheckerForMutation = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
  TRegistry extends CapabilityRegistry,
>(
  config: CapabilityPrimitivesConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility,
    TRegistry
  >,
) =>
  (() => {
    const checker =
      config.runtime?.mutation?.capabilityChecker ??
      config.capabilityCheckerMutation ??
      config.capabilityChecker;

    if (!checker) {
      throw new Error(missingCapabilityCheckerMessage('mutation'));
    }

    return checker as CapabilityChecker<
      GenericMutationCtx<DataModel>,
      TRegistry,
      User['role']
    >;
  })();

const getCapabilityCheckerForAction = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
  TRegistry extends CapabilityRegistry,
>(
  config: CapabilityPrimitivesConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility,
    TRegistry
  >,
) =>
  (() => {
    const checker =
      config.runtime?.action?.capabilityChecker ??
      config.capabilityCheckerAction ??
      config.capabilityChecker;

    if (!checker) {
      throw new Error(missingCapabilityCheckerMessage('action'));
    }

    return checker as CapabilityChecker<
      GenericActionCtx<DataModel>,
      TRegistry,
      User['role']
    >;
  })();

const hasCapabilityChecker = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
  TRegistry extends CapabilityRegistry,
>(
  config:
    | ConvexLibConfig<
        User,
        DataModel,
        QueryVisibility,
        MutationVisibility,
        ActionVisibility
      >
    | CapabilityPrimitivesConfig<
        User,
        DataModel,
        QueryVisibility,
        MutationVisibility,
        ActionVisibility,
        TRegistry
      >,
): config is CapabilityPrimitivesConfig<
  User,
  DataModel,
  QueryVisibility,
  MutationVisibility,
  ActionVisibility,
  TRegistry
> =>
  (() => {
    const capabilityConfig = config as Partial<
      CapabilityPrimitivesConfig<
        User,
        DataModel,
        QueryVisibility,
        MutationVisibility,
        ActionVisibility,
        TRegistry
      >
    >;

    return (
      capabilityConfig.capabilityChecker !== undefined ||
      capabilityConfig.capabilityCheckerQuery !== undefined ||
      capabilityConfig.capabilityCheckerMutation !== undefined ||
      capabilityConfig.capabilityCheckerAction !== undefined ||
      capabilityConfig.runtime?.query?.capabilityChecker !== undefined ||
      capabilityConfig.runtime?.mutation?.capabilityChecker !== undefined ||
      capabilityConfig.runtime?.action?.capabilityChecker !== undefined
    );
  })();

export function createPrimitives<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
>(
  config: ConvexLibConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >,
): ConvexLibPrimitives<
  User,
  DataModel,
  QueryVisibility,
  MutationVisibility,
  ActionVisibility
>;
export function createPrimitives<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
>(
  config: CapabilityPrimitivesConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility,
    TRegistry
  >,
): ConvexLibPrimitives<
  User,
  DataModel,
  QueryVisibility,
  MutationVisibility,
  ActionVisibility
> &
  CapabilityPrimitives<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility,
    TRegistry
  >;
export function createPrimitives<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
>(
  config:
    | ConvexLibConfig<
        User,
        DataModel,
        QueryVisibility,
        MutationVisibility,
        ActionVisibility
      >
    | CapabilityPrimitivesConfig<
        User,
        DataModel,
        QueryVisibility,
        MutationVisibility,
        ActionVisibility,
        TRegistry
      >,
) {
  const builders = getBuilders(config);

  const authQuery = customQuery(
    builders.query,
    customCtx((ctx: GenericQueryCtx<DataModel>) =>
      resolveQueryAuthContext(ctx, config),
    ),
  );
  const authMutation = customMutation(
    builders.mutation,
    customCtx((ctx: GenericMutationCtx<DataModel>) =>
      resolveMutationAuthContext(ctx, config),
    ),
  );
  const authAction = customAction(
    builders.action,
    customCtx((ctx: GenericActionCtx<DataModel>) =>
      resolveActionAuthContext(ctx, config),
    ),
  );

  const adminQuery = customQuery(
    builders.query,
    customCtx(async (ctx: GenericQueryCtx<DataModel>) =>
      assertAdmin(await resolveQueryAuthContext(ctx, config), config.isAdmin),
    ),
  );
  const adminMutation = customMutation(
    builders.mutation,
    customCtx(async (ctx: GenericMutationCtx<DataModel>) =>
      assertAdmin(
        await resolveMutationAuthContext(ctx, config),
        config.isAdmin,
      ),
    ),
  );
  const adminAction = customAction(
    builders.action,
    customCtx(async (ctx: GenericActionCtx<DataModel>) =>
      assertAdmin(await resolveActionAuthContext(ctx, config), config.isAdmin),
    ),
  );

  const primitives: ConvexLibPrimitives<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  > = {
    authQuery,
    authMutation,
    authAction,
    adminQuery,
    adminMutation,
    adminAction,
  };

  if (!hasCapabilityChecker(config)) {
    return primitives;
  }

  const capabilityQuery = (key: CapabilityKey<TRegistry>) =>
    customQuery(
      builders.query,
      customCtx(async (ctx: GenericQueryCtx<DataModel>) => {
        const auth = await resolveQueryAuthContext(ctx, config);
        const allowed = await getCapabilityCheckerForQuery(config).has(
          ctx,
          auth.role,
          key,
        );

        if (!allowed) {
          throw createError.unauthorized(`User lacks capability ${key}`);
        }

        return auth;
      }),
    );

  const capabilityMutation = (key: CapabilityKey<TRegistry>) =>
    customMutation(
      builders.mutation,
      customCtx(async (ctx: GenericMutationCtx<DataModel>) => {
        const auth = await resolveMutationAuthContext(ctx, config);
        const allowed = await getCapabilityCheckerForMutation(config).has(
          ctx,
          auth.role,
          key,
        );

        if (!allowed) {
          throw createError.unauthorized(`User lacks capability ${key}`);
        }

        return auth;
      }),
    );

  const capabilityAction = (key: CapabilityKey<TRegistry>) =>
    customAction(
      builders.action,
      customCtx(async (ctx: GenericActionCtx<DataModel>) => {
        const auth = await resolveActionAuthContext(ctx, config);
        const allowed = await getCapabilityCheckerForAction(config).has(
          ctx,
          auth.role,
          key,
        );

        if (!allowed) {
          throw createError.unauthorized(`User lacks capability ${key}`);
        }

        return auth;
      }),
    );

  return {
    ...primitives,
    capabilityQuery,
    capabilityMutation,
    capabilityAction,
  };
}

export { queryGeneric as publicQuery } from 'convex/server';
export { mutationGeneric as publicMutation } from 'convex/server';
export { actionGeneric as publicAction } from 'convex/server';
