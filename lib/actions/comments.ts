"use server"

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "../auth";
import { getUserVote } from "../db/queries";
import { Comment } from "../types"
import { prisma } from "../prisma";

export async function voteCommentAction(commentId: string, value: -1 | 1) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Sign in to vote." };
  }
  const row = await findCommentById(commentId);
  if (!row) return { error: "Comment not found." };
  await voteComment(userId, commentId, value);
  revalidatePath(`/post/${row.postId}`);
  revalidatePath("/");
}

export async function voteComment(
  userId: string,
  commentId: string,
  value: -1 | 1,
): Promise<void> {
  const current = await getUserVote(userId, "comment", commentId);
  let next: -1 | 0 | 1 = value;
  if (current === value) next = 0;
  await prisma.vote.deleteMany({
    where: {
      userId,
      targetType: "comment",
      targetId: commentId,
    },
  });
  if (next !== 0) {
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
