import { FeedSort } from '@/lib/types'
import { cn } from '@/lib/utils';
import { Flame, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import React from 'react'


function hrefFor(sort: FeedSort, tag?: string) {   //  Construye la URL del tab activo, evitando parámetros innecesarios
  const params = new URLSearchParams();           //  Genera un objeto de búsqueda para luego construir la URL
  if (sort !== "hot") params.set("sort", sort);    //  Si el sort no es "hot", lo añade a los parámetros
  if (tag) params.set("tag", tag);                 //  Si hay un tag, lo añade a los parámetros
  const q = params.toString();                    //  Convierte los parámetros a una cadena de consulta
  return q ? `/?${q}` : `/`                       //  Devuelve la URL con los parámetros o la URL base
}


const FeedSortTabs = ({
  current,
  tag,
}: {
  current: FeedSort;
  tag?: string;
}) => {

  const tabs: { id: FeedSort; label: string; icon: typeof Flame }[] = [
    { id: 'hot', label: 'Hot', icon: Flame },
    { id: 'new', label: 'New', icon: Sparkles },
    { id: 'top', label: 'Top', icon: TrendingUp },
  ]

  return (
    <div className='mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3'>
      <div className='flex gap-1'>
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = current === id;
          return (
            <Link
              key={id}
              href={hrefFor(id, tag)}
              className={cn(
                "inline-flex items-center ga-1.5 rounded-lg px-3 py-1.5 text-foreground gap-2",
                active
                  ? "bg-muted text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon />
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default FeedSortTabs