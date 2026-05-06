export type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type UserRole = "admin" | (string & {});

export type KnownAdminRole = "super_admin" | "operations_manager" | "content_manager" | "business_manager";

export type AdminRole = KnownAdminRole | (string & {});
