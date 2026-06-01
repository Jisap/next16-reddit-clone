"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type VoteTarget = "post" | "comment";

export function VoteButtons({
  target,
  targetId,
  score,
  userVote,
}: {
  target: VoteTarget;
  targetId: string;
  score: number;
  userVote: -1 | 0 | 1;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isPost = target === "post";



  const iconClass = isPost ? "size-6" : "size-4";
  const stackClass = isPost
    ? "flex flex-col items-center gap-0.5 py-1 text-sm"
    : "flex flex-col items-center gap-0 text-xs";
  const scoreClass = isPost
    ? "min-w-[2ch] text-center text-xs font-semibold tabular-nums"
    : "min-w-[1.5ch] text-center font-medium tabular-nums";

  return (
    <div>

    </div>
  );
}