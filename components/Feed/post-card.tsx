
import { Post, Tag, User } from '@/lib/types'
import React from 'react'

const PostCard = ({
  post,
  author,
  tagsBySlug,
  score,
  userVote
}: {
  post: Post;
  author: User;
  tagsBySlug: Map<string, Tag>;
  score: number;
  userVote: -1 | 0 | 1;
}) => {
  return (
    <article>
      <div>
        <div>

        </div>
      </div>
    </article>
  )
}

export default PostCard