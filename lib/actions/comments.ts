"use server"

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "../auth";
import { getUserVote } from "../db/queries";
import { Comment } from "../types"
import { prisma } from "../prisma";

export async function voteCommentAction(commentId: string, value: -1 | 1) {
  const userId = await getCurrentUserId();                                    // Obtengo el id del usuario actual, tratamos de validarlo.
  if (!userId) {
    return { error: "Sign in to vote." };                                     // Si no hay usuario, devuelvo un error
  }
  const row = await findCommentById(commentId);                               // Obtengo el comentario por id
  if (!row) return { error: "Comment not found." };                           // Si no existe el comentario, devuelvo un error
  await voteComment(userId, commentId, value);                                // Llamo a la función voteComment para votar el comentario
  revalidatePath(`/post/${row.postId}`);                                      // Revalido el path de la ruta del post
  revalidatePath("/");                                                        // Revalido el path de la ruta principal
}

export async function voteComment(
  userId: string,
  commentId: string,
  value: -1 | 1,
): Promise<void> {
  const current = await getUserVote(userId, "comment", commentId);           // Obtengo el voto actual del usuario en el comentario
  let next: -1 | 0 | 1 = value;                                              // defino el voto siguiente con el argumento de la función
  if (current === value) next = 0;                                           // si el voto actual es igual al siguiente, se pone en 0 (se elimina el voto)
  await prisma.vote.deleteMany({                                             // Borro el voto actual del usuario en el comentario. Antes de insertar el nuevo voto elimina cualquier voto existente.
    where: {
      userId,
      targetType: "comment",
      targetId: commentId,
    },
  });
  if (next !== 0) {                                                           // Si el voto siguiente no es 0, lo inserto en la tabla vote.
    await prisma.vote.create({
      data: {
        userId,
        targetType: "comment",
        targetId: commentId,
        value: next,
      },
    });
  }
}

export async function findCommentById(
  id: string,
): Promise<Comment | undefined> {
  const c = await prisma.comment.findUnique({ where: { id } });               // Obtengo el comentario por id
  if (!c) return undefined;                                                   // Si no existe el comentario, devuelvo undefined
  return {                                                                    // Devuelvo el comentario con el formato adecuado.
    id: c.id,
    postId: c.postId,
    authorId: c.authorId,
    parentId: c.parentId,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
  };
}
