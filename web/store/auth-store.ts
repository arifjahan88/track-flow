"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { User } from "@/types";
import { DEMO_PASSWORD_HASH, sha256 } from "@/lib/hash";

const DEMO_USER_ID = "user-demo-admin";

const SEED_USERS: User[] = [
  {
    id: DEMO_USER_ID,
    name: "Demo Admin",
    email: "demo@demo.com",
    passwordHash: DEMO_PASSWORD_HASH,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AuthState {
  users: User[];
  currentUserId: string | null;
  login: (email: string, password: string) => Promise<string | null>;
  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<string | null>;
  loginAsDemo: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: SEED_USERS,
      currentUserId: null,

      login: async (email, password) => {
        const normalized = email.trim().toLowerCase();
        if (!normalized || !password) {
          return "Enter your email and password.";
        }
        const user = get().users.find(
          (u) => u.email.toLowerCase() === normalized
        );
        if (!user) {
          return "Invalid email or password.";
        }
        const hash = await sha256(password);
        if (hash !== user.passwordHash) {
          return "Invalid email or password.";
        }
        set({ currentUserId: user.id });
        return null;
      },

      register: async (name, email, password) => {
        const trimmedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        if (!trimmedName) {
          return "Name is required.";
        }
        if (!EMAIL_PATTERN.test(normalizedEmail)) {
          return "Enter a valid email address.";
        }
        if (password.length < 6) {
          return "Password must be at least 6 characters.";
        }
        const exists = get().users.some(
          (u) => u.email.toLowerCase() === normalizedEmail
        );
        if (exists) {
          return "An account with this email already exists.";
        }

        const passwordHash = await sha256(password);
        const newUser: User = {
          id: `user-${crypto.randomUUID()}`,
          name: trimmedName,
          email: normalizedEmail,
          passwordHash,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          users: [...state.users, newUser],
          currentUserId: newUser.id,
        }));
        return null;
      },

      loginAsDemo: () => {
        const demo = get().users.find((u) => u.id === DEMO_USER_ID);
        if (demo) {
          set({ currentUserId: demo.id });
        } else {
          set((state) => ({
            users: [...SEED_USERS, ...state.users],
            currentUserId: DEMO_USER_ID,
          }));
        }
      },

      logout: () => {
        set({ currentUserId: null });
      },
    }),
    {
      name: "tf-auth",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    }
  )
);
