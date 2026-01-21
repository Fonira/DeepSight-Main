import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { AbyssalCreatures } from "./AbyssalCreatures";
import { useAuth } from "../hooks/useAuth";

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen relative overflow-hidden">
      <AbyssalCreatures />

      <Sidebar
        user={
          user
            ? {
                username: user.username,
                credits: user.credits,
                plan: user.plan || "free",
                is_admin: user.is_admin || false,
              }
            : undefined
        }
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-auto lg:ml-[280px]">
        <Outlet />
      </main>
    </div>
  );
};
