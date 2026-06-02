import { getSessionUser } from '@/lib/auth';
import { getAuthorById, getCommentTree, getPostById, getPostScore, getUserVote, listTags } from '@/lib/db/queries';
import { formatRelativeTime } from '@/lib/format';
import { UserAvatar } from '@neondatabase/auth/react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import React from 'react'

const PostPage = async ({
  params
}: {
  params: Promise<{ id: string }>
}) => {

  const { id } = await params;
  const post = await getPostById(id);
  if (!post) notFound();

  const author = await getAuthorById(post.authorId);
  const sessionUser = await getSessionUser();

  const score = await getPostScore(post.id);
  const userVote = await getUserVote(sessionUser?.id, "post", post.id);

  const tags = await listTags();
  const primarySlug = post.tagSlugs[0];
  const primaryTag = primarySlug
    ? tags.find((t) => t.slug === primarySlug)
    : undefined;

  const commentTree = await getCommentTree(post.id, sessionUser?.id);

  return (
    <div className='flex gap-8'>
      <div className='min-w-0 flex-1'>
        <Link
          href="/"
          className='mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-color hover:text-foreground'
        >
          <ArrowLeft className='size-4' />
          Back to Feed
        </Link>

        <article className="rounded-xl border border-border bg-card p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <UserAvatar user={author} size="sm" />
            <span className="font-medium text-foreground">u/ {author.username}</span>
            <span>·</span>
            <span>{formatRelativeTime(post.createdAt)}</span>
          </div>

          <h1 className="text-balance text-2xl font-bold leading-tight text-foreground md:text-3xl">
            {post.title}
          </h1>
        </article>
      </div>
    </div>
  )
}

export default PostPage