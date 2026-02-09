/**
 * DEEP SIGHT v8.0 — Dashboard Layout
 * Smooth sidebar, responsive, animated transitions
 */

import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { motion } from 'framer-motion';
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Footer } from "../Footer";
import { useAuth } from "../../hooks/useAuth";

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg-primary">
      {/* Mobile hamburger */}
      <motion.button
        onClick={() => setMobileMenuOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-lg bg-bg-elevated/90 backdrop-blur-xl border border-border-default flex items-center justify-center text-text-secondary hover:text-text-primary transition-all shadow-md"
        whileTap={{ scale: 0.95 }}
        aria-label="Open menu"
        aria-expanded={mobileMenuOpen}
      >
        <Menu className="w-4.5 h-4.5" />
      </motion.button>

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ease-out ${
          sidebarCollapsed ? 'lg:ml-[60px]' : 'lg:ml-[240px]'
        }`}
      >
        <main
          id="main-content"
          className="flex-1 overflow-y-auto pb-20 lg:pb-0 pt-14 lg:pt-0"
          role="main"
        >
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            {children || <Outlet />}
          </motion.div>
        </main>

        {/* Footer - Desktop */}
        <div className="hidden lg:block">
          <Footer />
        </div>
      </div>

      {/* BottomNav - Mobile */}
      <BottomNav />
    </div>
  );
};
