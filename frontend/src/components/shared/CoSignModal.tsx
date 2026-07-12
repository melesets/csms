// Co-sign modal - lets staff select co-signers before saving inventory report
import React, { useState, useEffect } from 'react';
import { X, Check, Users, Search } from 'lucide-react';

interface CoSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedNames: string[]) => void;
  staffList: { id: number | string; name: string }[];
  currentStaffName: string;
}

export const CoSignModal: React.FC<CoSignModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  staffList,
  currentStaffName,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set());
      setSearch('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const filtered = staffList.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003153] flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Co-Sign Report</h3>
              <p className="text-[11px] text-gray-400">Select staff to co-sign with {currentStaffName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search staff..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:ring-2 focus:ring-[#003153]/20 focus:border-[#003153] transition-all"
            />
          </div>
        </div>

        {/* Staff list */}
        <div className="px-5 py-3 max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No staff found</p>
          ) : (
            <div className="space-y-1">
              {filtered.map(s => {
                const isSelected = selected.has(s.name);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.name)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                      isSelected
                        ? 'bg-[#003153]/5 border border-[#003153]/20'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      isSelected ? 'bg-[#003153] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {isSelected ? <Check className="w-4 h-4" /> : s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className={`text-sm flex-1 ${isSelected ? 'font-semibold text-[#003153]' : 'text-gray-700'}`}>
                      {s.name}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-[#003153] bg-[#003153]/10 px-2 py-0.5 rounded-full">
                        Co-signer
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <span className="text-xs text-gray-400">
            {selected.size} co-signer{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(Array.from(selected))}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#003153] hover:bg-[#002640] transition-colors shadow-sm"
            >
              Save Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
