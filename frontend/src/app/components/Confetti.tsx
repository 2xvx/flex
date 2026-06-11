// Confetti.tsx — canvas-confetti wrappers for milestone celebrations
import confetti from 'canvas-confetti';

/** Standard celebration burst — new PR, habit streak, etc. */
export function fireConfetti(origin = { x: 0.5, y: 0.6 }) {
  confetti({
    particleCount: 120,
    spread: 80,
    origin,
    colors: ['#c9a96e', '#e8c98a', '#f59e0b', '#fbbf24', '#ec4899', '#fff'],
    startVelocity: 38,
    scalar: 1.1,
    gravity: 1,
    drift: 0,
    ticks: 200,
  });
}

/** Twin cannons from both bottom corners — big milestone (7-day streak, 100 workouts, etc.) */
export function fireBigConfetti() {
  const shared = {
    particleCount: 80,
    spread: 60,
    startVelocity: 55,
    ticks: 250,
    gravity: 0.9,
    colors: ['#c9a96e', '#e8c98a', '#f59e0b', '#fbbf24', '#34d399', '#fff', '#f472b6'],
    scalar: 1.2,
  };
  confetti({ ...shared, origin: { x: 0.1, y: 1 }, angle: 60 });
  confetti({ ...shared, origin: { x: 0.9, y: 1 }, angle: 120 });
}

/** Subtle emoji-shower for smaller wins (habit check-in completing all today) */
export function fireEmojiBurst(emoji = '🔥') {
  const defaults = {
    spread: 360,
    ticks: 100,
    gravity: 0.5,
    decay: 0.94,
    startVelocity: 20,
    shapes: ['text'] as unknown as confetti.Shape[],
    shapeOptions: { text: { value: emoji } },
  };
  const fire = (particleCount: number, opts: object) =>
    confetti({ ...defaults, ...opts, particleCount });

  fire(20, { scalar: 2,   origin: { x: 0.3, y: 0.5 } });
  fire(20, { scalar: 2,   origin: { x: 0.7, y: 0.5 } });
  fire(10, { scalar: 1.5, origin: { x: 0.5, y: 0.4 } });
}

/** Milestone-specific launchers */
export const Celebrate = {
  newPR:           () => { fireBigConfetti(); },
  allHabitsToday:  () => { fireEmojiBurst('✅'); fireConfetti(); },
  streak7:         () => { fireEmojiBurst('🔥'); fireBigConfetti(); },
  streak30:        () => { fireBigConfetti(); setTimeout(() => fireBigConfetti(), 400); },
  streak100:       () => { fireBigConfetti(); setTimeout(() => fireBigConfetti(), 300); setTimeout(() => fireBigConfetti(), 600); },
  levelUp:         () => { fireEmojiBurst('⬆️'); fireConfetti({ x: 0.5, y: 0.5 }); },
};
