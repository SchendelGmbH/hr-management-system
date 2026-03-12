/**
 * SwapButton - Tausch-Button für Kalender-Einträge
 * Zeigt einen Button an, um Schichten zu tauschen
 */
'use client';

import { useState } from 'react';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { SwapModal } from './SwapModal';

interface SwapButtonProps {
  assignmentId: string;
  employeeId: string;
  date: Date;
  siteName: string;
  startTime: string;
  endTime: string;
  variant?: 'icon' | 'button';
  disabled?: boolean;
}

export function SwapButton({
  assignmentId,
  employeeId,
  date,
  siteName,
  startTime,
  endTime,
  variant = 'icon',
  disabled = false,
}: SwapButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!disabled) {
      setIsModalOpen(true);
    }
  };

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={handleClick}
          disabled={disabled}
          className={`
            inline-flex items-center justify-center
            w-7 h-7 rounded-full
            transition-all duration-200
            ${disabled 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:scale-110 active:scale-95'
            }
          `}
          title={disabled ? 'Tausch nicht verfügbar' : 'Schicht tauschen'}
        >
          <ArrowsRightLeftIcon className="w-4 h-4" />
        </button>
        
        {isModalOpen && (
          <SwapModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            assignmentId={assignmentId}
            employeeId={employeeId}
            date={date}
            siteName={siteName}
            startTime={startTime}
            endTime={endTime}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`
          inline-flex items-center gap-2 px-3 py-1.5
          rounded-lg text-sm font-medium
          transition-all duration-200
          ${disabled 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          }
        `}
      >
        <ArrowsRightLeftIcon className="w-4 h-4" />
        <span>Tauschen</span>
      </button>

      {isModalOpen && (
        <SwapModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          assignmentId={assignmentId}
          employeeId={employeeId}
          date={date}
          siteName={siteName}
          startTime={startTime}
          endTime={endTime}
        />
      )}
    </>
  );
}
