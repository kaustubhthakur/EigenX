/** Public info about a player as shown in world chat (no email). */
export interface WorldUser {
  user_id: string | number;
  username: string;
  avatar: string | null;
  is_online: boolean;
  last_seen: string | null;
  top_score: number;
  xp: number;
  level: number;
}

export interface WorldProfile extends WorldUser {
  created_at: string;
}

export interface WorldMessage extends WorldUser {
  id: string | number; // BIGSERIAL, so Postgres may return a string
  content: string;
  created_at: string;
}

export interface WorldDuelRequest {
  id: string | number;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  duel_id: string | number | null;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
  sender_id: string | number;
  sender_username: string;
  sender_avatar: string | null;
  sender_level: number;
  receiver_id: string | number;
  receiver_username: string;
  receiver_avatar: string | null;
  receiver_level: number;
}

export interface WorldMessagesResponse {
  messages: WorldMessage[];
}
export interface WorldPostMessageResponse {
  message: WorldMessage;
}
export interface WorldOnlineResponse {
  users: WorldUser[];
}
export interface WorldProfileResponse {
  profile: WorldProfile;
}
export interface WorldRequestResponse {
  request: WorldDuelRequest;
}
export interface WorldRequestsResponse {
  requests: WorldDuelRequest[];
}
export interface WorldAcceptResponse {
  requestId: string | number;
  duelId: string | number;
}