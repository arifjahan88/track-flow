"use client";

import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import {
  ALL_PERMISSIONS,
  ALL_ROLES,
  can,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "@/lib/rbac";
import type { UserRole } from "@/types";

export function RbacTab({
  currentRole,
  canManageRbac,
}: {
  currentRole: UserRole;
  canManageRbac: boolean;
}) {
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const switchRole = useAuthStore((s) => s.switchRole);
  const updateUserRole = useAuthStore((s) => s.updateUserRole);
  const logAudit = useFleetStore((s) => s.logAudit);

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Quick Role Switcher (Demo)</CardTitle>
          <CardDescription>
            Test Role-Based Access Control instantly by switching between the 5
            fleet roles. Restricted actions update across the entire app.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ALL_ROLES.map((role) => {
            const active = currentRole === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  switchRole(role);
                  toast.success(`Switched active role to ${ROLE_LABELS[role]}`);
                }}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <p className="text-sm font-semibold text-foreground">
                  {ROLE_LABELS[role]}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">
            Workspace Users &amp; Role Assignment
          </CardTitle>
          <CardDescription>
            {canManageRbac
              ? "Assign roles to team members. Every change is logged in the Audit Trail."
              : "Read-only view — Super Admin privileges are required to modify user roles."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.name}
                      {u.id === currentUserId ? (
                        <Badge
                          variant="outline"
                          className="ml-2 rounded-md text-[10px]"
                        >
                          You
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        items={ROLE_LABELS}
                        disabled={!canManageRbac}
                        onValueChange={(nextRole) => {
                          if (!nextRole) return;
                          updateUserRole(u.id, nextRole as UserRole);
                          logAudit(
                            "rbac.role_updated",
                            "rbac",
                            `Changed ${u.name}'s role to ${ROLE_LABELS[nextRole as UserRole]}`,
                            u.id
                          );
                          toast.success(
                            `Updated ${u.name} to ${ROLE_LABELS[nextRole as UserRole]}.`
                          );
                        }}
                      >
                        <SelectTrigger className="w-44" size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Permission Matrix</CardTitle>
          <CardDescription>
            Enforced capabilities across Super Admin, Fleet Manager, Dispatcher,
            Mechanic, and Driver roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Capability</TableHead>
                  {ALL_ROLES.map((r) => (
                    <TableHead key={r} className="text-center">
                      {ROLE_LABELS[r]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_PERMISSIONS.map((perm) => (
                  <TableRow key={perm.key}>
                    <TableCell className="font-medium">{perm.label}</TableCell>
                    {ALL_ROLES.map((r) => (
                      <TableCell key={r} className="text-center">
                        {can(r, perm.key) ? (
                          <Check className="mx-auto h-4 w-4 text-[var(--brand-teal)]" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
