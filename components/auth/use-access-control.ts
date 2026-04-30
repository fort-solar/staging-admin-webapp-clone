"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  getEffectivePermissionKeys,
  hasPermissionAccess,
  normalizeAdminRole,
  type PermissionAction,
  type PermissionDescriptor,
  type PermissionResource,
} from "@/lib/auth/access-control";

const emptyPermissions: string[] = [];

export function useAccessControl() {
  const { session } = useAuth();
  const role = normalizeAdminRole(session?.session.adminRole ?? session?.user.adminRole);
  const permissions = session?.permissions ?? emptyPermissions;
  const effectivePermissions = useMemo(() => getEffectivePermissionKeys(role, permissions), [permissions, role]);

  function can(resource: PermissionResource, action: PermissionAction) {
    return hasPermissionAccess({ resource, action }, role, permissions);
  }

  function canAccess(permission: PermissionDescriptor) {
    return hasPermissionAccess(permission, role, permissions);
  }

  return {
    role,
    permissions,
    effectivePermissions,
    can,
    canAccess,
  };
}
