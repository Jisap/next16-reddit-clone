"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "../auth";
import { getUserVote } from "../db/queries";
import { prisma } from "../prisma";
import { Comment } from "../types";

// --- LÓGICA CENTRAL UNIFICADA (DRY) ---

type TargetType = "post" | "comment";

export async function voteTarget(
  userId: string,
  targetType: TargetType,
  targetId: string,
  value: -1 | 1
): Promise<void> {
  // 1. Usamos una transacción para garantizar atomicidad
  await prisma.$transaction(async (tx) => {
    const currentVote = await getUserVote(userId, targetType, targetId); // Nota: getUserVote debería aceptar 'tx' si quieres ser estricto

    let next: -1 | 0 | 1 = value;
    if (currentVote === value) next = 0; // Toggle logic

    // Borramos el voto anterior dentro de la transacción
    await tx.vote.deleteMany({
      where: { userId, targetType, targetId },
    });

    // Si el voto no es 0, creamos el nuevo dentro de la transacción
    if (next !== 0) {
      await tx.vote.create({
        data: { userId, targetType, targetId, value: next },
      });
    }
  });
}

// --- SERVER ACTIONS (Puntos de entrada) ---

export async function votePostAction(postId: string, value: -1 | 1) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { error: "Debes iniciar sesión para votar." };

    await voteTarget(userId, "post", postId, value);

    revalidatePath(`/post/${postId}`);
    // revalidatePath("/"); // Descomenta solo si la home muestra estos votos en tiempo real
  } catch (error) {
    console.error("Error voting post:", error);
    return { error: "Ocurrió un error al procesar tu voto." };
  }
}

export async function voteCommentAction(commentId: string, value: -1 | 1) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { error: "Debes iniciar sesión para votar." };

    const comment = await findCommentById(commentId);
    if (!comment) return { error: "Comentario no encontrado." };

    await voteTarget(userId, "comment", commentId, value);

    revalidatePath(`/post/${comment.postId}`);
  } catch (error) {
    console.error("Error voting comment:", error);
    return { error: "Ocurrió un error al procesar tu voto." };
  }
}

// --- HELPERS ---

export async function findCommentById(id: string): Promise<Comment | undefined> {
  const c = await prisma.comment.findUnique({ where: { id } });
  if (!c) return undefined;

  return {
    id: c.id,
    postId: c.postId,
    authorId: c.authorId,
    parentId: c.parentId,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
  };
}