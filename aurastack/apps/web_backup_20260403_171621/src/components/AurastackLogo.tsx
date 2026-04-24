import React from 'react';
import { cn } from '../lib/utils';

interface AuroraStackLogoProps {
  className?: string;
  showWordmark?: boolean;
  collapsed?: boolean;
}

/** AuroraStack logo - teal infinity/stack icon + serif wordmark */
export function AuroraStackLogo({ className, showWordmark = true, collapsed = false }: AuroraStackLogoProps) {
  const size = collapsed ? 32 : 26;
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* Teal icon: infinity + stack (aurastack brand mark) */}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 32 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Horizontal infinity (figure-8) */}
        <path 
          d="M10 16c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6-6-2.7-6-6zm6-6c3.3 0 6 2.7 6 6M10 16c0 3.3 2.7 6 6 6s6-2.7 6-6" 
          stroke="#1F9D8B" 
          strokeWidth="2" 
          strokeLinecap="round" 
          fill="none"
        />
        {/* Stack lines sweeping up-left from top-right */}
        <path d="M22 6l6-6" stroke="#1F9D8B" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 4l5-5" stroke="#1F9D8B" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 8l5-5" stroke="#1F9D8B" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {showWordmark && !collapsed && (
        <span 
          className="text-[15px] font-semibold tracking-tight text-[#0F172A]"
          style={{ fontFamily: 'Georgia, "Times New Roman", Cambria, serif' }}
        >
          aurastack
        </span>
      )}
    </div>
  );
}
