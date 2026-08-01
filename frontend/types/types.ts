export interface Friend {
  id: string;
  username: string;
  avatar?: string;
  is_online: boolean;
  top_score: number;
  level: number;
}

export interface PendingRequest {
  id: string;        // friend_request id, used to accept
  sender_id: string;
  username: string;
  avatar?: string;
  created_at: string;
}

export interface FriendsResponse {
  success: boolean;
  count: number;
  friends: Friend[];
}

export interface PendingRequestsResponse {
  success: boolean;
  count: number;
  requests: PendingRequest[];
}