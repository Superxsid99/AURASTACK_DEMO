import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const AurastackLogo: React.FC<LogoProps> = ({ className, size = 24 }) => (
  <svg 
    viewBox="0 0 100 100" 
    width={size}
    height={size}
    className={className} 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M28 72C18 72 10 64 10 54C10 44 18 36 28 36C34 36 39 39 42 43L58 61C61 65 66 68 72 68C82 68 90 60 90 50C90 40 82 32 72 32" 
      stroke="currentColor" 
      strokeWidth="10" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M45 30L65 10" 
      stroke="currentColor" 
      strokeWidth="10" 
      strokeLinecap="round"
    />
    <path 
      d="M60 45L80 25" 
      stroke="currentColor" 
      strokeWidth="10" 
      strokeLinecap="round"
    />
  </svg>
);
