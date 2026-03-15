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

const missingCapabilityPrimitive = <T>(): T =>
  ((..._args: unknown[]) => missingCapabilityMethods()) as T;

export interface ConvexLibComposerResult<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
  TRegistry extends CapabilityRegistry = CapabilityRegistry,
>
  extends
    ConvexLibPrimitives<
      User,
      DataModel,
      QueryVisibility,
      MutationVisibility,
      ActionVisibility
    >,
    AuthorizedPrimitives<
      User,
      DataModel,
      QueryVisibility,
      MutationVisibility,
      ActionVisibility
    >,
    CapabilityPrimitives<
      User,
      DataModel,
      QueryVisibility,
      MutationVisibility,
      ActionVisibility,
      TRegistry
    > {}

export function createConvexLib<
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
> {
  const primitives = createPrimitives(config);
  const authorized = createAuthorized(config);
  const capabilityPrimitives = primitives as Partial<
    CapabilityPrimitives<
      User,
      DataModel,
      QueryVisibility,
      MutationVisibility,
      ActionVisibility,
      TRegistry
    >
  >;
  const capabilityQuery = capabilityPrimitives.capabilityQuery
    ? capabilityPrimitives.capabilityQuery
    : missingCapabilityPrimitive<
        ConvexLibComposerResult<
          User,
          DataModel,
          QueryVisibility,
          MutationVisibility,
          ActionVisibility,
          TRegistry
        >['capabilityQuery']
      >();
  const capabilityMutation = capabilityPrimitives.capabilityMutation
    ? capabilityPrimitives.capabilityMutation
    : missingCapabilityPrimitive<
        ConvexLibComposerResult<
          User,
          DataModel,
          QueryVisibility,
          MutationVisibility,
          ActionVisibility,
          TRegistry
        >['capabilityMutation']
      >();
  const capabilityAction = capabilityPrimitives.capabilityAction
    ? capabilityPrimitives.capabilityAction
    : missingCapabilityPrimitive<
        ConvexLibComposerResult<
          User,
          DataModel,
          QueryVisibility,
          MutationVisibility,
          ActionVisibility,
          TRegistry
        >['capabilityAction']
      >();

  const result: ConvexLibComposerResult<
    User,
    DataModel,
    QueryVisibility,
    MutationVisibility,
    ActionVisibility,
    TRegistry
  > = {
    authQuery: primitives.authQuery,
    authMutation: primitives.authMutation,
    authAction: primitives.authAction,
    adminQuery: primitives.adminQuery,
    adminMutation: primitives.adminMutation,
    adminAction: primitives.adminAction,
    capabilityQuery,
    capabilityMutation,
    capabilityAction,
    authorizedQuery: authorized.authorizedQuery,
    authorizedMutation: authorized.authorizedMutation,
    authorizedAction: authorized.authorizedAction,
  };

  return result;
}
