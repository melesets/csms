// Consistent inline spinner - dual-ring animation matching IsbarLoader style
// Used for loading states in buttons, cards, and inline UI
import React from 'react';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  xs: 14,
  sm: 18,
  md: 24,
  lg: 36,
};

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => {
  const px = sizeMap[size];
  const borderWidth = Math.max(2, Math.round(px * 0.12));
  const innerInset = Math.max(3, Math.round(px * 0.2));

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: px, height: px }}>
      {/* Base ring */}
      <div
        className="absolute inset-0 rounded-full border-blue-100"
        style={{ borderWidth, borderStyle: 'solid' }}
      />
      {/* Outer arc - spins clockwise */}
      <div
        className="absolute inset-0 rounded-full border-blue-600 animate-spin"
        style={{ borderWidth, borderStyle: 'solid', borderTopColor: 'transparent' }}
      />
      {/* Inner arc - spins counter-clockwise */}
      <div
        className="absolute rounded-full border-blue-300"
        style={{
          inset: innerInset,
          borderWidth: Math.max(2, borderWidth),
          borderStyle: 'solid',
          borderBottomColor: 'transparent',
          animation: 'spin 2s linear infinite reverse',
        }}
      />
    </div>
  );
};

export default Spinner;
