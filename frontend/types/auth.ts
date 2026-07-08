export type Role = "driver" | "insurer" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  licenseNo?: string;   // driver
  companyId?: string;   // insurer
  avatarInitials?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthApiResponse {
  user: AuthUser;
  token: string;
}
