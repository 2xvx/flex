import { useState, useEffect, useRef } from "react";
import { Timer } from "lucide-react";
import { Feed }               from "./components/Feed";
import { Login }              from "./components/auth/Login";
import { SignUp }             from "./components/auth/SignUp";
import { OTPVerifyScreen }    from "./components/auth/OTPVerifyScreen";
import { LeftSidebar }        from "./components/LeftSidebar";
import { RightSidebar }       from "./components/RightSidebar";
import { WelcomePage }        from "./components/WelcomePage";
import { Stories }            from "./components/Stories";
import { OnboardingPoll }     from "./components/OnboardingPoll";
import { Toaster }            from "./components/ui/sonner";
import { toast }              from "sonner";
import type { WorkoutPost, User } from "./types/index";
import {
  signIn,
  signUp,
  signOut,
  demoLogin,
  onAuthChange,
} from "../services/authService";
import { initPushNotifications, removePushToken } from "../services/notificationService";
import { dailyLoginXP } from "../services/xpService";
import XPLevelUp from "./components/XPLevelUp";
import { AdminPage }          from "./components/AdminPage";
import { ProfilePage }        from "./components/ProfilePage";
import { NotificationsPanel } from "./components/NotificationsPanel";
import { SettingsPage }       from "./components/SettingsPage";
import { FollowersPage }      from "./components/FollowersPage";
import { ReelsPage }          from "./components/ReelsPage";
import { OnboardingChecklist }from "./components/OnboardingChecklist";
import { PostDetailPage }     from "./components/PostDetailPage";
import { WorkoutTimer }       from "./components/WorkoutTimer";
import { SubscriptionPage }   from "./components/SubscriptionPage";
import { DiscoverPage }       from "./components/DiscoverPage";
import { TrainPage }          from "./components/TrainPage";
import { HealthPage }         from "./components/HealthPage";
import { CommunityPage }      from "./components/CommunityPage";
import { TrainerDashboard }   from "./components/TrainerDashboard";
import { GymDashboard }       from "./components/GymDashboard";
import { GymSignupPage }      from "./components/GymSignupPage";
import { GymsPage }           from "./components/GymsPage";
import { ExplorePage }        from "./components/ExplorePage";
import { CommunitiesPage }    from "./components/CommunitiesPage";

const FULL_HEIGHT_VIEWS = ["community", "clips"];

const NO_RIGHT_SIDEBAR = [
  "community", "clips", "discover", "train", "health",
  "gym-hub", "explore", "communities", "gyms",
];

const KNOWN_VIEWS_LIST = [
  "feed", "profile", "discover", "train", "health", "community", "clips",
  "settings", "admin", "followers", "post", "subscription", "trainer-hub",
  "gym-hub", "gym-signup", "explore", "communities", "gyms",
];

