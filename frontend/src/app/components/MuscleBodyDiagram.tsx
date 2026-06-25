// MuscleBodyDiagram.tsx — front/back SVG body diagram with muscle highlighting
// Primary muscles: bright fuchsia  |  Secondary: emerald  |  Neither: subtle outline

import { useState } from 'react';

export type MuscleId =
  | 'chest' | 'front_delts' | 'biceps' | 'forearms' | 'abs' | 'obliques'
  | 'hip_flexors' | 'quads' | 'adductors' | 'tibialis'
  | 'traps' | 'lats' | 'rhomboids' | 'rear_delts' | 'triceps'
  | 'lower_back' | 'glutes' | 'hamstrings' | 'calves';

export const ALL_MUSCLES: { id: MuscleId; label: string; view: 'front' | 'back' | 'both' }[] = [
  { id: 'chest',       label: 'Chest',          view: 'front' },
  { id: 'front_delts', label: 'Front Deltoids', view: 'front' },
  { id: 'biceps',      label: 'Biceps',         view: 'front' },
  { id: 'forearms',    label: 'Forearms',       view: 'both'  },
  { id: 'abs',         label: 'Abs',            view: 'front' },
  { id: 'obliques',    label: 'Obliques',       view: 'front' },
  { id: 'hip_flexors', label: 'Hip Flexors',    view: 'front' },
  { id: 'quads',       label: 'Quads',          view: 'front' },
  { id: 'adductors',   label: 'Adductors',      view: 'front' },
  { id: 'tibialis',    label: 'Tibialis',       view: 'front' },
  { id: 'traps',       label: 'Traps',          view: 'back'  },
  { id: 'lats',        label: 'Lats',           view: 'back'  },
  { id: 'rhomboids',   label: 'Rhomboids',      view: 'back'  },
  { id: 'rear_delts',  label: 'Rear Deltoids',  view: 'back'  },
  { id: 'triceps',     label: 'Triceps',        view: 'back'  },
  { id: 'lower_back',  label: 'Lower Back',     view: 'back'  },
  { id: 'glutes',      label: 'Glutes',         view: 'back'  },
  { id: 'hamstrings',  label: 'Hamstrings',     view: 'back'  },
  { id: 'calves',      label: 'Calves',         view: 'back'  },
];

interface MuscleGroup {
  id: MuscleId;
  label: string;
  cx: number; cy: number; rx: number; ry: number;
  rotate?: number;
}

// ── FRONT VIEW muscles (viewBox 0 0 200 400) ─────────────────────────────────
const FRONT_MUSCLES: MuscleGroup[] = [
  { id: 'chest',       label: 'Chest',          cx: 74,  cy: 86,  rx: 24, ry: 22 },
  { id: 'chest',       label: 'Chest',          cx: 126, cy: 86,  rx: 24, ry: 22 },
  { id: 'front_delts', label: 'Front Delts',    cx: 34,  cy: 64,  rx: 17, ry: 19 },
  { id: 'front_delts', label: 'Front Delts',    cx: 166, cy: 64,  rx: 17, ry: 19 },
  { id: 'biceps',      label: 'Biceps',         cx: 20,  cy: 112, rx: 13, ry: 21, rotate: -5 },
  { id: 'biceps',      label: 'Biceps',         cx: 180, cy: 112, rx: 13, ry: 21, rotate: 5  },
  { id: 'forearms',    label: 'Forearms',       cx: 16,  cy: 168, rx: 11, ry: 22, rotate: -3 },
  { id: 'forearms',    label: 'Forearms',       cx: 184, cy: 168, rx: 11, ry: 22, rotate: 3  },
  { id: 'abs',         label: 'Abs',            cx: 100, cy: 126, rx: 22, ry: 18 },
  { id: 'abs',         label: 'Abs',            cx: 100, cy: 158, rx: 20, ry: 14 },
  { id: 'obliques',    label: 'Obliques',       cx: 60,  cy: 142, rx: 13, ry: 24 },
  { id: 'obliques',    label: 'Obliques',       cx: 140, cy: 142, rx: 13, ry: 24 },
  { id: 'hip_flexors', label: 'Hip Flexors',    cx: 76,  cy: 198, rx: 16, ry: 13 },
  { id: 'hip_flexors', label: 'Hip Flexors',    cx: 124, cy: 198, rx: 16, ry: 13 },
  { id: 'quads',       label: 'Quads',          cx: 72,  cy: 254, rx: 21, ry: 36 },
  { id: 'quads',       label: 'Quads',          cx: 128, cy: 254, rx: 21, ry: 36 },
  { id: 'adductors',   label: 'Adductors',      cx: 88,  cy: 252, rx: 11, ry: 30 },
  { id: 'adductors',   label: 'Adductors',      cx: 112, cy: 252, rx: 11, ry: 30 },
  { id: 'tibialis',    label: 'Tibialis',       cx: 66,  cy: 330, rx: 12, ry: 26 },
  { id: 'tibialis',    label: 'Tibialis',       cx: 134, cy: 330, rx: 12, ry: 26 },
];

