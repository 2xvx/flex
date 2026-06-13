// LeftSidebar.tsx — Option B: Gold Halo Glow
// Features:
//   • Deeper obsidian (#060405) base panel
//   • Radial gold aura halo behind every active nav item
//   • Left indicator bar with gold glow box-shadow
//   • Logo icon with pulsing gold glow ring
//   • Avatar with gold glow ring + gradient fill
//   • Inactive icons slightly warmer; hover reveals dim gold tint
//   • Bottom gradient fade on nav scroll area

import React from "react";
import {
  Home,
  Search,
  Film,
  Dumbbell,
  Salad,
  Users2,
  User,
  LogOut,
  ShieldCheck,
  Bell,
  Settings,
  Briefcase,
  Building2,
} from "lucide-react";
import { User as UserType } from "../types";

interface LeftSidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onSignOut: () => void;
  currentUser: UserType | null;
  onViewProfile?: (uid: string) => void;
  unreadNotifCount?: number;
  onOpenNotifications?: () => void;
  pendingFollowRequestCount?: number;
}

const G1 = "#c9a96e";
const G2 = "#e8c98a";
const OB = "#080608";
const OW = "#f0ebe3";
const BG = "#060405";

const NAV_ITEMS = [
  { id: "feed", label: "Feed", Icon: Home },
  { id: "discover", label: "Discover", Icon: Search },
  { id: "clips", label: "Clips", Icon: Film },
  { id: "train", label: "Train", Icon: Dumbbell },
  { id: "health", label: "Health", Icon: Salad },
  { id: "community", label: "Community", Icon: Users2 },
  { id: "gyms", label: "Find Gyms", Icon: Building2 },
];

function NavBtn({
  id,
  label,
  Icon,
  isActive,
  onClick,
}: {
  id: string;
  label: string;
  Icon: React.ElementType;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        borderRadius: 9,
        background: "transparent",
        border: isActive
          ? "0.5px solid rgba(201,169,110,0.2)"
          : "0.5px solid transparent",
        cursor: "pointer",
        transition: "all 0.2s",
        color: isActive ? OW : "rgba(240,235,227,0.32)",
        fontSize: 13,
        fontWeight: isActive ? 500 : 400,
        letterSpacing: 0.2,
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.color =
            "rgba(240,235,227,0.65)";
          (e.currentTarget as HTMLElement).style.background =
            "rgba(201,169,110,0.04)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.color =
            "rgba(240,235,227,0.32)";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }
      }}
    >
      {isActive && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 28% 50%, rgba(201,169,110,0.22) 0%, transparent 68%)",
            borderRadius: 9,
            pointerEvents: "none",
          }}
        />
      )}
      {isActive && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 2.5,
            height: 18,
            borderRadius: 2,
            background: "linear-gradient(180deg, #c9a96e, #e8c98a)",
            boxShadow: "0 0 10px #c9a96e, 0 0 20px rgba(201,169,110,0.5)",
          }}
        />
      )}
      <Icon
        style={{
          width: 15,
          height: 15,
          flexShrink: 0,
          position: "relative",
          color: isActive ? G1 : "rgba(240,235,227,0.28)",
          filter: isActive
            ? "drop-shadow(0 0 5px rgba(201,169,110,0.6))"
            : "none",
        }}
      />
      <span style={{ position: "relative" }}>{label}</span>
    </button>
  );
}

