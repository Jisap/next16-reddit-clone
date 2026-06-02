import FeedSortTabs from "@/components/Feed/feed-sort-tabs";
import PostCard from "@/components/Feed/post-card";
import { RightTrending } from "@/components/layout/right-tending";
import { getSessionUser } from "@/lib/auth";
import { batchAuthorForIds, listPostsSorted, listTags } from "@/lib/db/queries";
import { getTrendingToday } from "@/lib/trending";
import { FeedSort, Tag } from "@/lib/types";
import { redirect } from "next/navigation";


export default async function Home({
  searchParams
}: {
  searchParams: Promise<{ sort?: string; tag?: string }>
}) {

  const sp = await searchParams;

  const sortRaw = sp.sort;
  const sort: FeedSort = sortRaw === 'new' || sortRaw === 'top' ? sortRaw : 'hot'; // Si sortRaw es 'new' o 'top', se toma ese valor, si no, se toma 'hot'

  const tagFilter = sp.tag?.toLowerCase()

  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect('/sign-in');
  }

  const tags = await listTags();                                       // Tags ordenados por slug.
  const tagMap = new Map<string, Tag>(tags.map((t) => [t.slug, t]));   // Mapa con los tags ordenados por slug.

  const rows = await listPostsSorted(sort, tagFilter, sessionUser.id)  // posts ordenados por votos y comentarios

  const authorIds = [...new Set(rows.map((r) => r.post.authorId))];    // IDs únicos de los autores de los posts
  const authorById = await batchAuthorForIds(authorIds);               // Array con los ids de los post y sus autores
  if (sessionUser && authorById.has(sessionUser.id)) {                 // Si el usuario logueado es un autor de un post
    authorById.set(sessionUser.id, sessionUser)                        // Se añade el autor al mapa "result"
  }

  const trending = getTrendingToday();

  const cards = rows.map((row) => {
    const author = authorById.get(row.post.authorId)
    if (!author) {
      console.warn("Missing author for post", row.post.id);
      return null;
    }
    return <PostCard
      key={row.post.id}
      post={row.post}
      author={author}
      tagsBySlug={tagMap}
      score={row.score}
      userVote={row.userVote}
    />
  })

  return (
    <div className="flex gap-8">
      <div className="min-w-0 flex-1">
        <FeedSortTabs
          current={sort}
          tag={tagFilter}
        />
        <div className="space-y-4">
          {cards}
          {rows.length === 0 && (
            <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No posts match this filter
            </p>
          )}
        </div>
      </div>

      <aside className="hidden w-72 shrink-0 space-y-6 lg:block">
        <RightTrending items={trending} />
        {/* <RightTopTags /> */}
      </aside>
    </div>
  );
}
