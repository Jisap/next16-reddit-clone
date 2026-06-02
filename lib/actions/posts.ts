"use server"

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "../auth";
import { getUserVote } from "../db/queries";
import { prisma } from "../prisma";



export async function votePostAction(postId: string, value: -1 | 1) {
  const userId = await getCurrentUserId();                     // Obtengo el id del usuario actual, tratamos de validarlo.
  if (!userId) {
    return { error: "Sign in to vote." };                      // Si no hay usuario, devuelvo un error
  }

  await votePost(userId, postId, value);                       // Llamo a la función votePost para votar el post
  revalidatePath("/");                                         // Revalido el path de la ruta principal para que se actualice la UI
  revalidatePath(`/post/${postId}`);                           // Revalido el path de la ruta del post para que se actualice la UI
}

export async function votePost(
  userId: string,
  postId: string,
  value: -1 | 1,
): Promise<void> {
  const current = await getUserVote(userId, "post", postId);   // obtengo el voto actual del usuario en el post
  let next: -1 | 0 | 1 = value;                                // defino el voto siguiente con el argumento de la función
  if (current === value) next = 0;                             // si el voto actual es igual al siguiente, se pone en 0 (se elimina el voto)

  await prisma.vote.deleteMany({                               // Borro el voto actual del usuario en el post. Antes de insertar el nuevo voto elimina cualquier voto existente.
    where: {
      userId,
      targetType: "post",
      targetId: postId,
    },
  });

  if (next !== 0) {                                            // Si el voto siguiente no es 0, lo inserto en la tabla vote.
    await prisma.vote.create({
      data: {
        userId,
        targetType: "post",
        targetId: postId,
        value: next,
      },
    });
  }
}