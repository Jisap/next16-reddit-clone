import { getSessionUser } from '@/lib/auth';
import { getAuthorById, getPostById } from '@/lib/db/queries';
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

  return (
    <div>page</div>
  )
}

export default PostPage