// Shift handover banner - displays active handover status and prompts
import React from 'react';
import { useShift } from '../../hooks/useShift';
import { useAuth } from '../../hooks/useAuth';
import { AlertCircle, Clock, ArrowRightLeft } from 'lucide-react';

export const ShiftHandoverBanner: React.FC = () => {
  const { shiftContext } = useShift();
  const { unitSession } = useAuth();

  // If we aren't in a unit session or not in handover window, don't show
  if (!unitSession || !shiftContext.isHandoverWindow) return null;

  const { current, incoming, minutesToHandover } = shiftContext;

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md animate-in slide-in-from-top-4 duration-300">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center flex-1">
            <span className="flex p-2 rounded-lg bg-white/20 mr-3">
              <AlertCircle className="h-6 w-6 text-white" aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <p className="font-bold text-sm sm:text-base">
                Handover period active for {unitSession.unitName}
              </p>
              <div className="flex items-center text-sm font-medium text-amber-100 mt-0.5">
                <span>{current} Shift</span>
                <ArrowRightLeft className="w-3 h-3 mx-2 opacity-70" />
                <span>{incoming || 'Next'} Shift</span>
              </div>
            </div>
          </div>
          <div className="flex items-center bg-black/20 px-4 py-2 rounded-lg border border-white/20">
            <Clock className="w-5 h-5 mr-2 text-white/90" />
            <span className="font-mono text-lg tracking-wider font-semibold">
              {minutesToHandover !== null ? (minutesToHandover <= 0 ? 'Now' : `${minutesToHandover}m`) : '--'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