function viewFromPath(path: string): string {
  const seg = path.replace(/^\//, "").split("/")[0].toLowerCase();
  return KNOWN_VIEWS_LIST.includes(seg) ? seg : "feed";
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated]         = useState(false);
  const [currentView, setCurrentView]                 = useState<string>(() => viewFromPath(window.location.pathname));
  const [currentUser, setCurrentUser]                 = useState<User | null>(null);
  const [allPosts, setAllPosts]                       = useState<WorkoutPost[]>([]);
  const [isCreatePostOpen, setIsCreatePostOpen]       = useState(false);
  const [viewingUserId, setViewingUserId]             = useState<string>("");
  const [viewingPostId, setViewingPostId]             = useState<string>("");
  const [followersTab, setFollowersTab]               = useState<"followers" | "following">("followers");
  const [showNotifications, setShowNotifications]     = useState(false);
  const [unreadNotifCount, setUnreadNotifCount]       = useState(0);
  const [pendingFollowRequestCount, setPendingFollowRequestCount] = useState(0);
  const [showWelcome, setShowWelcome]                 = useState(false);
  const [showOnboarding, setShowOnboarding]           = useState(false);
  const [pendingOTP, setPendingOTP]                   = useState<{ user: User; maskedEmail: string } | null>(null);
  const [showTimer, setShowTimer]                     = useState(false);
  const [levelUpInfo, setLevelUpInfo]                 = useState<{ level: number; totalXP: number } | null>(null);
  // hashtag state for Discover
  const [hashtagFilter, setHashtagFilter]             = useState<string | null>(null);

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthChange(async (user: User | null) => {
      if (user) {
        setCurrentUser(user);
        setIsAuthenticated(true);
        try {
          const result = await dailyLoginXP(user.id);
          if (result?.leveledUp) {
            setLevelUpInfo({ level: result.level, totalXP: result.totalXP });
          }
        } catch {}
        try { await initPushNotifications(user.id); } catch {}
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    });
    return () => unsub?.();
  }, []);

  // ── URL sync ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const path = currentView === "feed" ? "/" : `/${currentView}`;
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
  }, [currentView]);

  useEffect(() => {
    const handler = () => setCurrentView(viewFromPath(window.location.pathname));
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navigateTo = (dest: string) => {
    if (dest.startsWith("profile:")) {
      setViewingUserId(dest.slice(8));
      setCurrentView("profile");
      return;
    }
    if (dest.startsWith("post:")) {
      setViewingPostId(dest.slice(5));
      setCurrentView("post");
      return;
    }
    setCurrentView(dest);
  };

  const handleViewProfile = (uid: string) => {
    setViewingUserId(uid);
    navigateTo("profile");
  };

  const handleViewFollowers = (uid: string, tab: "followers" | "following" = "followers") => {
    setViewingUserId(uid);
    setFollowersTab(tab);
    navigateTo("followers");
  };

  // ── Auth handlers ──────────────────────────────────────────────────────────
  const handleLogin = async (email: string, password: string) => {
    try {
      const user = await signIn(email, password);
      setCurrentUser(user);
      setIsAuthenticated(true);
      navigateTo("feed");
    } catch (err: any) {
      throw err; // Let Login.tsx show the inline field error
    }
  };

  const handleDemoLogin = async (accountType: "user" | "trainer" | "admin") => {
    try {
      const user = await demoLogin(accountType);
      setCurrentUser(user);
      setIsAuthenticated(true);
      navigateTo("feed");
    } catch (err: any) {
      toast.error(err.message || "Demo login failed");
    }
  };


  const handleSignUp = async (data: any) => {
    try {
      // SignUp form already created the account — just sign in to get the auth token
      const user = await signIn(data.email, data.password);
      setCurrentUser(user);
      setIsAuthenticated(true);
      const masked = data.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      setPendingOTP({ user, maskedEmail: masked });
    } catch (err: any) {
      toast.error(err.message || "Sign up failed");
    }
  };

  const handleOTPVerified = () => {
    setPendingOTP(null);
    setShowWelcome(true);
    navigateTo("feed");
  };

  const handleLogout = async () => {
    try {
      if (currentUser) await removePushToken(currentUser.id).catch(() => {});
      await signOut();
    } catch {}
    setCurrentUser(null);
    setIsAuthenticated(false);
    setCurrentView("feed");
  };

  // Derived
  const hideRightSidebar = NO_RIGHT_SIDEBAR.includes(currentView);
  const isFullHeight     = FULL_HEIGHT_VIEWS.includes(currentView);

  // ── OTP Verification (after signup, before entering app) ─────────────────────
  if (pendingOTP) {
    return (
      <>
        <Toaster />
        <OTPVerifyScreen
          email={pendingOTP.maskedEmail}
          onVerified={handleOTPVerified}
          // onSkip removed — email verification is mandatory
        />
      </>
    );
  }

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    if (currentView === "signup") {
      return (
        <>
          <Toaster />
          <SignUp
            onSignUp={handleSignUp}
            onSwitchToLogin={() => setCurrentView("login")}
          />
        </>
      );
    }
    return (
      <>
        <Toaster />
        <Login
          onLogin={handleLogin}
          onDemoLogin={handleDemoLogin}
          onSwitchToSignUp={() => setCurrentView("signup")}
        />
      </>
    );
  }

  // ── Authenticated ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080608", color: "#f0ebe3" }}>
      <Toaster />

      {/* XP level-up modal */}
      {levelUpInfo && (
        <XPLevelUp
          level={levelUpInfo.level}
          totalXP={levelUpInfo.totalXP}
          onClose={() => setLevelUpInfo(null)}
        />
      )}

      {/* Welcome modal for new users */}
      {showWelcome && currentUser && (
        <WelcomePage
          currentUser={currentUser}
          onEnter={() => {
            setShowWelcome(false);
            setShowOnboarding(true);
          }}
        />
      )}

      {/* Onboarding fitness poll */}
      {showOnboarding && currentUser && (
        <OnboardingPoll
          currentUser={currentUser}
          onComplete={(updates) => {
            setCurrentUser(prev => prev ? { ...prev, ...updates } : prev);
            setShowOnboarding(false);
          }}
        />
      )}

      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 20% 20%, rgba(201,169,110,0.04) 0%, transparent 70%)," +
            "radial-gradient(ellipse 40% 60% at 80% 80%, rgba(201,169,110,0.03) 0%, transparent 70%)",
        }}
      />

      {/* Three-column layout */}
      <div className="flex flex-1 min-h-0 relative z-10">

        {/* Left sidebar */}
        <LeftSidebar
          currentUser={currentUser}
          currentView={currentView}
          onNavigate={navigateTo}
          onSignOut={handleLogout}
          unreadNotifCount={unreadNotifCount}
          pendingFollowRequestCount={pendingFollowRequestCount}
          onOpenNotifications={() => setShowNotifications(true)}
        />

        {/* Center content */}
        <main
          className={`flex-1 min-w-0 ${isFullHeight ? "overflow-hidden" : "overflow-y-auto"}`}
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(201,169,110,0.15) transparent" }}
        >

          {/* ── Stories — compact strip above feed ── */}
          {currentView === "feed" && currentUser && (
            <div className="border-b border-[rgba(201,169,110,0.06)] px-0">
              <Stories currentUser={currentUser} />
            </div>
          )}

          {/* ── Feed ── */}
          {currentView === "feed" && (
            <Feed
              currentUser={currentUser}
              onPostsLoaded={setAllPosts}
              isCreateDialogOpen={isCreatePostOpen}
              onCreateDialogChange={setIsCreatePostOpen}
              onViewPost={(pid) => { setViewingPostId(pid); navigateTo("post"); }}
            />
          )}

          {/* ── Profile ── */}
          {currentView === "profile" && (
            <ProfilePage
              currentUser={currentUser}
              viewingUserId={viewingUserId || currentUser?.id || ""}
              onNavigate={navigateTo}
              onViewProfile={handleViewProfile}
              onViewFollowers={handleViewFollowers}
            />
          )}

          {/* ── Post detail ── */}
          {currentView === "post" && viewingPostId && (
            <PostDetailPage
              postId={viewingPostId}
              currentUser={currentUser}
              onBack={() => navigateTo("feed")}
            />
          )}

          {/* ── Discover ── */}
          {currentView === "discover" && (
            <DiscoverPage
              currentUser={currentUser}
              onViewProfile={handleViewProfile}
              hashtagFilter={hashtagFilter}
              onHashtag={(tag) => { setHashtagFilter(tag); navigateTo("discover"); }}
              onClearHashtag={() => setHashtagFilter(null)}
            />
          )}

          {/* ── Explore ── */}
          {currentView === "explore" && (
            <ExplorePage
              currentUser={currentUser}
              onViewProfile={handleViewProfile}
            />
          )}

          {/* ── Train ── */}
          {currentView === "train" && (
            <TrainPage currentUser={currentUser} />
          )}

          {/* ── Health ── */}
          {currentView === "health" && (
            <HealthPage currentUser={currentUser} />
          )}

          {/* ── Community ── */}
          {currentView === "community" && (
            <CommunityPage
              currentUser={currentUser}
              onViewProfile={handleViewProfile}
              onNavigate={navigateTo}
              onFollowRequestsViewed={() => setPendingFollowRequestCount(0)}
            />
          )}

          {/* ── Communities ── */}
          {currentView === "communities" && (
            <CommunitiesPage currentUser={currentUser} onNavigate={navigateTo} />
          )}

          {/* ── Clips / Reels ── */}
          {currentView === "clips" && (
            <ReelsPage
              currentUser={currentUser}
              onViewProfile={handleViewProfile}
              onHashtag={(tag) => { setHashtagFilter(tag); navigateTo("discover"); }}
            />
          )}

          {/* ── Followers / Following ── */}
          {currentView === "followers" && (
            <FollowersPage
              currentUser={currentUser}
              viewingUserId={viewingUserId || currentUser?.id || ""}
              initialTab={followersTab}
              onBack={() => navigateTo("profile")}
              onViewProfile={handleViewProfile}
            />
          )}

          {/* ── Settings ── */}
          {currentView === "settings" && (
            <SettingsPage currentUser={currentUser} />
          )}

          {/* ── Admin ── */}
          {currentView === "admin" && currentUser?.accountType === "admin" && (
            <AdminPage currentUser={currentUser} />
          )}

          {/* ── Subscription ── */}
          {currentView === "subscription" && (
            <SubscriptionPage
              currentUser={currentUser}
              onUserUpdated={(updates) =>
                setCurrentUser(prev => prev ? { ...prev, ...updates } : prev)
              }
            />
          )}

          {/* ── Trainer Hub ── */}
          {currentView === "trainer-hub" && currentUser && (
            <TrainerDashboard currentUser={currentUser} onNavigate={navigateTo} />
          )}

          {/* ── Gym Hub (dashboard for verified gym accounts) ── */}
          {currentView === "gym-hub" && currentUser && (
            <GymDashboard
              gymId={currentUser.id}
              onSignOut={handleLogout}
              onBack={() => navigateTo("feed")}
            />
          )}

          {/* ── Gym Signup ── */}
          {currentView === "gym-signup" && (
            <GymSignupPage
              onSuccess={(_uid, _email, _pw) => navigateTo("gym-hub")}
              onBack={() => navigateTo("feed")}
            />
          )}

          {/* ── Gyms directory ── */}
          {currentView === "gyms" && (
            <GymsPage currentUser={currentUser} onNavigate={navigateTo} />
          )}


          {/* ── Fallback ── */}
          {!KNOWN_VIEWS_LIST.includes(currentView) && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] flex items-center justify-center mb-4">
                <span className="text-2xl">🚧</span>
              </div>
              <h2 className="text-white font-semibold text-lg mb-2 capitalize">{currentView}</h2>
              <p className="text-white/40 text-sm max-w-xs">This page is coming soon.</p>
              <button
                onClick={() => navigateTo("feed")}
                className="mt-6 px-5 py-2 rounded-lg bg-[rgba(201,169,110,0.12)] text-[#e8c98a] text-sm font-medium hover:bg-[rgba(201,169,110,0.18)] transition-colors"
              >
                Back to Feed
              </button>
            </div>
          )}

        </main>

        {/* Right sidebar */}
        {!hideRightSidebar && (
          <div className="hidden lg:flex">
            <RightSidebar posts={allPosts} currentUser={currentUser} />
          </div>
        )}

      </div>

      {/* Floating workout timer */}
      {(currentView === "feed" || currentView === "train") && !showTimer && (
        <button
          type="button"
          onClick={() => setShowTimer(true)}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
          style={{ background: "#c9a96e", border: "1px solid rgba(201,169,110,0.5)" }}
        >
          <Timer className="w-5 h-5 text-black" />
        </button>
      )}

      {showTimer && (
        <WorkoutTimer
          onClose={() => setShowTimer(false)}
          onFinish={() => setShowTimer(false)}
          userId={currentUser?.id}
        />
      )}

      {/* Notifications panel */}
      {showNotifications && currentUser && (
        <NotificationsPanel
          userId={currentUser.id}
          onClose={() => setShowNotifications(false)}
          onUnreadCountChange={setUnreadNotifCount}
          onNavigate={navigateTo}
        />
      )}

      {/* Onboarding checklist — feed only */}
      {currentUser && currentView === "feed" && (
        <OnboardingChecklist
          userId={currentUser.id}
          onNavigate={navigateTo}
          onNewPost={() => setIsCreatePostOpen(true)}
        />
      )}

    </div>
  );
}
