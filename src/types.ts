// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCtx = Record<string, any>;

export interface ConvexLibUser {
  _id: string;
  email: string;
  role: string;
}

export interface ConvexLibConfig<User extends ConvexLibUser> {
  resolveUser: (ctx: AnyCtx) => Promise<User>;
  isAdmin: (user: User) => boolean;
}
