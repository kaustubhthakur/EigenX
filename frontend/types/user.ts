export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  xp: number;
  score?: number;
  level: number;
  createdAt?: string;
}

export interface ProfileResponse {
  success: boolean;
  message?: string;
  user: UserProfile;
}

export interface UpdateScorePayload {
  score: number;
  xp: number;
}