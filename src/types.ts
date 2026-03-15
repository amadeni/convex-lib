import type {
  ActionBuilder,
  FunctionVisibility,
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  NamedTableInfo,
  QueryBuilder,
  QueryInitializer,
  TableNamesInDataModel,
  DocumentByName,
} from 'convex/server';
import type { GenericId } from 'convex/values';

export type MaybePromise<T> = T | Promise<T>;

export interface ConvexLibUser<
  Role extends string | undefined = string | undefined,
  Id extends string = string,
> {
  _id: Id;
  role?: Role;
  email?: string;
}

export type PatchValue<T> = {
  [Key in keyof T]?: undefined extends T[Key] ? T[Key] | undefined : T[Key];
};

export type AuthContext<User extends ConvexLibUser> = {
  user: User;
  userId: User['_id'];
  role: User['role'];
};

export const toAuthContext = <User extends ConvexLibUser>(
  user: User,
): AuthContext<User> => ({
  user,
  userId: user._id,
  role: user.role,
});

export type OwnedQuery<DataModel extends GenericDataModel> = <
  TableName extends TableNamesInDataModel<DataModel>,
>(
  tableName: TableName,
) => Promise<QueryInitializer<NamedTableInfo<DataModel, TableName>>>;

export type OwnedDoc<DataModel extends GenericDataModel> = <
  TableName extends TableNamesInDataModel<DataModel>,
>(
  tableName: TableName,
  documentId: GenericId<TableName>,
) => Promise<DocumentByName<DataModel, TableName> | null>;

export interface OwnedMutation<DataModel extends GenericDataModel> {
  patch<TableName extends TableNamesInDataModel<DataModel>>(
    tableName: TableName,
    documentId: GenericId<TableName>,
    patch: PatchValue<DocumentByName<DataModel, TableName>>,
  ): Promise<void>;
  delete<TableName extends TableNamesInDataModel<DataModel>>(
    tableName: TableName,
    documentId: GenericId<TableName>,
  ): Promise<void>;
}

export type ResolveUser<Ctx, User extends ConvexLibUser> = (
  ctx: Ctx,
) => MaybePromise<User>;

export interface RuntimeResolverConfigEntry<Ctx, User extends ConvexLibUser> {
  resolveUser?: ResolveUser<Ctx, User>;
}

export interface RuntimeResolverConfig<
  User extends ConvexLibUser,
  QueryCtx,
  MutationCtx,
  ActionCtx,
> {
  query?: RuntimeResolverConfigEntry<QueryCtx, User>;
  mutation?: RuntimeResolverConfigEntry<MutationCtx, User>;
  action?: RuntimeResolverConfigEntry<ActionCtx, User>;
}

export interface RuntimeUserResolvers<
  User extends ConvexLibUser,
  QueryCtx,
  MutationCtx,
  ActionCtx,
> {
  runtime?: RuntimeResolverConfig<User, QueryCtx, MutationCtx, ActionCtx>;
  resolveUser?: ResolveUser<QueryCtx | MutationCtx, User>;
  resolveUserQuery?: ResolveUser<QueryCtx, User>;
  resolveUserMutation?: ResolveUser<MutationCtx, User>;
  resolveUserAction?: ResolveUser<ActionCtx, User>;
}

export interface BuilderConfig<
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
> {
  query?: QueryBuilder<DataModel, QueryVisibility>;
  mutation?: MutationBuilder<DataModel, MutationVisibility>;
  action?: ActionBuilder<DataModel, ActionVisibility>;
}

export interface ConvexLibConfig<
  User extends ConvexLibUser,
  DataModel extends GenericDataModel = GenericDataModel,
  QueryVisibility extends FunctionVisibility = 'public',
  MutationVisibility extends FunctionVisibility = 'public',
  ActionVisibility extends FunctionVisibility = 'public',
>
  extends
    BuilderConfig<
      DataModel,
      QueryVisibility,
      MutationVisibility,
      ActionVisibility
    >,
    RuntimeUserResolvers<
      User,
      GenericQueryCtx<DataModel>,
      GenericMutationCtx<DataModel>,
      GenericActionCtx<DataModel>
    > {
  isAdmin: (user: User) => boolean;
}
