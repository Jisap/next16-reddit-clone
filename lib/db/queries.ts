import { PostModel } from "../generated/prisma/models";
import { prisma } from "../prisma";
import { FeedSort, Post, Tag, User } from "../types";

export type FeedPostRow = {
  post: Post;
  score: number;
  userVote: -1 | 0 | 1;
}

/**
 * 
 * @param authorIds Array de id's únicos de los autores de los posts
 * @returns Map<string, User> - Un mapa que asocia cada ID de post con su autor.
 * 
 * Su objetivo es, dado un listado de IDs de posts (authorIds), 
 * buscar todos los autores asociados a esos posts y devolverlos de forma organizada
 */

export async function batchAuthorForIds(
  authorIds: string[]                                                 // id's únicos de los autores de los posts
): Promise<Map<string, User>> {

  const unique = [...new Set(authorIds)];                             // Se eliminan los duplicados
  if (unique.length === 0) return new Map();                          // Si no hay IDs de posts, se devuelve el mapa vacío.

  const rows = await prisma.userProfile.findMany({                    // Se obtienen todos los registros de la tabla userProfile
    where: { id: { in: unique } }                                     // por su ID.
  })

  const result = new Map<string, User>();                             // Se inicializa un Map vacio "result" para almacenar los autores.

  for (const row of rows) {                                           // Se recorren todos los registros de la tabla userProfile
    result.set(row.id, { id: row.id, username: row.username })        // Se añade el autor al mapa "result" junto con el id del post {id: "id", username: "username"}
  }

  for (const id of unique) {                                           // Se recorren todos los IDs de los posts.
    if (!result.has(id)) {                                             // Si el ID no existe en el mapa "result",
      result.set(id, { id, username: `user_${id.slice(0, 6)}` })       // se añade el autor al mapa "result" con un nombre de usuario generado aleatoriamente.
    }
  }

  return result;
}

/**
 * Cuenta los comentarios de cada post en una sola query.
 *
 * @param postIds - IDs de posts a consultar.
 * @returns Map con `postId -> número de comentarios`.
 *          ⚠️ Los posts sin comentarios NO aparecen en el Map.
 *
 * @example
 * const counts = await commentCountsForPosts(["post_1"]);
 * counts.get("post_1") ?? 0; // 0 si no existe
 */
async function commentCountsForPosts(
  postIds: string[],
): Promise<Map<string, number>> {
  if (postIds.length === 0) return new Map();                          // Si no hay IDs de posts, se devuelve el mapa vacío.
  const rows = await prisma.comment.groupBy({                          // Si si hay IDs de posts, se obtienen todos los comentarios de la tabla comment 
    by: ["postId"],
    where: { postId: { in: postIds } },
    _count: { _all: true },
  });
  const m = new Map<string, number>();                                 // Se inicializa un Map vacio para almacenar el número de comentarios de cada post.
  for (const r of rows) {                                              // Se recorren todos los registros de la tabla comment
    m.set(r.postId, r._count._all);                                    // Se añade el comentario al mapa "m" junto con el id del post {id: "id", commentCount: "commentCount"}
  }
  return m;
}

/**
 * Suma los votos de cada post en una sola query.
 *
 * @param postIds - IDs de posts a consultar.
 * @returns Map con `postId -> suma de votos` (positivos y negativos).
 *          ⚠️ Los posts sin votos NO aparecen en el Map.
 *
 * @example
 * const sums = await voteSumsForPosts(["post_1"]);
 * sums.get("post_1") ?? 0; // 0 si no existe
 */
async function voteSumsForPosts(
  postIds: string[],
): Promise<Map<string, number>> {
  if (postIds.length === 0) return new Map();

  // Agrupa votos por targetId, filtrando solo los de tipo "post",
  // y suma el campo `value` de cada grupo en una sola query.
  const rows = await prisma.vote.groupBy({
    by: ["targetId"],
    where: {
      targetType: "post",
      targetId: { in: postIds },
    },
    _sum: { value: true },// Suma un campo númerico
  });

  const m = new Map<string, number>();
  for (const r of rows) {
    // `r._sum.value` puede ser null (post sin votos) o Decimal
    // según el provider de Prisma; lo normalizamos a number.
    m.set(r.targetId, Number(r._sum.value ?? 0));
  }

  return m;
}

/**
 * Devuelve el voto de un usuario sobre cada post.
 *
 * @param userId  - ID del usuario. Si es `undefined` (no autenticado),
 *                  devuelve un Map vacío.
 * @param postIds - Posts a consultar.
 * @returns Map con `postId -> voto del usuario` (-1, 0 o 1).
 *          ⚠️ Solo aparecen los posts en los que el usuario VOTÓ;
 *          los demás no están en el Map.
 *
 * @example
 * const votes = await userVotesForPosts(userId, ["post_1", "post_2"]);
 * votes.get("post_1") ?? 0; // 0 = "no votó" o "voto inválido"
 */
