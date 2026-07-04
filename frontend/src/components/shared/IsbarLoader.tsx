// Animated loading spinner with stethoscope icon and optional overlay
// Customizable size and message display
import React from 'react';
import { Stethoscope } from 'lucide-react';
import styles from './IsbarLoader.module.css';

interface IsbarLoaderProps {
  message?: string;
  overlay?: boolean;
  size?: number;
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
    <div className={styles.container}>
      <div className={styles.ring} style={{ width: size, height: size }}>
        <div
          className={`${styles.baseRing} border-blue-100`}
          style={{ width: size, height: size, borderStyle: 'solid', borderWidth: outerBorder }}
        />
        <div
          className={`${styles.outerArc} border-blue-600`}
          style={{ borderStyle: 'solid', borderWidth: outerBorder, borderTopColor: 'transparent' }}
        />
        <div
          className={`${styles.innerArc} border-blue-300`}
          style={{
            inset: innerInset,
            borderStyle: 'solid',
            borderWidth: innerBorder,
            borderBottomColor: 'transparent',
          }}
        />
        <div className={styles.icon}>
          <Stethoscope className="text-blue-600" style={{ width: size * 0.28, height: size * 0.28 }} />
        </div>
      </div>
      {message && <div className={styles.message}>{message}</div>}
    </div>
  );

  if (!overlay) return content;
  return <div className={styles.overlay}>{content}</div>;
};

export default IsbarLoader;
