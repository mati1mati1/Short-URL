export interface CreateLinkRequest {
  target_url: string;
  expires_at: string;
}
export interface UpdateLinkRequest {
  expires_at?: string;
}
export interface LinkResponse {
  slug: string;
  short_url: string;
  expires_at: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface Link {
  id: string;
  slug: string;
  target_url: string;
  created_at: string;         
  expires_at?: string | null;
  is_active: boolean;
  created_ip_hash?: string | null;
}
