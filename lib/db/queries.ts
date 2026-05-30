import { PostModel } from "../generated/prisma/models";
import { prisma } from "../prisma";
import { FeedSort, Post } from "../types";

export type FeedPostRow = {
  post: Post;
  score: number;
  userVote: -1 | 0 | 1;
}

export async function listPostsSorted(
  sort: FeedSort,
  tagFilter: string | undefined,
  userId: string | undefined
) {

  const where = tagFilter
    ? { postTags: { some: { tagSlug: tagFilter.toLowerCase() } } }
    : undefined

  const postRows = await prisma.post.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  const ids = postRows.map(p => p.id);
  if (ids.length === 0) return [];

  const [tagMap] = await Promise.all([tagsForPosts(ids)]);

  const mapped = postRows.map((row) => {
    const slugs = tagMap.get(row.id) ?? [];
    return {
      post: mapPostRow(
        row,
        slugs,
        65
      ),
      voteScore: 2,
      created: row.createdAt.getTime(),
      userVote: 1,
    }
  });

  if (sort === "new") {
    mapped.sort((a, b) => b.created - a.created)
  } else if (sort === "top") {
    mapped.sort(
      (a, b) =>
        b.voteScore - a.voteScore ||
        b.post.commentCount - a.post.commentCount ||
        b.created - a.created
    )
  } else {
    mapped.sort((a, b) => {
      const hotB = b.voteScore + 2 * b.post.commentCount;
      const hotA = a.voteScore + 2 * a.post.commentCount;
      return hotB - hotA || b.created - a.created
    })
  }

  return mapped.map((x) => ({
    post: x.post,
    score: x.voteScore,
    userVote: x.userVote
  }))
}

function mapPostRow(
  row: PostModel,
  tagSlugs: string[],
  commentCount: number
): Post {
  return {
    id: row.id,
    authorId: row.authorId,
    title: row.title,
    body: row.body,
    tagSlugs,
    createdAt: row.createdAt.toISOString(),
    commentCount,
  }
}

/**
 * 
 * @param postIds - IDs de los posts para los que se quieren obtener los tags
 * @returns Map<postId, tagSlug[]> - Un mapa que asocia cada ID de post con un array de sus tags.
 * 
 * Su objetivo es, dado un listado de IDs de posts (postIds), 
 * buscar todos los tags asociados a esos posts y devolverlos de forma organizada
 */

async function tagsForPosts(postIds: string[]): Promise<Map<string, string[]>> {
  const m = new Map<string, string[]>();            // Se inicializa un Map vacio para almacenar los tags.
  if (postIds.length === 0) return m;               // Si no hay IDs de posts, se devuelve el mapa vacío.

  const rows = await prisma.postTag.findMany({      // Se obtienen todos los registros de la tabla post_tags (combinación postId + tagSlug)
    where: { postId: { in: postIds } }              // que correspondan a los IDs de posts proporcionados.
  })

  for (const pid of postIds) m.set(pid, []);        // Se inicializa una entrada en el mapa m, para cada ID de post { "post1" => [], "post2" => [], "post3" => []}.

  for (const r of rows) {                           // Se recorren todos los registros r, obtenidos de postTag.
    const list = m.get(r.postId);                   // Para cada r se obtiene el array vacio de tags.
    if (list) {                                     // Si existe el array de tags,
      list.push(r.tagSlug);                         // se añade el tag actual al array.
      m.set(r.postId, list);                        // y se actualiza el mapa.
    }
  }
  return m;
}
