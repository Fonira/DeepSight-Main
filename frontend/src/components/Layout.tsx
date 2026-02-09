import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./layout/Sidebar";
import { AbyssalCreatures } from "./AbyssalCreatures";

export const Layout: React.FC = () => {

  return (
    <div className="flex h-screen relative overflow-hidden">
      <AbyssalCreatures />

      <Sidebar />

      <main className="flex-1 overflow-auto lg:ml-[280px]">
        <Outlet />
      </main>
    </div>
  );
};
