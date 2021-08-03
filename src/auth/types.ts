import { ValueType } from "ioredis";
import { PlatformName } from "../graphql/graphql.gen";

export interface AuthState {
  token: string;
  userId: string;
  provider: PlatformName;
  oauthId: string;
  accessTokenPromise: Promise<string | null>;
}

export interface RedisAuthHash extends Record<string, ValueType> {
  userId: string;
  provider: PlatformName;
  accessToken: string;
  refreshToken: string;
  oauthId: string;
}
