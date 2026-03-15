import type { FunctionVisibility, GenericDataModel } from 'convex/server';
import type { CapabilityRegistry } from './capabilities';
import {
  createAuthorized,
  type AuthorizedConfig,
  type AuthorizedPrimitives,
} from './authorized';
import {
  createPrimitives,
  type CapabilityPrimitives,
  type CapabilityPrimitivesConfig,
  type ConvexLibPrimitives,
} from './primitives';
import type { ConvexLibUser } from './types';

export type CreateConvexLibConfig<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
> = Omit<
  AuthorizedConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility
  >,
  'runtime'
> &
  Omit<
    CapabilityPrimitivesConfig<
      User,
      DataModel,
      QueryVisibility,
      MutationVisibility,
      ActionVisibility,
      TRegistry
    >,
    'runtime'
  > & {
    runtime?: AuthorizedConfig<
      User,
      DataModel,
      QueryVisibility,
      MutationVisibility,
      ActionVisibility
    >['runtime'] &
      CapabilityPrimitivesConfig<
        User,
        DataModel,
        QueryVisibility,
        MutationVisibility,
        ActionVisibility,
        TRegistry
      >['runtime'];
  };

const missingCapabilityMethods = () => {
  throw new Error(
    'Capability primitives were requested from createConvexLib without a configured capability checker.',
  );
};

export type ConvexLibComposerResult<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
> = ConvexLibPrimitives<
  User,
  DataModel,
  QueryVisibility,
  MutationVisibility,
  ActionVisibility
> &
  AuthorizedPrimitives<
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

export const createConvexLib = <
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
>(
  config: CreateConvexLibConfig<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility,
    TRegistry
  >,
): ConvexLibComposerResult<
  User,
  DataModel,
  QueryVisibility,
  MutationVisibility,
  ActionVisibility,
  TRegistry
> => {
  const primitives = createPrimitives(config) as Partial<
    ConvexLibComposerResult<
      User,
      DataModel,
      QueryVisibility,
      MutationVisibility,
      ActionVisibility,
      TRegistry
    >
  >;
  const authorized = createAuthorized(config);

  return {
    ...primitives,
    ...authorized,
    capabilityQuery: primitives.capabilityQuery ?? missingCapabilityMethods,
    capabilityMutation:
      primitives.capabilityMutation ?? missingCapabilityMethods,
    capabilityAction: primitives.capabilityAction ?? missingCapabilityMethods,
  } as ConvexLibComposerResult<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility,
    TRegistry
  >;
};
