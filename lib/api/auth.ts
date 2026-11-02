import {
  currentUserSchema,
  type CurrentUser,
} from "@/lib/api/auth-schemas";
import { getJson } from "@/lib/api/client";

export {
  accessTokenResponseSchema,
  currentUserSchema,
  loginInputSchema,
} from "@/lib/api/auth-schemas";
export type {
  AccessTokenResponse,
  CurrentUser,
  LoginInput,
} from "@/lib/api/auth-schemas";

export function getCurrentUser(): Promise<CurrentUser> {
  return getJson("auth/me", currentUserSchema);
}
