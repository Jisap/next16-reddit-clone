import { prisma } from "../prisma";
import { User } from "../types";


function generateUsername(name: string): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 20) || "user";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}_${suffix}`
}


// Sirve como un mecanismo de sincronización automática al iniciar sesión.
// Cuando un usuario se loguea mediante Neon Auth, esta función se ejecuta
// para asegurar que exista su perfil en tu propia base de datos:

export async function ensureUserProfile(neon: {                     // Se le pasa la session del usuario para crear su perfil si no existe en la DB
  id: string;
  name: string;
  image?: string | null;
}): Promise<User> {
  const existing = await prisma.userProfile.findUnique({            // Busca el perfil del usuario por su ID
    where: { id: neon.id }
  })

  if (existing) {                                                   // Si existe, retorna el perfil
    return {
      id: existing.id,
      username: existing.username,
      displayName: neon.name,
      avatarUrl: neon.image ?? undefined
    }
  }

  const row = await prisma.userProfile.create({                      // Si no existe, crea el perfil                 
    data: { id: neon.id, username: generateUsername(neon.name) }
  });

  return {
    id: row.id,
    username: row.username,
    displayName: neon.name,
    avatarUrl: neon.image ?? undefined
  }
}