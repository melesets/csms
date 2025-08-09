import React from 'react';
import { Stethoscope } from 'lucide-react';

interface IsbarLoaderProps {
  message?: string;
  overlay?: boolean;
  size?: number; // outer diameter in px
}

export const IsbarLoader: React.FC<IsbarLoaderProps> = ({
  message = 'Loading...',
  overlay = false,
  size = 80,
}) => {
  const outerBorder = Math.max(4, Math.round(size * 0.06));
  const innerInset = Math.max(6, Math.round(size * 0.12));
  const innerBorder = Math.max(4, Math.round(size * 0.06));

  const content = (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Base ring */}
        <div
          className="rounded-full border-blue-100"
          style={{ width: size, height: size, borderStyle: 'solid', borderWidth: outerBorder }}
        />
        {/* Outer spinning arc */}
        <div
          className="absolute inset-0 rounded-full animate-spin border-blue-600"
          style={{ borderStyle: 'solid', borderWidth: outerBorder, borderTopColor: 'transparent' }}
        />
        {/* Inner counter-rotating arc */}
        <div
          className="absolute rounded-full animate-spin border-blue-300"
          style={{
            inset: innerInset,
            borderStyle: 'solid',
            borderWidth: innerBorder,
            borderBottomColor: 'transparent',
            animationDuration: '2s',
            animationDirection: 'reverse' as React.CSSProperties['animationDirection'],
          }}
        />
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Stethoscope className="text-blue-600" style={{ width: size * 0.28, height: size * 0.28 }} />
        </div>
      </div>
      {message && (
        <div className="mt-4 text-sm font-medium text-gray-700 text-center">{message}</div>
      )}
    </div>
  );

  if (!overlay) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70">
      {content}
    </div>
  );
};

export default IsbarLoader;