// ── BACK VIEW muscles (viewBox 0 0 200 400) ──────────────────────────────────
const BACK_MUSCLES: MuscleGroup[] = [
  { id: 'traps',      label: 'Traps',        cx: 76,  cy: 68,  rx: 22, ry: 20 },
  { id: 'traps',      label: 'Traps',        cx: 124, cy: 68,  rx: 22, ry: 20 },
  { id: 'rhomboids',  label: 'Rhomboids',    cx: 100, cy: 90,  rx: 18, ry: 16 },
  { id: 'lats',       label: 'Lats',         cx: 58,  cy: 122, rx: 21, ry: 34 },
  { id: 'lats',       label: 'Lats',         cx: 142, cy: 122, rx: 21, ry: 34 },
  { id: 'rear_delts', label: 'Rear Delts',   cx: 33,  cy: 64,  rx: 17, ry: 19 },
  { id: 'rear_delts', label: 'Rear Delts',   cx: 167, cy: 64,  rx: 17, ry: 19 },
  { id: 'triceps',    label: 'Triceps',      cx: 18,  cy: 112, rx: 13, ry: 22, rotate: -5 },
  { id: 'triceps',    label: 'Triceps',      cx: 182, cy: 112, rx: 13, ry: 22, rotate: 5  },
  { id: 'forearms',   label: 'Forearms',     cx: 15,  cy: 170, rx: 11, ry: 22, rotate: -3 },
  { id: 'forearms',   label: 'Forearms',     cx: 185, cy: 170, rx: 11, ry: 22, rotate: 3  },
  { id: 'lower_back', label: 'Lower Back',   cx: 100, cy: 158, rx: 24, ry: 18 },
  { id: 'glutes',     label: 'Glutes',       cx: 74,  cy: 210, rx: 27, ry: 23 },
  { id: 'glutes',     label: 'Glutes',       cx: 126, cy: 210, rx: 27, ry: 23 },
  { id: 'hamstrings', label: 'Hamstrings',   cx: 72,  cy: 262, rx: 21, ry: 36 },
  { id: 'hamstrings', label: 'Hamstrings',   cx: 128, cy: 262, rx: 21, ry: 36 },
  { id: 'calves',     label: 'Calves',       cx: 68,  cy: 334, rx: 14, ry: 26 },
  { id: 'calves',     label: 'Calves',       cx: 132, cy: 334, rx: 14, ry: 26 },
];

function getFill(id: MuscleId, primary: MuscleId[], secondary: MuscleId[]) {
  if (primary.includes(id))   return { fill: 'url(#primary_grad)',   opacity: 0.90, filter: 'url(#glow)' };
  if (secondary.includes(id)) return { fill: 'url(#secondary_grad)', opacity: 0.70, filter: 'none' };
  return { fill: '#ffffff', opacity: 0.07, filter: 'none' };
}

