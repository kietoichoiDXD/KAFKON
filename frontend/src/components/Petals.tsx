import React from 'react';

// Sakura drifting behind the app. Decorative only — it never intercepts a click, and the
// stylesheet removes it entirely for anyone with reduced-motion set.
const PETALS = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 7.3 + 3) % 98}%`,
  size: 8 + ((i * 5) % 9),
  duration: 14 + ((i * 3) % 11),
  delay: -(i * 2.1),
  hue: i % 3,
}));

const FILLS = ['#ffd3e4', '#ffb7d1', '#d9ccff'];

export function Petals() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {PETALS.map((p, i) => (
        <svg
          key={i}
          className="kf-petal"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
          viewBox="0 0 12 12"
        >
          <path
            d="M6 0C8 3 12 4 12 6c0 2-4 3-6 6-2-3-6-4-6-6 0-2 4-3 6-6z"
            fill={FILLS[p.hue]}
          />
        </svg>
      ))}
    </div>
  );
}
