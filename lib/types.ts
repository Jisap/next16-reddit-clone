


export type User = {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}


export type Tag = {
  slug: string;
  label: string;
  hashColor: string;
}

export type Post = {
  id: string;
  authorId: string;
  title: string;
  body: string;
  tagSlugs: string[];
  createdAt: string;
  commentCount: number;
}

export type FeedSort = "hot" | "new" | "top";