function BodySVG({
  muscles, primaryMuscles, secondaryMuscles, side, hoveredMuscle, onHover, onClickMuscle,
}: {
  muscles: MuscleGroup[];
  primaryMuscles: MuscleId[];
  secondaryMuscles: MuscleId[];
  side: 'front' | 'back';
  hoveredMuscle: string | null;
  onHover: (label: string | null) => void;
  onClickMuscle?: (id: MuscleId) => void;
}) {
  const interactive = !!onClickMuscle;

  return (
    <svg viewBox="0 0 200 400" className="w-full h-full" style={{ maxHeight: 320 }}>
      <defs>
        <radialGradient id={`primary_grad_${side}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#c9a96e" />
          <stop offset="100%" stopColor="#c9a96e" />
        </radialGradient>
        <radialGradient id={`secondary_grad_${side}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#0d9488" />
        </radialGradient>
        <filter id={`glow_${side}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id={`skin_grad_${side}`} cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#1a1508" />
          <stop offset="100%" stopColor="#0d0b08" />
        </radialGradient>
      </defs>

      {/* ── Body silhouette ─────────────────────────────────────────────── */}
      <circle cx="100" cy="22" r="18" fill={`url(#skin_grad_${side})`} stroke="#ffffff12" strokeWidth="1" />
      <rect x="91" y="38" width="18" height="20" rx="4" fill={`url(#skin_grad_${side})`} />
      <path d="M 44,58 Q 34,62 22,72 L 8,110 L 12,150 L 16,196 L 28,198 L 26,154 L 34,116 L 44,102 L 66,100 L 68,196 L 58,210 L 46,232 L 42,285 L 46,360 L 68,362 L 76,286 L 80,232 L 90,212 L 100,210 L 110,212 L 120,232 L 124,286 L 132,362 L 154,360 L 158,285 L 154,232 L 142,210 L 132,196 L 134,100 L 156,102 L 166,116 L 174,154 L 172,198 L 184,196 L 188,150 L 192,110 L 178,72 Q 166,62 156,58 L 132,54 Q 100,50 68,54 Z"
        fill={`url(#skin_grad_${side})`} stroke="#ffffff10" strokeWidth="1" />

      {/* ── Muscle overlays ─────────────────────────────────────────────── */}
      {muscles.map((m, i) => {
        const { fill, opacity, filter } = getFill(m.id, primaryMuscles, secondaryMuscles);
        const isHovered = hoveredMuscle === m.id;
        const isPrimary   = primaryMuscles.includes(m.id);
        const isSecondary = secondaryMuscles.includes(m.id);
        // Replace gradient IDs with side-specific ones
        const resolvedFill = fill.replace('primary_grad', `primary_grad_${side}`).replace('secondary_grad', `secondary_grad_${side}`);
        const resolvedFilter = filter.replace('glow', `glow_${side}`);
        return (
          <g key={i}>
            <ellipse
              cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry}
              fill={resolvedFill}
              opacity={isHovered ? Math.min(opacity + 0.25, 1) : opacity}
              filter={resolvedFilter !== 'none' ? resolvedFilter : undefined}
              transform={m.rotate ? `rotate(${m.rotate} ${m.cx} ${m.cy})` : undefined}
              style={{ cursor: interactive ? 'pointer' : 'default', transition: 'opacity 0.15s' }}
              onMouseEnter={() => onHover(m.id)}
              onMouseLeave={() => onHover(null)}
              onClick={interactive ? () => onClickMuscle!(m.id) : undefined}
            />
            {/* Stroke ring on hover when interactive */}
            {interactive && isHovered && (
              <ellipse
                cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry}
                fill="none"
                stroke={isPrimary ? '#c9a96e' : isSecondary ? '#34d399' : '#ffffff'}
                strokeWidth="1.5"
                opacity="0.7"
                transform={m.rotate ? `rotate(${m.rotate} ${m.cx} ${m.cy})` : undefined}
                style={{ pointerEvents: 'none' }}
              />
            )}
          </g>
        );
      })}

      {/* Hover tooltip */}
      {interactive && hoveredMuscle && (() => {
        const m = muscles.find(x => x.id === hoveredMuscle);
        if (!m) return null;
        const isPrimary   = primaryMuscles.includes(m.id);
        const isSecondary = secondaryMuscles.includes(m.id);
        const nextLabel   = isPrimary ? 'Set secondary' : isSecondary ? 'Remove' : 'Set primary';
        const labelX = Math.min(Math.max(m.cx, 36), 164);
        const labelY = m.cy < 50 ? m.cy + m.ry + 14 : m.cy - m.ry - 6;
        return (
          <g>
            <rect x={labelX - 32} y={labelY - 9} width="64" height="12" rx="3"
              fill="#080608" opacity="0.88" />
            <text x={labelX} y={labelY} textAnchor="middle" fill="#ffffffcc"
              fontSize="8" fontFamily="system-ui" fontWeight="500">
              {nextLabel}
            </text>
          </g>
        );
      })()}

      {/* Side label */}
      <text x="100" y="392" textAnchor="middle" fill="#ffffff25" fontSize="9" fontFamily="system-ui">
        {side === 'front' ? 'FRONT' : 'BACK'}
      </text>
    </svg>
  );
}

// ── Display-only diagram (used in Exercise detail view) ───────────────────────
interface DiagramProps {
  primaryMuscles: string[];
  secondaryMuscles: string[];
  size?: 'sm' | 'md' | 'lg';
}

export function MuscleBodyDiagram({ primaryMuscles, secondaryMuscles, size = 'md' }: DiagramProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const primary   = primaryMuscles   as MuscleId[];
  const secondary = secondaryMuscles as MuscleId[];
  const heights: Record<string, string> = { sm: 'h-40', md: 'h-56', lg: 'h-72' };

  return (
    <div className="space-y-2">
      <div className={`flex gap-3 ${heights[size]}`}>
        <div className="flex-1">
          <BodySVG muscles={FRONT_MUSCLES} primaryMuscles={primary} secondaryMuscles={secondary}
            side="front" hoveredMuscle={hovered} onHover={setHovered} />
        </div>
        <div className="flex-1">
          <BodySVG muscles={BACK_MUSCLES} primaryMuscles={primary} secondaryMuscles={secondary}
            side="back" hoveredMuscle={hovered} onHover={setHovered} />
        </div>
      </div>
      <div className="flex items-center gap-4 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-fuchsia-500" />
          <span className="text-white/40 text-[10px]">Primary</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-white/40 text-[10px]">Secondary</span>
        </div>
        {hovered && (
          <span className="text-[#e8c98a] text-[10px] font-medium">
            {ALL_MUSCLES.find(m => m.id === hovered)?.label}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center justify-center gap-4 py-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#c9a96e]" />
          <span className="text-white/35 text-[10px]">Primary</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-white/35 text-[10px]">Secondary</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <span className="text-white/20 text-[10px]">Not targeted</span>
        </div>
      </div>
    </div>
  );
}

// ── Selector variant — for the exercise editor ────────────────────────────────
export function MuscleSelector({
  primary, secondary, onTogglePrimary, onToggleSecondary,
}: {
  primary: string[];
  secondary: string[];
  onTogglePrimary: (id: string) => void;
  onToggleSecondary: (id: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const primaryIds   = primary   as MuscleId[];
  const secondaryIds = secondary as MuscleId[];

  // Click cycles: off → primary → secondary → off
  const handleClick = (id: MuscleId) => {
    if (primaryIds.includes(id)) {
      // primary → secondary
      onTogglePrimary(id);     // removes from primary
      onToggleSecondary(id);   // adds to secondary
    } else if (secondaryIds.includes(id)) {
      // secondary → off
      onToggleSecondary(id);   // removes from secondary
    } else {
      // off → primary
      onTogglePrimary(id);     // adds to primary
    }
  };

  // Selected muscles summary
  const selectedPrimary   = ALL_MUSCLES.filter(m => primaryIds.includes(m.id));
  const selectedSecondary = ALL_MUSCLES.filter(m => secondaryIds.includes(m.id));

  return (
    <div className="space-y-3">
      {/* Hint */}
      <p className="text-white/35 text-[11px] text-center">
        Click a muscle to mark as <span className="text-fuchsia-400">primary</span> → click again for <span className="text-emerald-400">secondary</span> → click again to remove
      </p>

      {/* Clickable front + back diagrams */}
      <div className="flex gap-2 h-64">
        <div className="flex-1 rounded-xl bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.06)] p-1">
          <BodySVG
            muscles={FRONT_MUSCLES}
            primaryMuscles={primaryIds}
            secondaryMuscles={secondaryIds}
            side="front"
            hoveredMuscle={hovered}
            onHover={setHovered}
            onClickMuscle={handleClick}
          />
        </div>
        <div className="flex-1 rounded-xl bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.06)] p-1">
          <BodySVG
            muscles={BACK_MUSCLES}
            primaryMuscles={primaryIds}
            secondaryMuscles={secondaryIds}
            side="back"
            hoveredMuscle={hovered}
            onHover={setHovered}
            onClickMuscle={handleClick}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-fuchsia-500" />
          <span className="text-white/50 text-[11px]">Primary</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-white/50 text-[11px]">Secondary</span>
        </div>
      </div>

      {/* Selected summary chips */}
      {(selectedPrimary.length > 0 || selectedSecondary.length > 0) && (
        <div className="space-y-1.5">
          {selectedPrimary.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-fuchsia-400/60 text-[10px] self-center">Primary:</span>
              {selectedPrimary.map(m => (
                <button
                  key={m.id}
                  onClick={() => onTogglePrimary(m.id)}
                  className="px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-[10px] hover:bg-fuchsia-500/40 transition-all"
                  title="Click to remove"
                >
                  {m.label} ×
                </button>
              ))}
            </div>
          )}
          {selectedSecondary.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-emerald-400/60 text-[10px] self-center">Secondary:</span>
              {selectedSecondary.map(m => (
                <button
                  key={m.id}
                  onClick={() => onToggleSecondary(m.id)}
                  className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] hover:bg-emerald-500/30 transition-all"
                  title="Click to remove"
                >
                  {m.label} ×
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
