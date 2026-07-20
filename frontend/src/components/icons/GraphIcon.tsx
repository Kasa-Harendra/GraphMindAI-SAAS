import React from 'react';

export const GraphIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    {/* Connection Lines (Yellow/Orange) */}
    <g stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round">
      {/* Center to nodes */}
      <line x1="50" y1="50" x2="22" y2="33" />
      <line x1="50" y1="50" x2="88" y2="18" />
      <line x1="50" y1="50" x2="10" y2="90" />
      <line x1="50" y1="50" x2="75" y2="90" />
      
      {/* Outer connections */}
      <line x1="22" y1="33" x2="8" y2="63" />
      <line x1="8" y1="63" x2="10" y2="90" />
      <line x1="88" y1="18" x2="45" y2="8" />
      <line x1="88" y1="18" x2="93" y2="55" />
      <line x1="75" y1="90" x2="52" y2="83" />
    </g>

    {/* Nodes (Dark Grey Stroke, White Fill) */}
    <g stroke="#3F3F46" strokeWidth="6" fill="#FFFFFF">
      {/* Center Node */}
      <circle cx="50" cy="50" r="16" />
      
      {/* Main Outer Nodes */}
      <circle cx="22" cy="33" r="10" />
      <circle cx="88" cy="18" r="10" />
      <circle cx="10" cy="90" r="10" />
      <circle cx="85" cy="85" r="10" />
      
      {/* Secondary Nodes */}
      <circle cx="8" cy="63" r="8" />
      <circle cx="45" cy="8" r="8" />
      <circle cx="93" cy="55" r="7" />
      <circle cx="52" cy="83" r="7" />
    </g>
  </svg>
);
