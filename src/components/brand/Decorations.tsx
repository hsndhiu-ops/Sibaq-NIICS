import React, { useState } from 'react';

interface DiamondBandProps {
  className?: string;
  height?: number;
}

export const DiamondBand: React.FC<DiamondBandProps> = ({ className = '', height = 12 }) => {
  return (
    <div
      className={`w-full overflow-hidden block ${className}`}
      style={{ height: `${height}px`, minHeight: `${height}px` }}
      aria-hidden="true"
    >
      <svg
        className="w-full h-full block"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id="sibaq-diamond-band"
            width="24"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            {/* Row 1: y = 3 */}
            {/* x = 0 (yellow) */}
            <polygon points="0,0 3,3 0,6 -3,3" fill="#F1B11C" />
            <polygon points="24,0 27,3 24,6 21,3" fill="#F1B11C" />
            {/* x = 12 (white) */}
            <polygon points="12,0 15,3 12,6 9,3" fill="#FFFFFF" />

            {/* Row 2: y = 9 (staggered) */}
            {/* x = 6 (white) */}
            <polygon points="6,6 9,9 6,12 3,9" fill="#FFFFFF" />
            {/* x = 18 (yellow) */}
            <polygon points="18,6 21,9 18,12 15,9" fill="#F1B11C" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sibaq-diamond-band)" />
      </svg>
    </div>
  );
};

interface PentagonProps {
  size?: number;
  className?: string;
}

function getPentagonPoints(cx: number, cy: number, r: number, rotationDeg: number = -90): string {
  const points: string[] = [];
  for (let i = 0; i < 5; i++) {
    const angleRad = ((rotationDeg + i * 72) * Math.PI) / 180;
    const x = cx + r * Math.cos(angleRad);
    const y = cy + r * Math.sin(angleRad);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(' ');
}

export const Pentagon: React.FC<PentagonProps> = ({ size = 64, className = '' }) => {
  const cx = size / 2;
  const cy = size / 2;
  const rOutline = (size / 2) * 0.94;
  const rBase = (size / 2) * 0.82;
  const rTop = (size / 2) * 0.52;
  const offset = size * 0.04;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`block select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* 1. Thin 1px yellow outline pentagon (60% opacity) behind, slightly rotated */}
      <polygon
        points={getPentagonPoints(cx, cy, rOutline, -82)}
        fill="none"
        stroke="#F1B11C"
        strokeWidth="1"
        opacity="0.6"
      />

      {/* 2. Base green pentagon */}
      <polygon
        points={getPentagonPoints(cx, cy, rBase, -90)}
        fill="#28B058"
      />

      {/* 3. Smaller yellow pentagon offset on top */}
      <polygon
        points={getPentagonPoints(cx + offset, cy - offset, rTop, -90)}
        fill="#F1B11C"
      />
    </svg>
  );
};

interface BrandMarkProps {
  variant?: 'white' | 'color';
  height?: number;
  className?: string;
  alt?: string;
}

/**
 * Renders the official SIBAQ'26 mark with exact aspect ratio (0.56w : 1h).
 * Never stretches or crops. If file is missing, gracefully hides image without layout shift.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  variant = 'white',
  height = 32,
  className = '',
  alt = "SIBAQ'26 Mark",
}) => {
  const width = Math.round(height * 0.56);
  const [loadFailed, setLoadFailed] = useState(false);

  const src =
    variant === 'white'
      ? '/brand/sibaq-mark-white.svg'
      : '/brand/sibaq-mark.svg';

  if (loadFailed) {
    return null;
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={`shrink-0 object-contain ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        aspectRatio: '0.56 / 1',
      }}
      onError={() => setLoadFailed(true)}
    />
  );
};
