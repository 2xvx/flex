// skeleton.tsx — shimmer placeholder shapes used while content is loading
import { ReactNode } from 'react';
import { cn } from './utils';

// ── Base shadcn-compatible Skeleton (kept for any shadcn consumers) ────────────
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('skeleton rounded-xl', className)}
      {...props}
    />
  );
}
export { Skeleton };

// ── Flex-specific skeleton variants ──────────────────────────────────────────

/** Single text line */
export function SkeletonLine({ width = 'w-full', height = 'h-3', className = '' }: { width?: string; height?: string; className?: string }) {
  return <div className={`skeleton ${height} ${width} rounded-lg ${className}`} />;
}

/** Circle (avatar, icon) */
export function SkeletonCircle({ size = 'w-10 h-10', className = '' }: { size?: string; className?: string }) {
  return <div className={`skeleton ${size} rounded-full ${className}`} />;
}

/** Stacked lines mimicking a paragraph */
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  const widths = ['w-full', 'w-5/6', 'w-4/6', 'w-3/4', 'w-2/3'];
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} width={widths[i % widths.length]} />
      ))}
    </div>
  );
}

/** Stat block: big number + label below */
export function SkeletonStat({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 py-3 bg-[rgba(201,169,110,0.03)] rounded-xl ${className}`}>
      <div className="skeleton h-6 w-10 rounded-lg" />
      <div className="skeleton h-2.5 w-14 rounded-md" />
    </div>
  );
}

/** Full post card skeleton — matches WorkoutCard layout */
export function PostCardSkeleton({ hideImage = false }: { hideImage?: boolean }) {
  return (
    <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.06)] rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <SkeletonCircle size="w-10 h-10" />
        <div className="flex-1 space-y-1.5">
          <SkeletonLine width="w-32" height="h-3" />
          <SkeletonLine width="w-20" height="h-2.5" />
        </div>
      </div>
      <SkeletonText lines={2} />
      {!hideImage && <div className="skeleton h-48 w-full rounded-xl" />}
      <div className="flex gap-4 pt-1">
        <div className="skeleton h-4 w-12 rounded-md" />
        <div className="skeleton h-4 w-12 rounded-md" />
        <div className="skeleton h-4 w-8 rounded-md" />
      </div>
    </div>
  );
}

/** Leaderboard row skeleton */
export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
      <div className="skeleton w-7 h-7 rounded-full shrink-0" />
      <div className="skeleton w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton h-3 rounded-lg" style={{ width: '55%' }} />
        <div className="skeleton h-2 w-16 rounded-md" />
      </div>
      <div className="skeleton h-4 w-14 rounded-md" />
    </div>
  );
}

/** Profile header skeleton */
export function ProfileHeaderSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-6 pb-4">
      <div className="flex items-end gap-4">
        <SkeletonCircle size="w-20 h-20" />
        <div className="flex-1 space-y-2 pb-1">
          <SkeletonLine width="w-36" height="h-4" />
          <SkeletonLine width="w-24" height="h-3" />
        </div>
      </div>
      <SkeletonText lines={2} />
      <div className="grid grid-cols-3 gap-3">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>
    </div>
  );
}

/** Wraps children with a skeleton shown while loading */
export function SkeletonGuard({ loading, skeleton, children }: {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  return loading ? <>{skeleton}</> : <>{children}</>;
}
