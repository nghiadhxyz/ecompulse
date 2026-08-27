import React from 'react';

export const ShopeeLogo: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <div className={`${className} rounded-2xl bg-[#EE4D2D] p-2 flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0`}>
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white" stroke="currentColor" strokeWidth="1.8">
      {/* Shopee Bag outline with handle and S letter */}
      <path
        d="M6 8h12l-1 13H7L6 8z"
        fill="white"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 8V6a3 3 0 016 0v2"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* S letter inside in orange */}
      <path
        d="M13.8 11.8c-.3-.5-.9-.8-1.7-.8-1 0-1.6.5-1.6 1.2 0 .8.6 1.1 1.7 1.4 1.4.4 2.2 1 2.2 2.1 0 1.3-1.1 2.1-2.5 2.1-1.3 0-2.2-.6-2.6-1.5m4.3-3.9a1.5 1.5 0 00-.7-.3"
        stroke="#EE4D2D"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

export const TikTokShopLogo: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <div className={`${className} rounded-2xl bg-[#121212] p-2 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-white/15 shrink-0`}>
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      {/* Bag outline */}
      <path
        d="M14 16h20l-2.5 24H16.5L14 16z"
        fill="#1E1E1E"
        stroke="#2A2A2A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M19 16v-4a5 5 0 0110 0v4"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Cyan/Red TikTok music note symbol */}
      <path
        d="M27 20v11.5a4.5 4.5 0 11-4.5-4.5c.5 0 1 .1 1.5.2V20c1.8 2 4.2 3.2 7 3.3v-3.5c-2-.1-3.5-1.2-4-2.8z"
        fill="#00F2FE"
      />
      <path
        d="M26 21v11.5a4.5 4.5 0 11-4.5-4.5c.5 0 1 .1 1.5.2V21c1.8 2 4.2 3.2 7 3.3v-3.5c-2-.1-3.5-1.2-4-2.8z"
        fill="#FE2C55"
        style={{ mixBlendMode: 'screen', opacity: 0.85 }}
      />
      <path
        d="M26.5 20.5v11.5a4.5 4.5 0 11-4.5-4.5c.5 0 1 .1 1.5.2V20.5c1.8 2 4.2 3.2 7 3.3v-3.5c-2-.1-3.5-1.2-4-2.8z"
        fill="#FFFFFF"
      />
    </svg>
  </div>
);

export const LazadaLogo: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <div className={`${className} rounded-2xl bg-[#0F146D] p-2 flex items-center justify-center shadow-lg shadow-blue-600/30 shrink-0`}>
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      {/* Lazada 3D Heart block shape */}
      <path
        d="M24 10l12 7.5v15L24 40 12 32.5v-15L24 10z"
        fill="url(#lazGrad)"
      />
      <path
        d="M24 10l12 7.5-12 7.5-12-7.5L24 10z"
        fill="#FF007A"
        opacity="0.9"
      />
      <path
        d="M24 25v15l12-7.5v-15L24 25z"
        fill="#FF5E00"
      />
      <path
        d="M24 25v15L12 32.5v-15L24 25z"
        fill="#002D80"
      />
      {/* White text "Laz" */}
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize="11"
        fontWeight="900"
        fill="white"
        fontFamily="sans-serif"
      >
        Laz
      </text>
      <defs>
        <linearGradient id="lazGrad" x1="12" y1="10" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF007A" />
          <stop offset="0.5" stopColor="#FF5E00" />
          <stop offset="1" stopColor="#0F146D" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);
