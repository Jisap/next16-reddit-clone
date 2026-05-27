import { createNeonAuth } from "@neondatabase/auth/next/server";
import { cache } from "react";




export const auth = createNeonAuth({
  baseUrl: process.env.NEXTAUTH_URL!,
  cookies: {
    secret: process.env.NEXTAUTH_SECRET!,
  }
});

export const getCurrentUserId = cache(async (): Promise<string | undefined> => {
  const { data: session } = await auth.getSession();
  return session?.user.id;
});