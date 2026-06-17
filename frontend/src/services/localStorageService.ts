import { WorkoutPost, User } from '../app/types';

const POSTS_STORAGE_KEY = 'fitconnect_posts';
const USERS_STORAGE_KEY = 'fitconnect_users';

// Generate mock data for initial load
const generateMockPosts = (): WorkoutPost[] => {
  const mockUsers: User[] = [
    {
      id: 'user_1',
      name: 'Ahmed Ali',
      username: 'ahmed_ali',
      email: 'ahmed@example.com',
      avatar: 'https://i.pravatar.cc/150?img=12',
      bio: 'Fitness enthusiast 💪',
      followers: 234,
      following: 156,
      workouts: 45,
      fitnessGoal: 'Build Muscle',
      fitnessLevel: 'Intermediate',
      accountType: 'user',
    },
    {
      id: 'user_2',
      name: 'Sarah Johnson',
      username: 'sarah_j',
      email: 'sarah@example.com',
      avatar: 'https://i.pravatar.cc/150?img=47',
      bio: 'Yoga & Strength Training 🧘',
      followers: 189,
      following: 98,
      workouts: 67,
      fitnessGoal: 'Stay Fit',
      fitnessLevel: 'Advanced',
      accountType: 'user',
    },
    {
      id: 'user_3',
      name: 'Mike Chen',
      username: 'mike_chen',
      email: 'mike@example.com',
      avatar: 'https://i.pravatar.cc/150?img=33',
      bio: 'Powerlifting enthusiast 🏋️',
      followers: 456,
      following: 234,
      workouts: 123,
      fitnessGoal: 'Strength',
      fitnessLevel: 'Expert',
      accountType: 'user',
    },
    {
      id: 'user_4',
      name: 'Emma Wilson',
      username: 'emma_w',
      email: 'emma@example.com',
      avatar: 'https://i.pravatar.cc/150?img=20',
      bio: 'Cardio lover 🏃‍♀️',
      followers: 312,
      following: 178,
      workouts: 89,
      fitnessGoal: 'Weight Loss',
      fitnessLevel: 'Intermediate',
      accountType: 'user',
    },
    {
      id: 'user_5',
      name: 'David Martinez',
      username: 'david_m',
      email: 'david@example.com',
      avatar: 'https://i.pravatar.cc/150?img=15',
      bio: 'CrossFit athlete 💥',
      followers: 567,
      following: 289,
      workouts: 156,
      fitnessGoal: 'Endurance',
      fitnessLevel: 'Advanced',
      accountType: 'user',
    },
  ];

  const mockPosts: WorkoutPost[] = [
    {
      id: 'post_1',
      user: mockUsers[0],
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      workoutType: 'Upper Body',
      duration: 75,
      calories: 520,
      exercises: [
        { id: 'ex1', name: 'Bench Press', sets: 4, reps: 8, weight: 185 },
        { id: 'ex2', name: 'Barbell Rows', sets: 4, reps: 10, weight: 155 },
        { id: 'ex3', name: 'Shoulder Press', sets: 3, reps: 12, weight: 95 },
        { id: 'ex4', name: 'Bicep Curls', sets: 3, reps: 15, weight: 35 },
      ],
      caption: 'Great session today! Feeling strong 💪',
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop',
      likes: 24,
      comments: [
        {
          id: 'c1',
          user: mockUsers[1],
          text: 'Amazing work! Keep it up 🔥',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        },
      ],
      isLiked: false,
      likedBy: [],
    },
    {
      id: 'post_2',
      user: mockUsers[1],
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      workoutType: 'Yoga Flow',
      duration: 60,
      calories: 280,
      exercises: [
        { id: 'ex5', name: 'Sun Salutation', sets: 5, reps: 1, duration: 300 },
        { id: 'ex6', name: 'Warrior Poses', sets: 3, reps: 1, duration: 180 },
        { id: 'ex7', name: 'Tree Pose', sets: 2, reps: 1, duration: 120 },
      ],
      caption: 'Morning yoga session to start the day right 🧘✨',
      image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=600&fit=crop',
      likes: 18,
      comments: [],
      isLiked: false,
      likedBy: [],
    },
    {
      id: 'post_3',
      user: mockUsers[2],
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      workoutType: 'Leg Day',
      duration: 90,
      calories: 680,
      exercises: [
        { id: 'ex8', name: 'Squats', sets: 5, reps: 5, weight: 315 },
        { id: 'ex9', name: 'Deadlifts', sets: 4, reps: 5, weight: 405 },
        { id: 'ex10', name: 'Leg Press', sets: 4, reps: 12, weight: 540 },
        { id: 'ex11', name: 'Romanian Deadlifts', sets: 3, reps: 8, weight: 275 },
      ],
      caption: 'New PR on deadlifts! 405lbs 🏋️‍♂️',
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop',
      likes: 67,
      comments: [
        {
          id: 'c2',
          user: mockUsers[0],
          text: 'Incredible! That\'s a huge milestone!',
          timestamp: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'c3',
          user: mockUsers[4],
          text: 'Beast mode activated! 🔥',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        },
      ],
      isLiked: false,
      likedBy: [],
    },
    {
      id: 'post_4',
      user: mockUsers[3],
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      workoutType: 'Cardio',
      duration: 45,
      calories: 420,
      exercises: [
        { id: 'ex12', name: 'Running', sets: 1, reps: 1, duration: 2700 },
        { id: 'ex13', name: 'Burpees', sets: 3, reps: 15, duration: 60 },
        { id: 'ex14', name: 'Mountain Climbers', sets: 3, reps: 20, duration: 45 },
      ],
      caption: 'Morning run in the park! 5K done ✅',
      image: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&h=600&fit=crop',
      likes: 31,
      comments: [],
      isLiked: false,
      likedBy: [],
    },
    {
      id: 'post_5',
      user: mockUsers[4],
      timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      workoutType: 'CrossFit',
      duration: 60,
      calories: 580,
      exercises: [
        { id: 'ex15', name: 'Box Jumps', sets: 5, reps: 10 },
        { id: 'ex16', name: 'Pull-ups', sets: 4, reps: 12 },
        { id: 'ex17', name: 'Kettlebell Swings', sets: 4, reps: 20, weight: 53 },
        { id: 'ex18', name: 'Planks', sets: 3, reps: 1, duration: 60 },
      ],
      caption: 'WOD complete! Feeling the burn 💥',
      image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=600&fit=crop',
      likes: 42,
      comments: [
        {
          id: 'c4',
          user: mockUsers[2],
          text: 'Great intensity!',
          timestamp: new Date(Date.now() - 17 * 60 * 60 * 1000).toISOString(),
        },
      ],
      isLiked: false,
      likedBy: [],
    },
    {
      id: 'post_6',
      user: mockUsers[0],
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      workoutType: 'Full Body',
      duration: 80,
      calories: 650,
      exercises: [
        { id: 'ex19', name: 'Squats', sets: 4, reps: 10, weight: 225 },
        { id: 'ex20', name: 'Bench Press', sets: 4, reps: 8, weight: 185 },
        { id: 'ex21', name: 'Pull-ups', sets: 3, reps: 12 },
        { id: 'ex22', name: 'Overhead Press', sets: 3, reps: 10, weight: 95 },
      ],
      caption: 'Full body workout complete! Progress is steady 📈',
      image: 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&h=600&fit=crop',
      likes: 28,
      comments: [],
      isLiked: false,
      likedBy: [],
    },
  ];

  return mockPosts;
};

