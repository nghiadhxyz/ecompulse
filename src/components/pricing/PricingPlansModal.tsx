import React from 'react';
import { PricingView } from './PricingView';

interface PricingPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'vi' | 'en';
}

export const PricingPlansModal: React.FC<PricingPlansModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto bg-[#0D0922]/90 backdrop-blur-2xl animate-fadeIn">
      <div className="relative w-full max-w-7xl rounded-3xl bg-[#0D0922] border border-[rgba(168,85,247,0.35)] shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]">
        <div className="overflow-y-auto flex-1">
          <PricingView isModal={true} onClose={onClose} language={language} />
        </div>
      </div>
    </div>
  );
};
