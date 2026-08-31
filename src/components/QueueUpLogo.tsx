import React from 'react';

interface QueueUpLogoProps {
  className?: string;
  showText?: boolean;
  textSize?: 'sm' | 'md' | 'lg' | 'xl';
  lightText?: boolean;
  onClick?: () => void;
}

export const QueueUpLogoIcon: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Bowl base shadow */}
    <ellipse cx="100" cy="172" rx="42" ry="7" fill="#000000" opacity="0.12" />
    
    {/* Bowl Foot */}
    <path
      d="M86 162 C86 168, 114 168, 114 162 L110 156 L90 156 Z"
      fill="#DE2E1B"
    />
    
    {/* Main Bowl Body */}
    <path
      d="M48 100 C48 160, 152 160, 152 100 Z"
      fill="#F6402E"
    />
    {/* Bowl Right Shadow Gradient */}
    <path
      d="M100 100 C100 158, 152 158, 152 100 Z"
      fill="#D02E1E"
      opacity="0.3"
    />

    {/* Rice / Food Inside Bowl */}
    <ellipse cx="100" cy="98" rx="48" ry="16" fill="#FFFFFF" />
    <path
      d="M54 98 C54 112, 146 112, 146 98 C146 90, 54 90, 54 98 Z"
      fill="#FFF9F5"
    />

    {/* Golden Sesame/Rice Grains */}
    <ellipse cx="88" cy="100" rx="4" ry="2" fill="#E67E22" transform="rotate(-20 88 100)" />
    <ellipse cx="100" cy="103" rx="4.5" ry="2.2" fill="#E67E22" transform="rotate(15 100 103)" />
    <ellipse cx="112" cy="99" rx="4" ry="2" fill="#E67E22" transform="rotate(-25 112 99)" />

    {/* Floating Queue Ticket */}
    <g>
      {/* Ticket Shadow */}
      <rect x="74" y="34" width="52" height="56" rx="10" fill="#000000" opacity="0.08" />
      
      {/* Ticket Body with notches */}
      <path
        d="M74 38 C74 32, 78 28, 84 28 H116 C122 28, 126 32, 126 38 V50 C121 50, 118 53, 118 57 C118 61, 121 64, 126 64 V82 C126 88, 122 92, 116 92 H84 C78 92, 74 88, 74 82 V64 C79 64, 82 61, 82 57 C82 53, 79 50, 74 50 Z"
        fill="#F6402E"
      />
      
      {/* Ticket Top Semi-circle Notch */}
      <ellipse cx="100" cy="28" rx="10" ry="7" fill="#FFFFFF" />
      
      {/* Ticket Content Lines */}
      <rect x="85" y="46" width="30" height="5" rx="2.5" fill="#FFFFFF" />
      <rect x="85" y="57" width="22" height="5" rx="2.5" fill="#FFFFFF" opacity="0.9" />
    </g>

    {/* Upward Curved Arrow */}
    <path
      d="M106 122 C132 118, 162 92, 168 54"
      stroke="#FF7A00"
      strokeWidth="14"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M144 58 L170 50 L176 76"
      stroke="#FF7A00"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export const QueueUpLogo: React.FC<QueueUpLogoProps> = ({
  className = "",
  showText = true,
  textSize = "md",
  lightText = true,
  onClick,
}) => {
  const textClasses = {
    sm: "text-lg",
    md: "text-xl sm:text-2xl",
    lg: "text-2xl sm:text-3xl",
    xl: "text-3xl sm:text-4xl",
  }[textSize];

  const subTextClasses = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-[11px]",
    xl: "text-[12px]",
  }[textSize];

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 shrink-0 ${onClick ? 'cursor-pointer hover:opacity-95 transition-all' : ''} ${className}`}
    >
      <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white rounded-2xl flex items-center justify-center p-1 shadow-md shadow-black/10 border border-orange-100/50">
        <QueueUpLogoIcon className="w-full h-full" />
      </div>

      {showText && (
        <div className="flex flex-col justify-center">
          <div className={`font-black tracking-tight leading-none ${textClasses}`}>
            <span className={lightText ? "text-white drop-shadow-xs" : "text-[#F6402E]"}>Queue</span>
            <span className="text-[#FF7A00] drop-shadow-xs">Up</span>
          </div>
          <span
            className={`font-extrabold tracking-widest uppercase opacity-95 ${
              lightText ? "text-amber-200" : "text-orange-600"
            } ${subTextClasses}`}
          >
            School Food CRM
          </span>
        </div>
      )}
    </div>
  );
};
