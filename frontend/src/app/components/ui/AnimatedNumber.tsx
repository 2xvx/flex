// AnimatedNumber.tsx — wraps useCountUp with an optional suffix and pop animation
import { useCountUp } from '../../../hooks/useCountUp';

interface Props {
  value: number;
  duration?: number;
  /** e.g. "k", "%", " pts" */
  suffix?: string;
  className?: string;
}

export function AnimatedNumber({ value, duration = 900, suffix = '', className = '' }: Props) {
  const count = useCountUp(value, duration);
  return (
    <span key={value} className={`num-pop inline-block ${className}`}>
      {count.toLocaleString()}{suffix}
    </span>
  );
}