// Initialize posts in localStorage if empty
export const initializePosts = () => {
  const stored = localStorage.getItem(POSTS_STORAGE_KEY);
  if (!stored) {
    const mockPosts = generateMockPosts();
    localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(mockPosts));
    return mockPosts;
  }
  return JSON.parse(stored) as WorkoutPost[];
};

// Get all posts
export const getPosts = async (limitCount: number = 50): Promise<WorkoutPost[]> => {
  try {
    const posts = initializePosts();
    return posts.slice(0, limitCount);
  } catch (error) {
    console.error('Error getting posts:', error);
    return [];
  }
};

// Create a new post
export const createPost = async (post: Partial<WorkoutPost>, userId: string, user: User): Promise<string> => {
  try {
    const posts = JSON.parse(localStorage.getItem(POSTS_STORAGE_KEY) || '[]') as WorkoutPost[];
    
    const newPost: WorkoutPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user: user,
      timestamp: new Date().toISOString(),
      workoutType: post.workoutType || '',
      duration: post.duration || 0,
      calories: post.calories || 0,
      exercises: post.exercises || [],
      caption: post.caption || '',
      image: post.image,
      likes: 0,
      comments: [],
      isLiked: false,
      likedBy: [],
    };

    posts.unshift(newPost); // Add to beginning
    localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
    
    return newPost.id;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create post');
  }
};

// Like a post
export const likePost = async (postId: string, userId: string): Promise<void> => {
  try {
    const posts = JSON.parse(localStorage.getItem(POSTS_STORAGE_KEY) || '[]') as WorkoutPost[];
    const postIndex = posts.findIndex(p => p.id === postId);
    
    if (postIndex === -1) {
      throw new Error('Post not found');
    }

    const post = posts[postIndex];
    const isLiked = post.likedBy?.includes(userId) || false;

    if (isLiked) {
      // Unlike
      post.likes = Math.max(0, post.likes - 1);
      post.likedBy = (post.likedBy || []).filter(id => id !== userId);
      post.isLiked = false;
    } else {
      // Like
      post.likes = (post.likes || 0) + 1;
      post.likedBy = [...(post.likedBy || []), userId];
      post.isLiked = true;
    }

    posts[postIndex] = post;
    localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
  } catch (error: any) {
    throw new Error(error.message || 'Failed to like post');
  }
};

// Unlike a post
export const unlikePost = async (postId: string, userId: string): Promise<void> => {
  return likePost(postId, userId); // Same logic, just toggle
};

// Add comment to post
export const addComment = async (postId: string, comment: any): Promise<void> => {
  try {
    const posts = JSON.parse(localStorage.getItem(POSTS_STORAGE_KEY) || '[]') as WorkoutPost[];
    const postIndex = posts.findIndex(p => p.id === postId);
    
    if (postIndex === -1) {
      throw new Error('Post not found');
    }

    const post = posts[postIndex];
    post.comments = [...(post.comments || []), {
      ...comment,
      timestamp: new Date().toISOString()
    }];

    posts[postIndex] = post;
    localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
  } catch (error: any) {
    throw new Error(error.message || 'Failed to add comment');
  }
};

// Subscribe to posts (simulated with polling or direct access)
export const subscribeToPosts = (limitCount: number = 50, callback: (posts: WorkoutPost[]) => void) => {
  // For local storage, we'll just call the callback immediately
  // In a real app, you might use polling or events
  const posts = initializePosts();
  const postsWithLikes = posts.slice(0, limitCount);
  callback(postsWithLikes);

  // Return a no-op unsubscribe function
  return () => {};
};
