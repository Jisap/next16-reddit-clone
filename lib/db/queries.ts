import { PostModel } from "../generated/prisma/models";
import { prisma } from "../prisma";
import { FeedSort, Post, Tag, User, VoteTarget, Comment } from "../types";
import { EnrichedCommentNode, nestCommentRows } from "../comment-tree";

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



  const rows = await prisma.vote.groupBy({                    // Agrupa votos por targetId, filtrando solo los de tipo "post",
    by: ["targetId"],                                         // y suma el campo `value` de cada grupo en una sola query.
    where: {
      targetType: "post",
      targetId: { in: postIds },
    },
    _sum: { value: true },// Suma un campo númerico
  });

  const m = new Map<string, number>();
  for (const r of rows) {                                    // Se recorren todos los registros de la tabla vote y se realiza la suma de los votos.
    m.set(r.targetId, Number(r._sum.value ?? 0));            // `r._sum.value` puede ser null (post sin votos) o Decimal, según el provider de Prisma; lo normalizamos a number.
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


  if (!userId || postIds.length === 0) return m;                   // Sin usuario o sin posts: no hay nada que buscar.

  const rows = await prisma.vote.findMany({                        // Trae los votos del usuario sobre los posts indicados.
    where: {                                                       // findMany (no groupBy) porque queremos las filas individuales,
      userId,                                                      // no una agregación: el voto es único por (userId, targetId).
      targetType: "post",
      targetId: { in: postIds },
    },
  });

  for (const r of rows) {                                          // Recorremos los votos del usuario sobre los posts.
    const v = r.value;                                             // Obtenemos el valor del voto del usuario.
    m.set(r.targetId, v === -1 || v === 1 ? v : 0);                // Defensivo: si en BD hay un valor raro (ej. 2, -5, null), lo tratamos como 0 para que el tipo de retorno sea válido.
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

  if (sort === "new") {                                                 // Se ordena por fecha
    mapped.sort((a, b) => b.created - a.created)
  } else if (sort === "top") {                                          // Se ordena por votos y comentarios
    mapped.sort(
      (a, b) =>
        b.voteScore - a.voteScore ||
        b.post.commentCount - a.post.commentCount ||
        b.created - a.created
    )
  } else {                                                              // Se ordena por "hot", es decir, por votos y comentarios con una fórmula exponencial
    mapped.sort((a, b) => {
      const hotB = b.voteScore + 2 * b.post.commentCount;               // Se obtiene el puntaje hot del post b
      const hotA = a.voteScore + 2 * a.post.commentCount;               // Se obtiene el puntaje hot del post a
      return hotB - hotA || b.created - a.created                       // Se ordena por puntaje hot y luego por fecha
    })
  }

  return mapped.map((x) => ({                                           // Se transforma el resultado en un array de objetos {post, score, userVote}
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

async function tagsForPosts(
  postIds: string[]
): Promise<Map<string, string[]>> {

  const m = new Map<string, string[]>();                                    // Se inicializa un Map vacio para almacenar los tags.
  if (postIds.length === 0) return m;                                       // Si no hay IDs de posts, se devuelve el mapa vacío.

  const rows = await prisma.postTag.findMany({                              // Se obtienen todos los registros de la tabla post_tags (combinación postId + tagSlug)
    where: { postId: { in: postIds } }                                      // que correspondan a los IDs de posts proporcionados.
  })

  for (const pid of postIds) m.set(pid, []);                                // Se inicializa una entrada en el mapa m, para cada ID de post { "post1" => [], "post2" => [], "post3" => []}.

  for (const r of rows) {                                                   // Se recorren todos los registros r, obtenidos de postTag.
    const list = m.get(r.postId);                                           // Para cada r se obtiene el array vacio de tags.
    if (list) {                                                             // Si existe el array de tags,
      list.push(r.tagSlug);                                                 // se añade el tag actual al array.
      m.set(r.postId, list);                                                // y se actualiza el mapa.
    }
  }
  return m;
}

export async function listTags(): Promise<Tag[]> {
  const rows = await prisma.tag.findMany({ orderBy: { slug: "asc" } });     // Se obtienen todos los registros de la tabla tag ordenados por slug.
  return rows.map((t) => ({                                                 // Se transforma cada registro en un objeto Tag
    slug: t.slug,
    label: t.label,
    hashColor: t.hashColor
  }))
}

export async function getUserVote(
  userId: string | undefined,
  type: VoteTarget,
  targetId: string,
): Promise<-1 | 0 | 1> {
  if (!userId) return 0;                                                      // Si no hay userId, se devuelve 0.

  const row = await prisma.vote.findUnique({                                  // Se obtiene el voto del usuario dependiendo de 
    where: {                                                                  // la condición de búsqueda.
      userId_targetType_targetId: {                                           // la clave compuesta para buscar el voto.
        userId,                                                               // el id del usuario.
        targetType: type,                                                     // el tipo de voto.
        targetId,                                                             // el id del objetivo.
      },
    },
  });

  const v = row?.value;                                                       // Se obtiene el valor del voto.

  return v === -1 || v === 1 ? v : 0;                                         // Se devuelve el valor del voto.
}


export async function getPostById(id: string): Promise<Post | undefined> {
  const row = await prisma.post.findUnique({ where: { id } });                // Se obtiene el post por su id.
  if (!row) return undefined;                                                 // Si no se encuentra el post, se devuelve undefined.

  const [tagMap, ccMap] = await Promise.all([
    tagsForPosts([id]),                                                       // Se obtienen los tags del post.
    commentCountsForPosts([id]),                                              // Se obtienen el numero de comentarios del post.
  ]);

  return mapPostRow(                                                          // Se mapea el post a un objeto Post.
    row,                                                                      // Se obtiene el post.
    tagMap.get(id) ?? [],                                                     // Se obtiene el tag del post.
    ccMap.get(id) ?? 0);                                                      // Se obtiene el numero de comentarios del post.
}


export async function getAuthorById(authorId: string): Promise<User> {
  const row = await prisma.userProfile.findUnique(                            // Se obtiene el perfil del usuario desde la tabla userProfile
    { where: { id: authorId } }                                               // Se busca por el id del autor.
  );
  return row
    ? { id: row.id, username: row.username }                                  // Si se encuentra el perfil del usuario, se devuelve el objeto User.
    : { id: authorId, username: `user_${authorId.slice(0, 6)}` };             // Si no se encuentra el perfil del usuario, se devuelve un objeto User con el id del autor y un nombre de usuario generado aleatoriamente.
}


export async function getPostScore(postId: string): Promise<number> {
  const agg = await prisma.vote.aggregate({                                   // Se calcula el puntaje de un post sumando los valores de todos los votos asociados a él.
    where: { targetType: "post", targetId: postId },                          // Se especifica que solo se consideren los votos cuyo targetType sea "post" y targetId coincida con el postId proporcionado.
    _sum: { value: true },                                                    // Se indica que se debe sumar el campo value de los votos.
  });
  return Number(agg._sum.value ?? 0);                                         // Se devuelve el puntaje del post.
}

export async function listCommentsForPost(postId: string): Promise<Comment[]> {
  const rows = await prisma.comment.findMany({ where: { postId } });
  return rows.map((c) => ({
    id: c.id,
    postId: c.postId,
    authorId: c.authorId,
    parentId: c.parentId,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
  }));
}

/**
 * Esta función es un batch loader que optimiza la obtención de múltiples autores
 * de comentarios, de una sola vez.
 * @param authorIds - Array de ids de autores.
 * @returns Map con los autores. <string, number>
 */

export async function batchAuthorsForIds(
  authorIds: string[],
): Promise<Map<string, User>> {
  const unique = [...new Set(authorIds)];                                // Se elimina los elementos duplicados de la lista de autores
  if (unique.length === 0) return new Map();                             // Si no hay autores, se devuelve un Map vacio.

  const rows = await prisma.userProfile.findMany({                       // Se obtienen los perfiles de los usuarios desde la tabla userProfile
    where: { id: { in: unique } },                                       // Se busca por el id del autor.
  });

  const result = new Map<string, User>();                                // Se crea un Map para almacenar los autores.

  for (const row of rows) {                                              // Se itera sobre los resultados de la consulta (perfiles encontrados)
    result.set(row.id, { id: row.id, username: row.username });          // Se agrega el autor al Map.
  }

  for (const id of unique) {                                             // Se itera sobre los autores que no se encontraron en la consulta
    if (!result.has(id)) {                                               // Si no se encuentra el autor
      result.set(id, { id, username: `user_${id.slice(0, 6)}` });        // Se agrega el autor al Map con un nombre de usuario generado aleatoriamente.
    }
  }

  return result;
}

/**
 * Esta función calcula los scores totales de múltiples comentarios en una sola consulta,
 * usando GROUP BY para sumar los votos de cada comentario.
 * 
 * @param commentIds - Array de ids de comentarios.
 * @returns Map con el puntaje de los comentarios. <string, number>
 */

async function batchCommentScores(
  commentIds: string[],
): Promise<Map<string, number>> {
  if (commentIds.length === 0) return new Map();                         // Si no hay IDs de comentarios, retorna un Map vacío inmediatamente.
  const rows = await prisma.vote.groupBy({                               // Obtiene el puntaje de los comentarios.
    by: ["targetId"],                                                       // Agrupa los resultados por ID de comentario
    where: {                                                                // Filtra solo votos de tipo "comment" y solo los IDs solicitados
      targetType: "comment",
      targetId: { in: commentIds },
    },
    _sum: { value: true },                                                  // Calcula la suma del campo value (que es +1 para upvote, -1 para downvote)
  });

  const m = new Map<string, number>();                                   // Se crea un Map para almacenar los puntajes.
  for (const r of rows) {                                                  // Se itera sobre los resultados de la consulta
    m.set(r.targetId, Number(r._sum.value ?? 0));                          // Se agrega el puntaje al Map.
  }
  return m;                                                              // Se retorna el Map con los puntajes. <string, number>
}

/**
 * Esta función obtiene los votos de múltiples comentarios en una sola consulta,
 * para un usuario específico.
 * @param userId - ID del usuario.
 * @param commentIds - Array de IDs de comentarios.
 * @returns Map con los votos del usuario. <string, -1 | 0 | 1>
 */

async function batchUserVotesForComments(
  userId: string,
  commentIds: string[],
): Promise<Map<string, -1 | 0 | 1>> {
  const m = new Map<string, -1 | 0 | 1>();                               // Se crea un Map para almacenar los votos. <string, -1 | 0 | 1>
  if (commentIds.length === 0) return m;                                 // Si no hay IDs de comentarios, retorna un Map vacío inmediatamente.
  const rows = await prisma.vote.findMany({                              // Se obtienen los votos de los comentarios.
    where: {
      userId,
      targetType: "comment",
      targetId: { in: commentIds },
    },
  });
  for (const r of rows) {                                                // Se itera sobre los resultados de la consulta
    const v = r.value;
    m.set(r.targetId, v === -1 || v === 1 ? v : 0);                      // Se agrega el voto al Map.
  }
  return m;                                                              // Se retorna el Map con los votos. <string, -1 | 0 | 1>
}



/**
 * Esta función construye un árbol jerárquico de comentarios a partir de una lista plana de comentarios.
 * @param flat - Lista plana de comentarios.
 * @returns Árbol jerárquico de comentarios.
 * 
 * Propósito:
 * - Obtener todos los comentarios de un post con:
 * - Información del autor (username)
 * - Score total (suma de votos)
 * - Voto del usuario actual (si está autenticado)
 * - Estructura jerárquica (padre-hijo)
 */

export async function getCommentTree(
  postId: string,
  sessionUserId?: string,
): Promise<EnrichedCommentNode[]> {

  const flat = await listCommentsForPost(postId);                           // Obtiene todos los comentarios del post. Con esta lista flat...
  if (flat.length === 0) return [];                                         // Si no hay comentarios, retorna un array vacío.
  const authorIds = [...new Set(flat.map((c) => c.authorId))];              // Obtenemos los IDs únicos de los autores 
  const authorMap = await batchAuthorsForIds(authorIds);                    // y con ellos los autores en un Map gracias a batAuthorsForIds

  const commentIds = flat.map((c) => c.id);                                 // Tambien obtenemos los IDs de los comentarios.
  const scoreMap = await batchCommentScores(commentIds);                    // Con ellos obtenemos el puntaje total de cada comentario

  const voteMap = sessionUserId                                             // Solo si el usuario está autenticado
    ? await batchUserVotesForComments(sessionUserId, commentIds)            // se obtiene los votos específicos del usuario actual para estos comentarios
    : new Map<string, -1 | 0 | 1>();                                        // Si no hay sesión, retorna Map vacío (todos los votos son 0)

  const enriched = flat                                                     // Se mapea sobre cada comentario plano
    .map((c) => {
      const author = authorMap.get(c.authorId);                             // Se obtiene el autor del comentario
      if (!author) return null;                                             // Si no se encuentra el autor, se retorna null

      return {                                                              // Se crea un objeto con el comentario enriquecido
        ...c,                                                               // Agrega el objeto author completo 
        author,                                                             // Agrega el author al objeto
        score: scoreMap.get(c.id) ?? 0,                                     // Agrega el score del Map (o 0 si no tiene votos)
        userVote: (voteMap.get(c.id) ?? 0) as -1 | 0 | 1,                   // Agrega el userVote del Map (o 0 si no votó)
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);                 // Filtra los comentarios que no tienen autor

  return nestCommentRows(enriched);                                         // Retorna el árbol jerárquico de comentarios
}

/**
 * Esta función obtiene el conteo de posts por tag.
 * @returns Array de objetos con el tag y su conteo.
 * 
 * Propósito:
 * - Obtener todos los tags.
 * - Obtener el conteo de posts por tag.
 * - Retornar un array de objetos con el tag y su conteo.
 */

export async function tagPostCounts(): Promise<{ tag: Tag; count: number }[]> {
  const allTags = await listTags();                                          // Se obtienen todos los tags
  const rows = await prisma.postTag.groupBy({                                // Agrupa los resultados por tagSlug
    by: ["tagSlug"],
    _count: { _all: true },
  });

  const countMap = new Map(rows.map((r) => [r.tagSlug, r._count._all]));      // Crea un Map con el conteo de posts por tag

  return allTags.map((tag) => ({                                              // Retorna un array de objetos con el tag y su conteo
    tag,
    count: countMap.get(tag.slug) ?? 0,
  }));
}

