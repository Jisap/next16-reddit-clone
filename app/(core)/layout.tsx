import LeftSidebar from '@/components/layout/left-sidebar'
import Navbar from '@/components/layout/Navbar'

import React from 'react'

const CoreGroupLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Navbar />
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