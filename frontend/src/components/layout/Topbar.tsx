"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TbBell,
  TbLogout,
} from "react-icons/tb";
import { signOut } from "next-auth/react";
import { useNotificationStore } from "@/store/notificationStore";

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const { connected, notifications, unreadCount, connect, markAllAsRead } = useNotificationStore();
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    connect();
  }, [connect]);

  return (
    <header className="flex items-center justify-between px-6 py-3.5 glass border-b border-white/[0.06] shrink-0">
      {/* Page Title */}
      <div>
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass text-xs text-foreground">
          <motion.div
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-neutral-500"}`}
            animate={connected ? { scale: [1, 1.3, 1], opacity: [1, 0.7, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="hidden sm:inline font-sans font-bold tracking-wide uppercase">
            {connected ? "LIVE" : "OFFLINE"}
          </span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            id="topbar-notif-btn"
            onClick={() => {
              setShowDropdown(!showDropdown);
              if (!showDropdown) markAllAsRead();
            }}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg glass text-muted-foreground hover:text-foreground transition-colors"
          >
            <TbBell className="w-4 h-4" />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#0D0D0D]"
                />
              )}
            </AnimatePresence>
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto glass border border-white/10 rounded-xl shadow-2xl z-50 p-2"
              >
                <div className="px-3 py-2 pb-3 mb-2 border-b border-white/[0.06]">
                  <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                </div>
                
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-3 rounded-lg hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/[0.06]">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${n.type === 'SUCCESS' ? 'bg-emerald-500' : n.type === 'ERROR' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                          <div>
                            <p className="text-sm text-foreground leading-snug">{n.message}</p>
                            <span className="text-xs text-muted-foreground mt-1 block">
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Logout */}
        <button
          id="topbar-logout-btn"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center justify-center w-8 h-8 rounded-lg glass text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          title="Logout"
        >
          <TbLogout className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
