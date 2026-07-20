"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  TbLayoutDashboard,
  TbGraph,
  TbMessageCircle,
  TbCloudUpload,
  TbChartBar,
  TbSettings,
  TbChevronLeft,
  TbChevronRight,
} from "react-icons/tb";

const navItems = [
  { label: "Workspace",       href: "/dashboard",          icon: TbLayoutDashboard },
  { label: "Graph Explorer",  href: "/dashboard/graph",    icon: TbGraph },
  { label: "AI Chat",         href: "/dashboard/chat",     icon: TbMessageCircle },
  { label: "Upload Center",   href: "/dashboard/upload",   icon: TbCloudUpload },
  { label: "Graph Analytics", href: "/dashboard/analytics",icon: TbChartBar },
];

const bottomItems = [
  { label: "Settings", href: "/dashboard/settings", icon: TbSettings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { data: session } = useSession();

  return (
    <aside className={`h-full flex flex-col glass border-r border-white/[0.06] shrink-0 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      {/* Logo & Toggle */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-4 py-5 border-b border-white/[0.06]`}>
        {!isCollapsed && (
          <Link href="/">
            <div className="px-2 cursor-pointer">
              <p className="text-lg font-bold text-foreground tracking-tighter">GraphMind</p>
              <p className="text-[10px] text-muted-foreground font-sans font-semibold uppercase tracking-widest">AI Platform</p>
            </div>
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-white/[0.05] hover:text-foreground transition-colors"
        >
          {isCollapsed ? <TbChevronRight className="w-5 h-5" /> : <TbChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} title={isCollapsed ? item.label : undefined}>
              <motion.div
                whileHover={{ x: isCollapsed ? 0 : 3 }}
                transition={{ duration: 0.15 }}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-none text-sm font-medium transition-all duration-150 cursor-pointer border-l-2
                  ${isActive
                    ? "bg-foreground text-background border-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                  }
                  ${isCollapsed ? 'justify-center !px-0' : ''}
                `}
              >
                <item.icon className={`w-4.5 h-4.5 shrink-0`} />
                {!isCollapsed && <span>{item.label}</span>}
                {!isCollapsed && isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-background"
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-4 border-t border-white/[0.06] space-y-1">
        {bottomItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} title={isCollapsed ? item.label : undefined}>
              <div className={`
                flex items-center gap-3 px-3 py-2.5 rounded-none text-sm font-medium transition-all duration-150 cursor-pointer border-l-2
                ${isActive
                  ? "bg-foreground text-background border-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                }
                ${isCollapsed ? 'justify-center !px-0' : ''}
              `}>
                <item.icon className="w-4.5 h-4.5 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}

        {/* User Badge */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-3 mt-2 rounded-none border border-border`}>
          {session?.user?.image ? (
            <img src={session.user.image} alt={session.user.name || "User"} className="w-8 h-8 rounded-full shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center text-background text-xs font-bold font-sans tracking-tight shrink-0">
              {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U"}
            </div>
          )}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{session?.user?.name || "User"}</p>
              <p className="text-[10px] text-muted-foreground font-sans font-semibold uppercase tracking-widest truncate">
                {session?.user?.email || "Signed In"}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
