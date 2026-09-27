export type Creator = {
  id: string;
  wallet_address: string | null;
  display_name: string;
  username: string | null;
  email: string | null;
  social_links: Record<string, string>;
  approval_status: "pending" | "approved" | "rejected" | "suspended";
  created_at: string;
};

export type Admin = {
  id: string;
  email: string;
  username: string;
  created_at: string;
};

export type AuthChallenge = {
  challenge_id: string;
  wallet_address: string;
  message: string;
  expires_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  expires_at: string;
  creator: Creator;
};

export type AdminAuthResponse = {
  access_token: string;
  token_type: "bearer";
  expires_at: string;
  admin: Admin;
};
