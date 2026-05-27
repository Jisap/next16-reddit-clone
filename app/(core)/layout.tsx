import LeftSidebar from '@/components/layout/left-sidebar'
import Navbar from '@/components/layout/Navbar'
import { getSessionUser } from '@/lib/auth'

import React from 'react'

const CoreGroupLayout = async ({ children }: { children: React.ReactNode }) => {

  const user = await getSessionUser()

  return (
    <>
      <Navbar user={user} />
      <div className="mx-auto flex max-w-[1200px] gap-8 px-4 pb-16 pt-2">
        <LeftSidebar />
        <div className='min-w-0 flex-1'>
          {children}
        </div>
      </div>
    </>
  )
}

export default CoreGroupLayout