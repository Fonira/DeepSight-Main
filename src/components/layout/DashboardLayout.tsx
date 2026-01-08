/**
 * DEEP SIGHT v6.2 — Dashboard Layout
 * 🆕 v6.2: BottomNav pour mobile + safe area
 * 
 * @path src/components/layout/DashboardLayout.tsx
 */

import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Footer } from "../Footer";
import { useAuth } from "../../hooks/useAuth";

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-bg-primary">
      {/* Sidebar - Desktop seulement */}
      <Sidebar
        user={
          user
            ? {
                username: user.username,
                credits: user.credits_remaining ?? user.credits ?? 0,
                plan: user.plan || "free",
                is_admin: user.is_admin || false,
                avatar_url: user.avatar_url || null,
              }
            : undefined
        }
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 lg:ml-[280px] flex flex-col min-h-screen">
        <main 
          id="main-content"
          className="flex-1 overflow-y-auto pb-20 lg:pb-0"
          role="main"
        >
          {children || <Outlet />}
        </main>
        
        {/* Footer - Desktop seulement */}
        <div className="hidden lg:block">
          <Footer />
        </div>
      </div>
      
      {/* BottomNav - Mobile seulement */}
      <BottomNav />
    </div>
  );
};