function SideBtn({
  icon,
  label,
  active = false,
  onClick,
  badge = 0,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 9,
        background: "transparent",
        border: active
          ? "0.5px solid rgba(201,169,110,0.18)"
          : "0.5px solid transparent",
        cursor: "pointer",
        transition: "all 0.2s",
        color: active ? OW : "rgba(240,235,227,0.32)",
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color =
            "rgba(240,235,227,0.65)";
          (e.currentTarget as HTMLElement).style.background =
            "rgba(201,169,110,0.04)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.color =
            "rgba(240,235,227,0.32)";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }
      }}
    >
      {active && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 28% 50%, rgba(201,169,110,0.18) 0%, transparent 68%)",
            borderRadius: 9,
            pointerEvents: "none",
          }}
        />
      )}
      {active && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 2.5,
            height: 16,
            borderRadius: 2,
            background: "linear-gradient(180deg, #c9a96e, #e8c98a)",
            boxShadow: "0 0 8px #c9a96e, 0 0 16px rgba(201,169,110,0.4)",
          }}
        />
      )}
      <span
        style={{
          color: active ? G1 : "rgba(240,235,227,0.28)",
          display: "flex",
          position: "relative",
          filter: active
            ? "drop-shadow(0 0 4px rgba(201,169,110,0.5))"
            : "none",
        }}
      >
        {icon}
      </span>
      <span style={{ position: "relative" }}>{label}</span>
      {badge > 0 && (
        <span
          style={{
            marginLeft: "auto",
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            background: G1,
            color: OB,
            fontSize: 9,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
            boxShadow: "0 0 8px rgba(201,169,110,0.5)",
            position: "relative",
          }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

export function LeftSidebar({
  currentView,
  onNavigate,
  onSignOut,
  currentUser,
  onViewProfile,
  unreadNotifCount = 0,
  onOpenNotifications,
}: LeftSidebarProps) {
  const initials =
    currentUser?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        background: BG,
        borderRight: "0.5px solid rgba(201,169,110,0.14)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "inherit",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "22px 20px 18px",
          borderBottom: "0.5px solid rgba(201,169,110,0.07)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          {/* Hexagon icon — no square container, pure SVG */}
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            style={{
              filter: "drop-shadow(0 0 6px rgba(201,169,110,0.45))",
              flexShrink: 0,
            }}
          >
            {/* Outer hex */}
            <polygon
              points="18,2 32,10 32,26 18,34 4,26 4,10"
              fill="rgba(201,169,110,0.07)"
              stroke="#c9a96e"
              strokeWidth="1"
            />
            {/* Inner hex */}
            <polygon
              points="18,8 27,13 27,23 18,28 9,23 9,13"
              fill="rgba(201,169,110,0.1)"
            />
            {/* FX text */}
            <text
              x="18"
              y="23"
              fontFamily="Georgia,serif"
              fontSize="12"
              fontWeight="700"
              fill="#c9a96e"
              textAnchor="middle"
            >
              FX
            </text>
          </svg>
          <div>
            <p
              style={{
                fontSize: 12,
                letterSpacing: 6,
                textTransform: "uppercase",
                color: "rgba(201,169,110,0.9)",
                fontWeight: 400,
                lineHeight: 1.1,
                marginBottom: 3,
                textShadow: "0 0 12px rgba(201,169,110,0.35)",
              }}
            >
              Flex
            </p>
            <p
              style={{
                fontSize: 7,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                color: "rgba(240,235,227,0.22)",
                lineHeight: 1,
              }}
            >
              Elite Fitness Platform
            </p>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav
        style={{
          flex: 1,
          padding: "12px 10px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 1,
          maskImage:
            "linear-gradient(to bottom, black calc(100% - 24px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black calc(100% - 24px), transparent 100%)",
        }}
      >
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <NavBtn
            key={id}
            id={id}
            label={label}
            Icon={Icon}
            isActive={currentView === id}
            onClick={() => onNavigate(id)}
          />
        ))}

        {(currentUser as any)?.role === "gym" && (
          <>
            <div
              style={{
                margin: "8px 2px",
                height: 0.5,
                background: "rgba(201,169,110,0.07)",
              }}
            />
            <NavBtn
              id="gym-hub"
              label="Gym Dashboard"
              Icon={Building2}
              isActive={currentView === "gym-hub"}
              onClick={() => onNavigate("gym-hub")}
            />
          </>
        )}

        {currentUser?.accountType === "trainer" && (
          <>
            <div
              style={{
                margin: "8px 2px",
                height: 0.5,
                background: "rgba(201,169,110,0.07)",
              }}
            />
            <button
              onClick={() => onNavigate("trainer-hub")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                borderRadius: 9,
                background: "transparent",
                border:
                  currentView === "trainer-hub"
                    ? "0.5px solid rgba(201,169,110,0.2)"
                    : "0.5px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s",
                color:
                  currentView === "trainer-hub" ? OW : "rgba(240,235,227,0.32)",
                fontSize: 13,
                fontWeight: currentView === "trainer-hub" ? 500 : 400,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {currentView === "trainer-hub" && (
                <>
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "radial-gradient(ellipse at 28% 50%, rgba(201,169,110,0.22) 0%, transparent 68%)",
                      borderRadius: 9,
                      pointerEvents: "none",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 2.5,
                      height: 18,
                      borderRadius: 2,
                      background: "linear-gradient(180deg, #c9a96e, #e8c98a)",
                      boxShadow:
                        "0 0 10px #c9a96e, 0 0 20px rgba(201,169,110,0.5)",
                    }}
                  />
                </>
              )}
              <Briefcase
                style={{
                  width: 15,
                  height: 15,
                  flexShrink: 0,
                  position: "relative",
                  color:
                    currentView === "trainer-hub"
                      ? G1
                      : "rgba(240,235,227,0.28)",
                  filter:
                    currentView === "trainer-hub"
                      ? "drop-shadow(0 0 5px rgba(201,169,110,0.6))"
                      : "none",
                }}
              />
              <span style={{ position: "relative" }}>Trainer Hub</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 7,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  padding: "2px 5px",
                  borderRadius: 3,
                  background: "rgba(201,169,110,0.12)",
                  color: G1,
                  position: "relative",
                }}
              >
                Pro
              </span>
            </button>
          </>
        )}



        {currentUser?.accountType === "admin" && (
          <>
            <div
              style={{
                margin: "8px 2px",
                height: 0.5,
                background: "rgba(201,169,110,0.07)",
              }}
            />
            <NavBtn
              id="admin"
              label="Admin"
              Icon={ShieldCheck}
              isActive={currentView === "admin"}
              onClick={() => onNavigate("admin")}
            />
          </>
        )}
      </nav>

      {/* User row */}
      <div
        style={{
          borderTop: "0.5px solid rgba(201,169,110,0.08)",
          padding: "10px 10px 4px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            marginBottom: 2,
          }}
        >
          {currentUser?.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name || ""}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
                border: "1.5px solid rgba(201,169,110,0.45)",
                boxShadow:
                  "0 0 10px rgba(201,169,110,0.35), 0 0 20px rgba(201,169,110,0.15)",
              }}
            />
          ) : (
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                flexShrink: 0,
                background: "linear-gradient(135deg, #c9a96e, #8b6914)",
                border: "1.5px solid rgba(201,169,110,0.45)",
                boxShadow:
                  "0 0 12px rgba(201,169,110,0.4), 0 0 24px rgba(201,169,110,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                color: OB,
              }}
            >
              {initials}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: OW,
                margin: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentUser?.name}
            </p>
            <p
              style={{
                fontSize: 10,
                color: "rgba(240,235,227,0.28)",
                margin: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              @{currentUser?.username}
            </p>
          </div>
          {currentUser?.accountType && currentUser.accountType !== "user" && (
            <span
              style={{
                fontSize: 7,
                letterSpacing: 1,
                textTransform: "uppercase",
                padding: "2px 5px",
                borderRadius: 3,
                flexShrink: 0,
                background: "rgba(201,169,110,0.12)",
                color: G1,
                boxShadow: "0 0 6px rgba(201,169,110,0.2)",
              }}
            >
              {currentUser.accountType}
            </span>
          )}
        </div>

        <SideBtn
          icon={<User style={{ width: 14, height: 14 }} />}
          label="Profile"
          active={currentView === "profile"}
          onClick={() => {
            if (currentUser?.id && onViewProfile) onViewProfile(currentUser.id);
            else onNavigate("profile");
          }}
        />
        <SideBtn
          icon={
            <div style={{ position: "relative" }}>
              <Bell style={{ width: 14, height: 14 }} />
              {unreadNotifCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    width: 13,
                    height: 13,
                    borderRadius: "50%",
                    background: G1,
                    color: OB,
                    fontSize: 7,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 8px rgba(201,169,110,0.6)",
                  }}
                >
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </div>
          }
          label="Notifications"
          badge={unreadNotifCount}
          onClick={onOpenNotifications}
        />
      </div>

      {/* Settings + Sign out */}
      <div
        style={{
          borderTop: "0.5px solid rgba(201,169,110,0.08)",
          padding: "4px 10px 14px",
        }}
      >
        <SideBtn
          icon={<Settings style={{ width: 14, height: 14 }} />}
          label="Settings"
          active={currentView === "settings"}
          onClick={() => onNavigate("settings")}
        />
        <button
          onClick={onSignOut}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            borderRadius: 9,
            background: "transparent",
            border: "0.5px solid transparent",
            cursor: "pointer",
            transition: "all 0.2s",
            color: "rgba(240,235,227,0.2)",
            fontSize: 13,
            fontWeight: 400,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#e05c5c";
            (e.currentTarget as HTMLElement).style.background =
              "rgba(224,92,92,0.05)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "rgba(240,235,227,0.2)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <LogOut style={{ width: 14, height: 14, flexShrink: 0 }} />
          Sign out
        </button>
      </div>
    </div>
  );
}
