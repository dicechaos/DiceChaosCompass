import React, { useId } from "react";

/**
 * Dice Chaos Compass emblem — faceted D20 icosahedron frame crowned with an
 * 8-point two-tone gilded & arcane-violet cartographer's compass rose.
 */
export const DiceLogo: React.FC<{ size?: number }> = ({ size = 24 }) => {
  const uid = useId().replace(/:/g, "");
  const goldLightId = `dcGoldL-${uid}`;
  const goldDarkId = `dcGoldD-${uid}`;
  const northId = `dcNorth-${uid}`;
  const arcaneId = `dcArcane-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={goldLightId} x1="12%" y1="6%" x2="88%" y2="94%">
          <stop offset="0%" stopColor="#FFF2B8" />
          <stop offset="50%" stopColor="#F4C14D" />
          <stop offset="100%" stopColor="#D38920" />
        </linearGradient>
        <linearGradient id={goldDarkId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B8741A" />
          <stop offset="100%" stopColor="#7A480D" />
        </linearGradient>
        <linearGradient id={northId} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#FFF9DF" />
          <stop offset="55%" stopColor="#F8D268" />
          <stop offset="100%" stopColor="#DC9626" />
        </linearGradient>
        <linearGradient id={arcaneId} x1="10%" y1="10%" x2="90%" y2="90%">
          <stop offset="0%" stopColor="#DFD2FF" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>

      {/* Subtle outer brass compass degree ring */}
      <circle
        cx="32"
        cy="32"
        r="28.5"
        stroke={`url(#${goldLightId})`}
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />

      {/* D20 icosahedron hexagon housing */}
      <polygon
        points="32,6.5 54.1,19.25 54.1,44.75 32,57.5 9.9,44.75 9.9,19.25"
        fill="#161B2B"
        stroke={`url(#${goldLightId})`}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Subtle D20 inner facet triangle & corner ribs */}
      <polygon
        points="32,16.5 45.8,40.2 18.2,40.2"
        fill="rgba(139,92,246,0.16)"
        stroke="#E5A93C"
        strokeOpacity="0.4"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <g stroke="#E5A93C" strokeOpacity="0.32" strokeWidth="1.2">
        <line x1="54.1" y1="19.25" x2="32" y2="16.5" />
        <line x1="9.9" y1="19.25" x2="32" y2="16.5" />
        <line x1="54.1" y1="44.75" x2="45.8" y2="40.2" />
        <line x1="9.9" y1="44.75" x2="18.2" y2="40.2" />
      </g>

      {/* 4 Diagonal Intercardinal Compass Points (Arcane Violet) */}
      <polygon points="32,32 46.2,17.8 36,32" fill={`url(#${arcaneId})`} />
      <polygon points="32,32 46.2,17.8 32,28" fill="#5D3BA8" />
      <polygon points="32,32 46.2,46.2 32,36" fill={`url(#${arcaneId})`} />
      <polygon points="32,32 46.2,46.2 36,32" fill="#5D3BA8" />
      <polygon points="32,32 17.8,46.2 28,32" fill={`url(#${arcaneId})`} />
      <polygon points="32,32 17.8,46.2 32,36" fill="#5D3BA8" />
      <polygon points="32,32 17.8,17.8 32,28" fill={`url(#${arcaneId})`} />
      <polygon points="32,32 17.8,17.8 28,32" fill="#5D3BA8" />

      {/* 4 Bold Cardinal Compass Needles (Two-Tone Beveled Gold) */}
      {/* North Hero Needle */}
      <polygon points="32,3.2 32,32 27.1,27.1" fill={`url(#${northId})`} />
      <polygon points="32,3.2 36.9,27.1 32,32" fill={`url(#${goldDarkId})`} />
      {/* South Needle */}
      <polygon points="32,60.2 32,32 36.7,36.7" fill={`url(#${goldLightId})`} />
      <polygon points="32,60.2 27.3,36.7 32,32" fill={`url(#${goldDarkId})`} />
      {/* East Needle */}
      <polygon points="59.4,32 32,32 36.7,27.3" fill={`url(#${goldLightId})`} />
      <polygon points="59.4,32 36.7,36.7 32,32" fill={`url(#${goldDarkId})`} />
      {/* West Needle */}
      <polygon points="4.6,32 32,32 27.3,36.7" fill={`url(#${goldLightId})`} />
      <polygon points="4.6,32 27.3,27.3 32,32" fill={`url(#${goldDarkId})`} />

      {/* Center Compass Pivot Jewel */}
      <circle cx="32" cy="32" r="4.6" fill="#131724" stroke={`url(#${goldLightId})`} strokeWidth="1.8" />
      <circle cx="32" cy="32" r="2.1" fill="#FFF2B8" />
    </svg>
  );
};
