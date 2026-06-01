import "dotenv/config";
import { prisma } from "../lib/prisma";

const DEMO_AUTHORS = [
  "seed_auth_alice",
  "seed_auth_bob",
  "seed_auth_clara",
  "seed_auth_dev",
  "seed_auth_erin",
  "seed_auth_frank",
];

type SeedPost = {
  authorId: string;
  title: string;
  body: string;
  tagSlugs: string[];
};

const CURATED_POSTS: SeedPost[] = [
  {
    authorId: DEMO_AUTHORS[0],
    title: "Just shipped my side project after 8 months of building in evenings and weekends",
    body: "It started as a tiny CLI and grew into a full product. The hardest part was definitely state management.",
    tagSlugs: ["webdev"],
  },
  {
    authorId: DEMO_AUTHORS[1],
    title: "RAG without the kitchen sink",
    body: "Chunking + embeddings + pgvector got us a useful internal search. No LangChain needed.",
    tagSlugs: ["ai", "typescript"],
  },
  {
    authorId: DEMO_AUTHORS[2],
    title: "Hiring: junior-friendly issues that aren't insulting",
    body: "Good first issues should touch real code paths with a mentor one Zoom call away.",
    tagSlugs: ["webdev"],
  },
  {
    authorId: DEMO_AUTHORS[2],
    title: "Tailwind v4: first impressions after a week",
    body: "CSS-first config is weird for a day, then muscle memory kicks in. Feels much faster.",
    tagSlugs: ["react", "webdev"],
  },
  {
    authorId: DEMO_AUTHORS[3],
    title: "When to reach for Prisma vs raw SQL",
    body: "ORM for product code, $queryRaw for reporting paths that need window functions.",
    tagSlugs: ["typescript", "nextjs"],
  },
  {
    authorId: DEMO_AUTHORS[4],
    title: "Dark mode: stop guessing hex pairs",
    body: "Pick a palette generator that outputs both surfaces. We reduced contrast slightly.",
    tagSlugs: ["webdev", "react"],
  },
  {
    authorId: DEMO_AUTHORS[5],
    title: "Edge vs Node runtime in Next - pick one per route group",
    body: "Mixing mindlessly gave us cold-start surprises. We drew a simple dividing line.",
    tagSlugs: ["nextjs"],
  },
  {
    authorId: DEMO_AUTHORS[0],
    title: "Observability for side projects: logs alone aren't enough",
    body: "One SLO: p95 API latency. Everything else is noise until you have users.",
    tagSlugs: ["webdev", "typescript"],
  },
  {
    authorId: DEMO_AUTHORS[2],
    title: "Tag-based feeds > subreddits for small communities",
    body: "Fewer walls, simpler mental model. New members find content faster without guessing.",
    tagSlugs: ["webdev"],
  },
  {
    authorId: DEMO_AUTHORS[3],
    title: "OpenAI announces GPT-5 - what are you building with it?",
    body: "Curious what production patterns people are landing on. We're still mostly doing RAG.",
    tagSlugs: ["ai", "typescript"],
  },
  {
    authorId: DEMO_AUTHORS[1],
    title: "Minimal UI kits: when shadcn is enough",
    body: "You don't need fifteen dependencies to ship. Defaults + tokens got us 90% there.",
    tagSlugs: ["react", "webdev"],
  },
  {
    authorId: DEMO_AUTHORS[0],
    title: "Threaded comments: adjacency list vs nested sets",
    body: "Adjacency list + sort key has been the sweet spot for us. Nested sets are overkill.",
    tagSlugs: ["typescript", "nextjs"],
  },
  {
    authorId: DEMO_AUTHORS[4],
    title: "Show HN: Threadly - Reddit-style UI with server actions",
    body: "Neon-backed posts and auth via Neon Auth. Happy to answer architecture questions.",
    tagSlugs: ["nextjs", "webdev"],
  },
  {
    authorId: DEMO_AUTHORS[3],
    title: "Why I still write ADRs in a three-person team",
    body: "Future you is also a different person. Two paragraphs beats Slack archaeology.",
    tagSlugs: ["typescript"],
  },
  {
    authorId: DEMO_AUTHORS[4],
    title: "API versioning when you hate `/v2`",
    body: "We version resources, not the whole API surface. Breaking changes are scoped.",
    tagSlugs: ["webdev", "nextjs"],
  },
  {
    authorId: DEMO_AUTHORS[5],
    title: "Keyboard shortcuts in web apps: worth the maintenance?",
    body: "Yes if power users pay you. We ship ⌘K search and stop there.",
    tagSlugs: ["react", "webdev"],
  },
  {
    authorId: DEMO_AUTHORS[0],
    title: "Weekend project: RSS isn't dead for developers",
    body: "We aggregate release notes from repos we depend on. Saves an hour a week.",
    tagSlugs: ["typescript", "ai"],
  },
  {
    authorId: DEMO_AUTHORS[1],
    title: "Feature flags: LaunchDarkly vs open-source vs env toggles",
    body: "At our scale, env + DB columns worked. YMMV past ~50 engineers.",
    tagSlugs: ["webdev", "typescript"],
  },
];

