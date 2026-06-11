// WorkoutCardSkeleton.tsx
// Placeholder card rendered while posts are loading.
// Matches the approximate shape of a real WorkoutCard so the layout
// doesn't jump when real content arrives.

import { Skeleton } from './ui/skeleton';

export function WorkoutCardSkeleton() {
  return (
    <div className="rounded-xl border border-[rgba(201,169,110,0.08)] bg-[#0d0b08] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
        <Skeleton className="h-6 w-16 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 px-4 py-3 bg-[rgba(201,169,110,0.04)] mx-4 rounded-xl">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded" />
            <div className="space-y-1">
              <Skeleton className="h-2.5 w-12 rounded" />
              <Skeleton className="h-3.5 w-8 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Exercises */}
      <div className="px-4 pt-3 pb-1 space-y-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex justify-between px-3 py-2">
            <Skeleton className="h-3.5 w-28 rounded" />
            <Skeleton className="h-3.5 w-20 rounded" />
          </div>
        ))}
      </div>

      {/* Caption */}
      <div className="px-4 py-3 space-y-2">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-3/4 rounded" />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-1 border-t border-[rgba(201,169,110,0.08)]">
        <Skeleton className="h-8 w-14 rounded-md" />
        <Skeleton className="h-8 w-14 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-14 rounded-md ml-auto" />
      </div>
    </div>
  );
}
