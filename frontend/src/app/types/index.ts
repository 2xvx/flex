export interface TrainerInfo {
  hourlyRate: number;
  currency: string;
  experience: number;
  specialties: string[];
  sessionTypes: ('online' | 'in-person')[];
  availability: {
    days: string[];
    startTime: string;
    endTime: string;
  };
  trainerBio: string;
  rating?: number;
  totalSessions?: number;
}

export interface Booking {
  id: string;
  trainerId: string;
  trainerName: string;
  clientId: string;
  clientName: string;
  date: string;
  timeSlot: string;
  sessionType: 'online' | 'in-person';
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes: string;
  price: number;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  workouts: number;
  fitnessGoal?: string;
  fitnessLevel?: string;
  gym?: string;
  accountType?: 'user' | 'trainer' | 'gym' | 'admin' | 'store';
  storeName?: string;
  storeCategory?: string;
  storeBio?: string;
  storeApproved?: boolean;
  role?: string;
  createdAt?: string;
  workingOut?: boolean;
  workingOutSince?: string;
  trainerInfo?: TrainerInfo;

  // Trainer specific fields
  trainerApproved?: boolean;
  gymVerified?: boolean;
  clients?: string[];
  workoutPlans?: WorkoutPlan[];

  // Admin specific fields
  adminLevel?: 'super' | 'moderator';

  // Verification / social
  emailVerified?: boolean;
  verified?: boolean;
  savedPosts?: string[];
  blockedUsers?: string[];
  mutedUsers?: string[];

  // Subscription
  subscription?: {
    active: boolean;
    tier: 'free' | 'pro';
    price?: number;
    startedAt?: string;
    renewsAt?: string;
    cancelledAt?: string;
  };

  // Misc
  workoutFrequency?: number;
  currentStreak?: number;
}

export interface WorkoutPlan {
  id: string;
  trainerId: string;
  clientId?: string;
  name: string;
  description: string;
  exercises: Exercise[];
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingSession {
  id: string;
  requesterId: string;
  partnerId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  workoutType: string;
  date: string;
  time: string;
  location?: string;
  notes?: string;
  createdAt: string;
}

export interface ClientProgress {
  id: string;
  clientId: string;
  trainerId: string;
  weight?: number;
  bodyFat?: number;
  measurements?: {
    chest?: number;
    waist?: number;
    arms?: number;
    legs?: number;
  };
  prs?: PersonalRecord[];
  notes?: string;
  checkInDate: string;
  createdAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  duration?: number;
}

export interface WorkoutPost {
  id: string;
  user: User;
  timestamp: string;
  createdAt?: string;
  workoutType: string;
  duration: number;
  calories: number;
  exercises: Exercise[];
  caption: string;
  image?: string;
  videoUrl?: string;
  likes: number;
  comments: Comment[];
  isLiked: boolean;
  likedBy?: string[];
  reactions?: { fire?: number; strong?: number; clap?: number; heart?: number };
  userReaction?: 'fire' | 'strong' | 'clap' | 'heart' | null;
  music?: string;
  isPR?: boolean;
  mood?: number;
  location?: string;
  visibility?: 'public' | 'followers' | 'private';
  userId?: string;
  authorId?: string;
  type?: string;
}

export interface Comment {
  id: string;
  user: User;
  text: string;
  timestamp: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  image: string;
  participants: number;
  duration: string;
  category: string;
  isJoined: boolean;
}

export interface ProgressData {
  date: string;
  weight?: number;
  workouts?: number;
  calories?: number;
}

export interface Badge {
  id: string;
  userId: string;
  type: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
}

export interface Duel {
  id: string;
  challengerId: string;
  challengerName: string;
  challengerAvatar?: string;
  challengerScore: number;
  challengedId: string;
  challengedName: string;
  challengedAvatar?: string;
  challengedScore: number;
  exercise: string;
  goalType: 'reps' | 'weight' | 'workouts';
  goalTarget: number;
  durationDays: number;
  status: 'pending' | 'active' | 'completed' | 'declined';
  winnerId?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'like_hype' | 'trainer_shoutout' | 'duel_request' | 'badge_earned' | 'streak_warning' | 'duel_update' | 'follow_request' | 'follow_accepted';
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, any>;
  createdAt: string;
}

export interface PersonalRecord {
  id: string;
  exercise: string;
  weight: number;
  reps: number;
  date: string;
  improvement?: number;
  userId?: string;
  createdAt?: string;
  timestamp?: string;
  notes?: string;
}
