import type { AdminRole, UserRole } from "@/types/common.types";

export type ApiErrorResponse = {
  success: false;
  error?: string;
  message?: string;
};

export type ApiSuccessResponse = {
  success: true;
  message?: string;
};

export type AdminSession = {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  adminRole: AdminRole;
  signedInAt: string;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  fullName: string;
  phone: string | null;
  address: string | null;
  role: UserRole;
  adminRole: AdminRole;
  status: string;
  avatar_url: string | null;
  emailVerified: boolean;
  createdAt: string;
};

export type LoginApiResponse = ApiSuccessResponse & {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  session: AdminSession;
  user: AdminUser;
};

export type RefreshTokenApiResponse = ApiSuccessResponse & {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  session: AdminSession;
  user: AdminUser;
};

export type LogoutApiResponse = ApiSuccessResponse;

export type AdminMeApiResponse = ApiSuccessResponse & {
  session: AdminSession;
  user: AdminUser;
  permissions: string[];
};

export type SessionSnapshot = {
  session: AdminSession;
  user: Pick<AdminUser, "id" | "email" | "name" | "fullName" | "adminRole" | "role" | "avatar_url" | "status">;
  permissions: string[];
  expiresAt: string | null;
};
