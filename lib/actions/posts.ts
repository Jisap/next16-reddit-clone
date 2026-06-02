"use server"

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "../auth";
import { getUserVote } from "../db/queries";
import { prisma } from "../prisma";
import { redirect } from "next/navigation";
import { Post } from "../types";
import { PostModel } from "../generated/prisma/models";



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

function mapPostRow(
  row: PostModel,
  tagSlugs: string[],
  commentCount: number,
): Post {
  return {
    id: row.id,
    authorId: row.authorId,
    title: row.title,
    body: row.body,
    tagSlugs,
    createdAt: row.createdAt.toISOString(),
    commentCount,
  };
}

export async function addPost(input: {
  authorId: string;
  title: string;
  body: string;
  tagSlugs: string[];
}): Promise<Post> {

  const tagSlugs = input.tagSlugs.length ? input.tagSlugs : ["webdev"];     // Si no hay etiquetas, se le asigna la etiqueta "webdev"

  await prisma.tag.createMany({                                             // Se crean las etiquetas
    data: tagSlugs.map((slug) => ({
      slug,
      label: slug,
      hashColor: "#ff00fb",
    })),
    skipDuplicates: true,
  });

  const row = await prisma.post.create({                                     // Se crea el post
    data: {
      authorId: input.authorId,
      title: input.title.trim(),
      body: input.body.trim(),
    },
  });

  await prisma.postTag.createMany({                                          // Se crean las etiquetas del post
    data: tagSlugs.map((slug) => ({
      postId: row.id,
      tagSlug: slug,
    })),
  });

  return mapPostRow(row, tagSlugs, 0);                                       // Devuelve el post creado
}

export type PostFormState = { error?: string } | null;

export async function createPostAction(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {

  const userId = await getCurrentUserId();                                   // Obtengo el id del usuario actual
  if (!userId) {
    return { error: "You must be signed in to post." };                      // Si no hay usuario, devuelvo un error
  }

  const title = String(formData.get("title") ?? "");                         // Obtengo el título del post
  const body = String(formData.get("body") ?? "");                           // Obtengo el cuerpo del post
  const tagsRaw = String(formData.get("tags") ?? "");                        // Obtengo las etiquetas del post

  if (title.trim().length < 4) {                                             // Si el título es menor a 4 caracteres, devuelvo un error
    return { error: "Title is too short." };
  }

  const tagSlugs = tagsRaw                                                   // Obtengo las etiquetas del post
    .split(/[,#\s]+/)
    .map((s) => s.trim().toLowerCase())
    .slice(0, 5);

  const post = await addPost({                                              // Añado el post
    authorId: userId,
    title,
    body,
    tagSlugs,
  });

  revalidatePath("/");                                                       // Revalido el path de la ruta principal
  revalidatePath("/submit");                                                 // Revalido el path de la ruta de submit
  redirect(`/post/${post.id}`);                                              // Redirijo al post creado
}