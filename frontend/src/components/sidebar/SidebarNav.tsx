import React from "react";
import { Video, BookOpen, History, Gem, Settings, Crown } from "lucide-react";
import { SidebarNavItem } from "./SidebarNavItem";

interface SidebarNavProps {
  isAdmin?: boolean;
  onNavigate?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  isAdmin = false,
  onNavigate,
}) => {

  const navItems = [
    { path: "/dashboard", icon: Video, label: "Vidéo" },
    { path: "/playlist", icon: BookOpen, label: "Playlist" },
    { path: "/history", icon: History, label: "Historique" },
    { path: "/upgrade", icon: Gem, label: "Upgrade" },
    { path: "/settings", icon: Settings, label: "Paramètres" },
  ];

  if (isAdmin) {
    navItems.push({ path: "/admin", icon: Crown, label: "Admin" });
  }

  return (
    <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
      {navItems.map((item) => (
        <SidebarNavItem
          key={item.path}
          to={item.path}
          icon={item.icon}
          onClick={onNavigate}
        >
          {item.label}
        </SidebarNavItem>
      ))}
    </nav>
  );
};
