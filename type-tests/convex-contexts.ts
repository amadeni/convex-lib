import {
  actionGeneric,
  makeFunctionReference,
  mutationGeneric,
  queryGeneric,
} from 'convex/server';
import type {
  ActionBuilder,
  FunctionReference,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  QueryBuilder,
} from 'convex/server';
import type { GenericId } from 'convex/values';
import {
  createActionResolvers,
  createAuthorized,
  createCapabilityChecker,
  createConvexLib,
  createError,
  createPermissionChecker,
  createPermissionCheckerFromCapabilities,
  createPrimitives,
} from '../src';

type AppDataModel = {
  users: {
    document: {
      _id: GenericId<'users'>;
      _creationTime: number;
      email: string;
      role?: 'admin' | 'member';
    };
    fieldPaths: '_id' | '_creationTime' | 'email' | 'role';
    indexes: {
      by_email: ['email'];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  posts: {
    document: {
      _id: GenericId<'posts'>;
      _creationTime: number;
      authorId: GenericId<'users'>;
      createdBy: GenericId<'users'>;
      title: string;
    };
    fieldPaths: '_id' | '_creationTime' | 'authorId' | 'createdBy' | 'title';
    indexes: {
      by_authorId: ['authorId'];
      by_createdBy: ['createdBy'];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
  capabilityOverrides: {
    document: {
      _id: GenericId<'capabilityOverrides'>;
      _creationTime: number;
      key: string;
      roles: string[];
    };
    fieldPaths: '_id' | '_creationTime' | 'key' | 'roles';
    indexes: {
      by_key: ['key'];
    };
    searchIndexes: {};
    vectorIndexes: {};
  };
};

type AppUser = AppDataModel['users']['document'];
type AppQueryCtx = GenericQueryCtx<AppDataModel>;
type AppMutationCtx = GenericMutationCtx<AppDataModel>;
type AppActionCtx = GenericActionCtx<AppDataModel>;

const query = queryGeneric as QueryBuilder<AppDataModel, 'public'>;
const mutation = mutationGeneric as MutationBuilder<AppDataModel, 'public'>;
const action = actionGeneric as ActionBuilder<AppDataModel, 'public'>;

const acceptQueryCtx = (_ctx: AppQueryCtx) => undefined;
const acceptMutationCtx = (_ctx: AppMutationCtx) => undefined;
const acceptActionCtx = (_ctx: AppActionCtx) => undefined;

const resolveUser = async (
  ctx: AppQueryCtx | AppMutationCtx,
): Promise<AppUser> => {
  const user = await ctx.db
    .query('users')
    .withIndex('by_email', q => q.eq('email', 'admin@example.com'))
    .unique();

  if (!user) {
    throw createError.notFound('users');
  }

  return user;
};

const resolveUserAction = async (_ctx: AppActionCtx): Promise<AppUser> => ({
  _id: 'users_1' as GenericId<'users'>,
  _creationTime: 0,
  email: 'admin@example.com',
  role: 'admin',
});

const capabilityRegistry = {
  'invoice.manage': {
    label: 'Manage invoices',
    category: 'billing',
    defaultRoles: ['admin'] as const,
    grants: {
      posts: {
        read: true as const,
        update: true as const,
      },
    },
  },
};

const capabilityChecker = createCapabilityChecker<
  AppQueryCtx | AppMutationCtx,
  typeof capabilityRegistry,
  AppUser['role']
>({
  registry: capabilityRegistry,
  getOverride: async (ctx, key) => {
    return await ctx.db
      .query('capabilityOverrides')
      .withIndex('by_key', q => q.eq('key', key))
      .first();
  },
});

const capabilityCheckerAction = createCapabilityChecker<
  AppActionCtx,
  typeof capabilityRegistry,
  AppUser['role']
>({
  registry: capabilityRegistry,
  getOverride: async () => null,
});

const permissionChecker = createPermissionChecker<
  AppQueryCtx | AppMutationCtx,
  AppDataModel,
  AppUser['role']
>({
  getPermission: async () => ({
    role: 'admin',
    resource: 'posts',
    read: true,
    update: true,
  }),
  getDocument: async (ctx, _table, id) => await ctx.db.get(id),
});

const permissionCheckerAction = createPermissionChecker<
  AppActionCtx,
  AppDataModel,
  AppUser['role']
>({
  getPermission: async () => ({
    role: 'admin',
    resource: 'posts',
    read: true,
    update: true,
  }),
  getDocument: async () => null,
});

const permissionCheckerFromCapabilities =
  createPermissionCheckerFromCapabilities<
    AppQueryCtx | AppMutationCtx,
    AppDataModel,
    typeof capabilityRegistry,
    AppUser['role']
  >({
    registry: capabilityRegistry,
    getOverride: async (ctx, key) => {
      return await ctx.db
        .query('capabilityOverrides')
        .withIndex('by_key', q => q.eq('key', key))
        .first();
    },
    getDocument: async (ctx, _table, id) => await ctx.db.get(id),
  });

const primitives = createPrimitives({
  query,
  mutation,
  action,
  resolveUser,
  resolveUserAction,
  isAdmin: user => user.role === 'admin',
  capabilityChecker,
  capabilityCheckerAction,
});

primitives.authQuery({
  args: {},
  handler: async ctx => {
    acceptQueryCtx(ctx);

    const post = await ctx.db
      .query('posts')
      .withIndex('by_authorId', q => q.eq('authorId', ctx.userId))
      .first();

    const title: string | undefined = post?.title;
    return { title, email: ctx.user.email, role: ctx.role };
  },
});

primitives.authMutation({
  args: {},
  handler: async ctx => {
    acceptMutationCtx(ctx);

    const post = await ctx.db
      .query('posts')
      .withIndex('by_authorId', q => q.eq('authorId', ctx.userId))
      .first();

    if (post) {
      await ctx.db.patch(post._id, { title: 'Updated title' });
    }

    return ctx.userId;
  },
});

primitives.authAction({
  args: {},
  handler: async ctx => {
    acceptActionCtx(ctx);
    void ctx.runQuery;
    void ctx.runMutation;
    void ctx.storage;
    return ctx.userId;
  },
});

primitives.capabilityQuery('invoice.manage')({
  args: {},
  handler: async ctx => {
    acceptQueryCtx(ctx);
    return ctx.user.email;
  },
});

const authorized = createAuthorized({
  query,
  mutation,
  action,
  resolveUser,
  resolveUserAction,
  isAdmin: user => user.role === 'admin',
  permissionChecker,
  permissionCheckerAction,
});

authorized.authorizedQuery('posts')({
  args: {},
  handler: async ctx => {
    acceptQueryCtx(ctx);

    const ownedPosts = await ctx.ownedQuery('posts');
    const firstPost = await ownedPosts
      .withIndex('by_authorId', q => q.eq('authorId', ctx.userId))
      .first();

    const ownedDoc = await ctx.ownedDoc(
      'posts',
      'posts_1' as GenericId<'posts'>,
    );

    return { firstPost, ownedDoc };
  },
});

authorized.authorizedMutation(
  'posts',
  'update',
)({
  args: {},
  handler: async ctx => {
    acceptMutationCtx(ctx);

    await ctx.ownedMutation.patch('posts', 'posts_1' as GenericId<'posts'>, {
      title: 'Updated title',
    });

    return ctx.userId;
  },
});

authorized.authorizedAction('posts')({
  args: {},
  handler: async ctx => {
    acceptActionCtx(ctx);
    void ctx.runQuery;
    return ctx.userId;
  },
});

const actionRuntime = createActionResolvers<
  AppActionCtx,
  AppUser,
  AppDataModel,
  typeof capabilityRegistry
>({
  registry: capabilityRegistry,
  getUserRef: makeFunctionReference<'query', { email: string }, AppUser>(
    'internal.users.getByEmail',
  ) as FunctionReference<'query', 'public', { email: string }, AppUser>,
  getUserArgs: () => ({ email: 'admin@example.com' }),
  getCapabilityOverrideRef: makeFunctionReference<
    'query',
    { key: string },
    { key: string; roles: string[] } | null
  >('internal.capabilities.getOverride') as FunctionReference<
    'query',
    'public',
    { key: string },
    { key: string; roles: string[] } | null
  >,
  getCapabilityOverrideArgs: (_ctx, key) => ({ key }),
  getPermissionRef: makeFunctionReference<
    'query',
    { role: AppUser['role']; resource: string },
    { role: string; resource: string; read?: boolean; update?: boolean } | null
  >('internal.permissions.getEntry') as FunctionReference<
    'query',
    'public',
    { role: AppUser['role']; resource: string },
    { role: string; resource: string; read?: boolean; update?: boolean } | null
  >,
  getPermissionArgs: (_ctx, role, resource) => ({ role, resource }),
});

const {
  authQuery: composedAuthQuery,
  authorizedQuery: composedAuthorizedQuery,
  capabilityQuery: composedCapabilityQuery,
} = createConvexLib({
  query,
  mutation,
  action,
  isAdmin: user => user.role === 'admin',
  runtime: {
    query: {
      resolveUser,
      capabilityChecker,
      permissionChecker: permissionCheckerFromCapabilities,
    },
    mutation: {
      resolveUser,
      capabilityChecker,
      permissionChecker: permissionCheckerFromCapabilities,
    },
    action: actionRuntime,
  },
});

composedAuthQuery({
  args: {},
  handler: async ctx => {
    acceptQueryCtx(ctx);
    return ctx.userId;
  },
});

composedAuthorizedQuery('posts')({
  args: {},
  handler: async ctx => {
    acceptQueryCtx(ctx);
    const ownedPosts = await ctx.ownedQuery('posts');
    return ownedPosts.first();
  },
});

composedCapabilityQuery('invoice.manage')({
  args: {},
  handler: async ctx => {
    acceptQueryCtx(ctx);
    return ctx.user.email;
  },
});
