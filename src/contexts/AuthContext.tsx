import React, { createContext, useContext } from "react";
import type { User } from "../types/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (username: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  value: AuthContextType;
}> = ({ children, value }) => {
  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};
