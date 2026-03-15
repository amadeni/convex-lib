import { actionGeneric, mutationGeneric, queryGeneric } from 'convex/server';
import type {
  ActionBuilder,
  FunctionVisibility,
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  QueryBuilder,
} from 'convex/server';
import type {
  BuilderConfig,
  ConvexLibUser,
  ResolveUser,
  RuntimeUserResolvers,
} from './types';

const defaultQueryBuilder = queryGeneric as QueryBuilder<
  GenericDataModel,
  'public'
>;
const defaultMutationBuilder = mutationGeneric as MutationBuilder<
  GenericDataModel,
  'public'
>;
const defaultActionBuilder = actionGeneric as ActionBuilder<
  GenericDataModel,
  'public'
>;

export const getBuilders = <
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
>(
  config: BuilderConfig<
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >,
) => ({
  query: (config.query ?? defaultQueryBuilder) as QueryBuilder<
    DataModel,
    QueryVisibility
  >,
  mutation: (config.mutation ?? defaultMutationBuilder) as MutationBuilder<
    DataModel,
    MutationVisibility
  >,
  action: (config.action ?? defaultActionBuilder) as ActionBuilder<
    DataModel,
    ActionVisibility
  >,
});

const missingResolverMessage = (runtime: 'query' | 'mutation' | 'action') =>
  `No user resolver configured for ${runtime}. Provide ${
    runtime === 'query'
      ? '`runtime.query.resolveUser`, `resolveUser`, or `resolveUserQuery`'
      : runtime === 'mutation'
        ? '`runtime.mutation.resolveUser`, `resolveUser`, or `resolveUserMutation`'
        : '`runtime.action.resolveUser`, `resolveUserAction`, or an action-compatible `resolveUser`'
  }.`;

export const getQueryUserResolver = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
>(
  config: RuntimeUserResolvers<
    User,
    GenericQueryCtx<DataModel>,
    GenericMutationCtx<DataModel>,
    GenericActionCtx<DataModel>
  >,
): ResolveUser<GenericQueryCtx<DataModel>, User> => {
  const resolver =
    config.runtime?.query?.resolveUser ??
    config.resolveUserQuery ??
    config.resolveUser;
  if (!resolver) {
    throw new Error(missingResolverMessage('query'));
  }

  return resolver as ResolveUser<GenericQueryCtx<DataModel>, User>;
};

export const getMutationUserResolver = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
>(
  config: RuntimeUserResolvers<
    User,
    GenericQueryCtx<DataModel>,
    GenericMutationCtx<DataModel>,
    GenericActionCtx<DataModel>
  >,
): ResolveUser<GenericMutationCtx<DataModel>, User> => {
  const resolver =
    config.runtime?.mutation?.resolveUser ??
    config.resolveUserMutation ??
    config.resolveUser;
  if (!resolver) {
    throw new Error(missingResolverMessage('mutation'));
  }

  return resolver as ResolveUser<GenericMutationCtx<DataModel>, User>;
};

export const getActionUserResolver = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel,
>(
  config: RuntimeUserResolvers<
    User,
    GenericQueryCtx<DataModel>,
    GenericMutationCtx<DataModel>,
    GenericActionCtx<DataModel>
  >,
): ResolveUser<GenericActionCtx<DataModel>, User> => {
  const resolver =
    config.runtime?.action?.resolveUser ??
    config.resolveUserAction ??
    config.resolveUser;
  if (!resolver) {
    throw new Error(missingResolverMessage('action'));
  }

  return resolver as ResolveUser<GenericActionCtx<DataModel>, User>;
};
