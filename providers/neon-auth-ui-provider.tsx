"use client"

import { createAuthClient } from "@neondatabase/auth/next"
import { NeonAuthUIProvider } from "@neondatabase/auth/react"


const authClient = createAuthClient();

export default function NeonAuthProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NeonAuthUIProvider authClient={authClient} defaultTheme="dark">
      {children}
    </NeonAuthUIProvider>
  );
}