async function userVotesForPosts(
  userId: string | undefined,
  postIds: string[],
): Promise<Map<string, -1 | 0 | 1>> {
  const m = new Map<string, -1 | 0 | 1>();

  // Sin usuario o sin posts: no hay nada que buscar.
  if (!userId || postIds.length === 0) return m;

  // Trae los votos del usuario sobre los posts indicados.
  // findMany (no groupBy) porque queremos las filas individuales,
  // no una agregación: el voto es único por (userId, targetId).
  const rows = await prisma.vote.findMany({
    where: {
      userId,
      targetType: "post",
      targetId: { in: postIds },
    },
  });

  for (const r of rows) {
    // Defensivo: si en BD hay un valor raro (ej. 2, -5, null),
    // lo tratamos como 0 para que el tipo de retorno sea válido.
    const v = r.value;
    m.set(r.targetId, v === -1 || v === 1 ? v : 0);
  }

  return m;
}

export async function listPostsSorted(
  sort: FeedSort,
  tagFilter: string | undefined,
  userId: string | undefined
): Promise<FeedPostRow[]> {

  const where = tagFilter
    ? { postTags: { some: { tagSlug: tagFilter.toLowerCase() } } }     // Filtro: Se busca en postTags si el tagSlug contiene el tagFilter
    : undefined

  const postRows = await prisma.post.findMany({                        // Se obtienen todos los posts de acuerdo con el filtro "where"
    where,
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  const ids = postRows.map(p => p.id);                                 // Se obtiene el ID de cada post.
  if (ids.length === 0) return [];                                     // Si no hay IDs de posts, se devuelve el mapa vacío.

  const [tagMap, ccMap, vsMap, uvMap] = await Promise.all([
    tagsForPosts(ids),                                                 // Se obtienen todos los tags de los posts. <string, string[]> 
    commentCountsForPosts(ids),                                        // y el número de comentarios de los posts. <string, number>[] 
    voteSumsForPosts(ids),                                             // y la suma de los votos de los posts. <string, number>
    userVotesForPosts(userId, ids)                                     // y el voto del usuario sobre cada post. <string, -1 | 0 | 1>[] 
  ]);

  const mapped = postRows.map((row) => {                               // Se mapean los post según el filtro y de ellos obtenemos
    const slugs = tagMap.get(row.id) ?? [];                            // el tag "slugs" del post <string, string[]>
    const cc = ccMap.get(row.id) ?? 0                                  // el número de comentarios "cc" del post <string, number[]>
    const vs = vsMap.get(row.id) ?? 0;                                 // y la suma de los votos "vs" del post <string, number>

    return {
      post: mapPostRow(                                                // Se transforma el post con sus tags y el número de comentarios
        row,
        slugs,
        cc
      ),
      voteScore: vs,                                                    // Se establece la suma de votos del post
      created: row.createdAt.getTime(),                                 // Se obtiene la fecha de creación del post
      userVote: uvMap.get(row.id) ?? 0,                                 // Se establece el voto del usuario sobre cada post
    }
  });

  if (sort === "new") {                                                // Se ordena por fecha
    mapped.sort((a, b) => b.created - a.created)
  } else if (sort === "top") {                                         // Se ordena por votos y comentarios
    mapped.sort(
      (a, b) =>
        b.voteScore - a.voteScore ||
        b.post.commentCount - a.post.commentCount ||
        b.created - a.created
    )
  } else {                                                             // Se ordena por "hot", es decir, por votos y comentarios con una fórmula exponencial
    mapped.sort((a, b) => {
      const hotB = b.voteScore + 2 * b.post.commentCount;              // Se obtiene el puntaje hot del post b
      const hotA = a.voteScore + 2 * a.post.commentCount;              // Se obtiene el puntaje hot del post a
      return hotB - hotA || b.created - a.created                      // Se ordena por puntaje hot y luego por fecha
    })
  }

  return mapped.map((x) => ({                                          // Se transforma el resultado en un array de objetos {post, score, userVote}
    post: x.post,
    score: x.voteScore,
    userVote: x.userVote as -1 | 0 | 1
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

export async function listTags(): Promise<Tag[]> {
  const rows = await prisma.tag.findMany({ orderBy: { slug: "asc" } });  // Se obtienen todos los registros de la tabla tag ordenados por slug.
  return rows.map((t) => ({                                             // Se transforma cada registro en un objeto Tag
    slug: t.slug,
    label: t.label,
    hashColor: t.hashColor
  }))
}


