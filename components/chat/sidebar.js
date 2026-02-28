'use client';

import { Button } from "@/components/ui/button"
import { PlusCircle, MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"

// Sekarang nerima props dari page.js
export default function Sidebar({ className, sessions, activeSessionId, onSelectSession, onNewChat, onRefresh, onDeleteActive }) {
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState("")

  const handleRename = (chat) => {
    setEditingId(chat.id)
    setEditTitle(chat.title)
  };

  const handleSaveRename = async (id) => {
    if (!editTitle.trim()) {
      setEditingId(null)
      return
    }
    try {
      await fetch(`/api/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle })
      });
      setEditingId(null)
      if (onRefresh) onRefresh()
    } catch (error) {
      console.error("Gagal rename", error)
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
      if (onDeleteActive) onDeleteActive(id)
      if (onRefresh) onRefresh()
    } catch (error) {
      console.error("Gagal delete", error)
    }
  };

  return (
    <div className={cn("pb-12 h-screen border-r bg-gray-50/40 hidden md:flex flex-col 65", className)}>
      <div className="space-y-4 py-4 flex-1 overflow-auto">
        <div className="px-4 py-2">
          <Button onClick={onNewChat} className="w-full justify-start gap-2" variant="default">
            <PlusCircle className="h-4 w-4" />
            New Chat
          </Button>
        </div>
        <div className="py-2">
          <h2 className="relative px-6 text-xs font-semibold tracking-tight text-gray-500 mb-2">
            History
          </h2>
          <TooltipProvider delayDuration={400}>
          <div className="space-y-1 px-2">
            {sessions?.map((chat) => (
              editingId === chat.id ? (
                <div key={chat.id} className="flex items-center w-full px-2 gap-2 h-9">
                  {/*<MessageSquare className="h-4 w-4 shrink-0 text-gray-500" />*/}
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(chat.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => handleSaveRename(chat.id)}
                    className="h-7 text-sm px-2"
                    autoFocus
                  />
                </div>
              ) : (
                /* TOOLTIP: Membungkus tiap item chat */
                <Tooltip key={chat.id}>
                  <TooltipTrigger asChild>
                    <div className="group relative flex items-center w-full">
                      <Button
                        onClick={() => onSelectSession(chat.id)}
                        variant={activeSessionId === chat.id ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start font-normal text-sm h-9 truncate pr-8 cursor-pointer relative",
                          activeSessionId === chat.id && "bg-gray-200/60 font-medium"
                        )}
                      >
                        <span className="truncate">{chat.title}</span>
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute right-1 h-7 w-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4 text-gray-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleRename(chat)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Ganti Nama</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(chat.id)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TooltipTrigger>
                  
                  {/* ISI TOOLTIP: Muncul kalau judul kepotong (truncate) */}
                  <TooltipContent 
                    side="right" 
                    className="max-w-70 wrap-break-words bg-gray-800 text-white text-xs border-none shadow-lg py-2 px-3"
                  >
                    {chat.title}
                  </TooltipContent>
                </Tooltip>
              )
            ))}
             {(!sessions || sessions.length === 0) && (
                <div className="px-4 text-sm text-gray-400">Belum ada history</div>
             )}
          </div>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}