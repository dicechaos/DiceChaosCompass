import React from "react";

export const DiceLogo: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <polygon
      points="32,4 57,18 57,46 32,60 7,46 7,18"
      fill="#1C202C"
      stroke="#E5A93C"
      strokeWidth="3.2"
      strokeLinejoin="round"
    />
    <polygon
      points="32,16 46,40 18,40"
      fill="rgba(139,92,246,0.22)"
      stroke="#E5A93C"
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
    <line x1="32" y1="4" x2="32" y2="16" stroke="#E5A93C" strokeWidth="2.2" />
    <line x1="57" y1="18" x2="46" y2="40" stroke="#E5A93C" strokeWidth="2" />
    <line x1="7" y1="18" x2="18" y2="40" stroke="#E5A93C" strokeWidth="2" />
    <line x1="57" y1="18" x2="32" y2="16" stroke="#E5A93C" strokeWidth="1.8" />
    <line x1="7" y1="18" x2="32" y2="16" stroke="#E5A93C" strokeWidth="1.8" />
    <line x1="57" y1="46" x2="46" y2="40" stroke="#E5A93C" strokeWidth="2" />
    <line x1="7" y1="46" x2="18" y2="40" stroke="#E5A93C" strokeWidth="2" />
    <line x1="32" y1="60" x2="46" y2="40" stroke="#E5A93C" strokeWidth="1.8" />
    <line x1="32" y1="60" x2="18" y2="40" stroke="#E5A93C" strokeWidth="1.8" />
  </svg>
);
