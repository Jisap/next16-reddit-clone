"use client"

import { cn } from "@/lib/utils"
import { Flame, Home, LayoutGrid } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import LeftTags from "./left-tags"
import JoinCtaCard from "./join-cta-card"

const nav = [
  { href: "/", label: "Home", icon: Home, match: "home" as const },
  { href: "/?sort=hot", label: "Popular", icon: Flame, match: "hot" as const },
  { href: "/?sort=new", label: "All Post", icon: LayoutGrid, match: "new" as const },
]

const isActive = (match: "home" | "hot" | "new", pathname: string, sort: string | null) => {
  if (match === "home") return pathname === "/" && !sort
  if (match === "hot") return pathname === "/" && sort === "hot"
  if (match === "new") return pathname === "/" && sort === "new"
  return false
}

const LeftSidebar = ({ showCta }: { showCta: boolean }) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sort = searchParams.get("sort")

  return (
    <aside className="hidden w-52 shrink-0 lg:block">
      <nav className="space-y-1 pr-2">
        {nav.map(({ href, label, icon: Icon, match }) => {
          const active = isActive(match, pathname, sort)
          return (
            <Link
              key={match}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm font-medium hover:bg-muted/60",
                active && "border-primary bg-muted/60 text-foreground"
              )}
            >
              <Icon className={cn(
                "size-5 shrink-0",
                active ? "text-primary" : "text-muted-foreground"

              )} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top Tags</p>
        <LeftTags />
      </div>

      {showCta && (
        <div className="mt-8">
          <JoinCtaCard />
        </div>
      )}
    </aside>
  )
}

export default LeftSidebar

