import React from 'react';
import shopeeLogoImg from '../assets/images/shopee_official_logo.png';
import tiktokLogoImg from '../assets/images/tiktok_official_logo.png';
import lazadaLogoImg from '../assets/images/lazada_official_logo.png';

export const ShopeeLogo: React.FC<{ className?: string; alt?: string }> = ({
  className = 'w-12 h-12',
  alt = 'Shopee Logo',
}) => (
  <img
    src={shopeeLogoImg}
    alt={alt}
    className={`${className} object-contain rounded-2xl shrink-0 select-none shadow-sm`}
    draggable={false}
    loading="eager"
  />
);

export const TikTokShopLogo: React.FC<{ className?: string; alt?: string }> = ({
  className = 'w-12 h-12',
  alt = 'TikTok Shop Logo',
}) => (
  <img
    src={tiktokLogoImg}
    alt={alt}
    className={`${className} object-contain rounded-2xl shrink-0 select-none shadow-sm`}
    draggable={false}
    loading="eager"
  />
);

export const LazadaLogo: React.FC<{ className?: string; alt?: string }> = ({
  className = 'w-12 h-12',
  alt = 'Lazada Logo',
}) => (
  <img
    src={lazadaLogoImg}
    alt={alt}
    className={`${className} object-contain rounded-full shrink-0 select-none shadow-sm`}
    draggable={false}
    loading="eager"
  />
);
