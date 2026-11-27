"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { User, UserRole } from "@/types";
import { DEMO_PASSWORD_HASH, sha256 } from "@/lib/hash";

export const DEMO_USER_ID = "user-demo-admin";

export const SEED_USERS: User[] = [
  {
    id: DEMO_USER_ID,
    name: "Alex Morgan",
    email: "demo@demo.com",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "super_admin",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "user-fleet-manager",
    name: "Farhana Rahman",
    email: "manager@demo.com",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "fleet_manager",
    createdAt: "2026-01-05T00:00:00.000Z",
  },
  {
    id: "user-dispatcher",
    name: "Sarah Chen",
    email: "dispatch@demo.com",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "dispatcher",
    createdAt: "2026-01-10T00:00:00.000Z",
  },
  {
    id: "user-mechanic",
    name: "Kamrul Islam",
    email: "mechanic@demo.com",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "mechanic",
    createdAt: "2026-01-12T00:00:00.000Z",
  },
  {
    id: "user-driver",
    name: "Marcus Vance",
    email: "driver@demo.com",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "driver",
    assignedVehicleId: "veh-1",
    driverId: "drv-1",
    createdAt: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "user-employee",
    name: "Nadia Karim",
    email: "user@demo.com",
    passwordHash: DEMO_PASSWORD_HASH,
    role: "employee",
    createdAt: "2026-01-20T00:00:00.000Z",
  },
];

export const DEMO_ACCOUNTS: Array<{
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tagline: string;
  assignedVehicleId?: string;
}> = [
  {
    id: DEMO_USER_ID,
    name: "Alex Morgan",
    email: "demo@demo.com",
    role: "super_admin",
    tagline: "Full RBAC, telemetry, analytics & audit control",
  },
  {
    id: "user-fleet-manager",
    name: "Farhana Rahman",
    email: "manager@demo.com",
    role: "fleet_manager",
    tagline: "Fleet operations, approvals, fuel & TCO reports",
  },
  {
    id: "user-dispatcher",
    name: "Sarah Chen",
    email: "dispatch@demo.com",
    role: "dispatcher",
    tagline: "Assign drivers, live GPS radar & bookings queue",
  },
  {
    id: "user-mechanic",
    name: "Kamrul Islam",
    email: "mechanic@demo.com",
    role: "mechanic",
    tagline: "Work orders, service rules & incident logs",
  },
  {
    id: "user-driver",
    name: "Marcus Vance",
    email: "driver@demo.com",
    role: "driver",
    tagline: "Assigned to Atlas Hauler 01 (FP-8421)",
    assignedVehicleId: "veh-1",
  },
  {
    id: "user-employee",
    name: "Nadia Karim",
    email: "user@demo.com",
    role: "employee",
    tagline: "Request trips & track assigned driver live",
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
    password: string,
    role?: UserRole
  ) => Promise<string | null>;
  loginAsDemo: (role?: UserRole) => void;
  switchAccount: (userId: string) => void;
  switchRole: (role: UserRole) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  logout: () => void;
}

function normalizeUsers(rawUsers: unknown): User[] {
  if (!Array.isArray(rawUsers) || rawUsers.length === 0) {
    return SEED_USERS;
  }
  const normalized: User[] = (rawUsers as Partial<User>[]).map((u) => {
    const seedMatch = SEED_USERS.find((s) => s.email === u.email);
    return {
      id: u.id ?? seedMatch?.id ?? `user-${crypto.randomUUID()}`,
      name: u.name ?? seedMatch?.name ?? "User",
      email: u.email ?? "user@demo.com",
      passwordHash: u.passwordHash ?? DEMO_PASSWORD_HASH,
      role: (u.role ?? seedMatch?.role ?? "super_admin") as UserRole,
      assignedVehicleId: u.assignedVehicleId ?? seedMatch?.assignedVehicleId,
      driverId: u.driverId ?? seedMatch?.driverId,
      createdAt: u.createdAt ?? "2026-01-01T00:00:00.000Z",
    };
  });

  for (const seed of SEED_USERS) {
    if (!normalized.some((u) => u.email === seed.email)) {
      normalized.push(seed);
    }
  }
  return normalized;
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

      register: async (name, email, password, role = "fleet_manager") => {
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
          role,
          assignedVehicleId: role === "driver" ? "veh-1" : undefined,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          users: [...state.users, newUser],
          currentUserId: newUser.id,
        }));
        return null;
      },

      loginAsDemo: (role) => {
        const targetRole = role ?? "super_admin";
        const match = get().users.find((u) => u.role === targetRole);
        if (match) {
          set({ currentUserId: match.id });
        } else {
          const normalized = normalizeUsers(get().users);
          const fallback =
            normalized.find((u) => u.role === targetRole) ?? normalized[0];
          set({
            users: normalized,
            currentUserId: fallback?.id ?? DEMO_USER_ID,
          });
        }
      },

      switchAccount: (userId) => {
        const target = get().users.find((u) => u.id === userId);
        if (target) {
          set({ currentUserId: target.id });
        }
      },

      switchRole: (role) => {
        const target = get().users.find((u) => u.role === role);
        if (target) {
          set({ currentUserId: target.id });
        }
      },

      updateUserRole: (userId, role) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === userId ? { ...u, role } : u
          ),
        }));
      },

      logout: () => {
        set({ currentUserId: null });
      },
    }),
    {
      name: "tf-auth",
      version: 4,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<AuthState>;
        return {
          users: normalizeUsers(state.users),
          currentUserId:
            typeof state.currentUserId === "string"
              ? state.currentUserId
              : null,
        };
      },
    }
  )
);
