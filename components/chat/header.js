'use client'

import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Menu, PanelLeft } from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import Sidebar from "./sidebar"
import { cn } from '@/lib/utils'

export default function Header({ isSidebarOpen, toggleSidebar }) {
  const router = useRouter()
  
  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (res.ok) {
        router.push('/login')
        router.refresh()
      }
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4 sm:h-16 sm:border-0 sm:bg-transparent sm:px-6">
      
      {/* Sidebar Toggle (Desktop) */}
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={toggleSidebar}
        className="hidden md:flex h-9 w-9 text-gray-500 hover:bg-gray-100 cursor-pointer"
      >
        <PanelLeft className={cn("h-5 w-5 transition-transform", !isSidebarOpen && "rotate-180")} />
      </Button>

      {/* Mobile Menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <SheetTitle className="sr-only">menu</SheetTitle>
          <Sidebar className="block border-none bg-white" />
        </SheetContent>
      </Sheet>

      {/* Title atau Brand singkat di header */}
      <div className="font-semibold text-sm ml-2 md:ml-0">
        Chat Assistant
      </div>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 cursor-pointer">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder-user.png" />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-500 cursor-pointer">
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}