function proceduralPosts(count: number, offset: number): SeedPost[] {
  const topics = [
    "deployment",
    "testing",
    "DX",
    "perf",
    "security",
    "accessibility",
    "bundlers",
    "state management",
  ];
  const out: SeedPost[] = [];
  for (let i = 0; i < count; i++) {
    const n = offset + i + 1;
    const authorId = DEMO_AUTHORS[i % DEMO_AUTHORS.length];
    const tagSlugs =
      i % 3 === 0
        ? ["nextjs", "react"]
        : i % 3 === 1
          ? ["webdev"]
          : ["typescript", "ai"];
    out.push({
      authorId,
      title: `Community thread #${n}: ${topics[i % topics.length]}`,
      body: `Seeded discussion stub #${n}. Replace with real content or use this to test pagination and scrolling. \n\nTopics covered in this series: ${topics.join(", ")}.`,
      tagSlugs,
    });
  }
  return out;
}

async function seedTags() {
  const tagRows = [
    { slug: "webdev", label: "webdev", hashColor: "#7193FF" },
    { slug: "react", label: "react", hashColor: "#FFB000" },
    { slug: "nextjs", label: "nextjs", hashColor: "#46D160" },
    { slug: "typescript", label: "typescript", hashColor: "#FF585B" },
    { slug: "ai", label: "ai", hashColor: "#FF4500" },
  ];
  await prisma.tag.createMany({
    data: tagRows,
    skipDuplicates: true,
  });
}

async function insertPost(data: SeedPost) {
  const slugs = data.tagSlugs.length ? data.tagSlugs : ["webdev"];
  await prisma.tag.createMany({
    data: slugs.map((slug) => ({
      slug,
      label: slug,
      hashColor: "#FFB000",
    })),
    skipDuplicates: true,
  });

  const post = await prisma.post.create({
    data: {
      authorId: data.authorId,
      title: data.title,
      body: data.body,
    },
  });

  await prisma.postTag.createMany({
    data: slugs.map((tagSlug) => ({ postId: post.id, tagSlug })),
  });

  return post.id;
}

async function main() {
  console.log("Seeding tags...");
  await seedTags();

  const force = process.env.SEED_FORCE === "1";
  const existing = await prisma.post.count();

  if (existing > 0 && !force) {
    console.log(
      `Skipping posts (${existing} already in DB). Set SEED_FORCE=1 to delete`,
    );
    return;
  }

  if (existing > 0 && force) {
    console.log("SEED_FORCE: removing posts, comments, votes...");
    await prisma.vote.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.postTag.deleteMany();
    await prisma.post.deleteMany();
  }

  const extra = Math.max(0, parseInt(process.env.SEED_EXTRA ?? "0", 10) || 0);
  const procedural =
    extra > 0 ? proceduralPosts(extra, CURATED_POSTS.length) : [];
  const allPosts = [...CURATED_POSTS, ...procedural];

  console.log(
    `Seeding ${allPosts.length} posts (${CURATED_POSTS.length} curated + ${procedural.length} procedural)`,
  );

  for (const p of allPosts) {
    await insertPost(p);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });