
export interface Friend {
  id: string;
  username: string;
  avatar: string | null;
  level: number;
  top_score: number;
  is_online: boolean;
}

export interface PendingRequest {
  id: string;
  username: string;
  avatar: string | null;
}
