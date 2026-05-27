import { createNeonAuth } from "@neondatabase/auth/next/server";
import { cache } from "react";
import { ensureUserProfile } from "./db/user-profile";
import { User } from "./types";




export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  }
});

export const getCurrentUserId = cache(async (): Promise<string | undefined> => {
  const { data: session } = await auth.getSession();
  return session?.user.id;
});

export const getSessionUser = cache(async (): Promise<User | null> => {
  const { data: session } = await auth.getSession();
  if (!session?.user) return null;
  return ensureUserProfile(session.user);
})