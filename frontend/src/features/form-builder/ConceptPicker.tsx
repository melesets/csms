import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Check, Loader2 } from 'lucide-react';
import { CodedValue, TerminologyConfig } from '../../types/formBuilder';
import { TerminologyService } from '../../services/terminologyService';

interface ConceptPickerProps {
    config: TerminologyConfig;
    value?: CodedValue | CodedValue[]; // Support single or multiple
    onChange: (value: CodedValue | CodedValue[] | undefined) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export const ConceptPicker: React.FC<ConceptPickerProps> = ({
    config,
    value,
    onChange,
    placeholder = 'Search concept...',
    className = '',
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [options, setOptions] = useState<CodedValue[]>([]);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search
    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const results = await TerminologyService.getInstance().search(searchTerm, config);
                setOptions(results);
            } catch (error) {
                console.error('Terminology search failed:', error);
                setOptions([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm, isOpen, config.system, config.subset]);

    const handleSelect = (item: CodedValue) => {
        if (config.allowMultiple) {
            const current = Array.isArray(value) ? value : [];
            if (!current.some(v => v.code === item.code)) {
                onChange([...current, item]);
            }
        } else {
            onChange(item);
            setIsOpen(false);
        }
        setSearchTerm('');
    };

    const handleRemove = (code: string) => {
        if (Array.isArray(value)) {
            onChange(value.filter(v => v.code !== code));
        } else {
            onChange(undefined);
        }
    };

    const renderValue = () => {
        if (!value || (Array.isArray(value) && value.length === 0)) return null;

        if (Array.isArray(value)) {
            return (
                <div className="flex flex-wrap gap-2 mb-2">
                    {value.map(v => (
                        <span key={v.code} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs border border-blue-200">
                            <span className="font-mono font-semibold mr-1">{v.code}</span>
                            {v.display}
                            {!disabled && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleRemove(v.code); }}
                                    className="ml-1 hover:text-blue-900"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </span>
                    ))}
                </div>
            );
        }

        return (
            <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 mb-2">
                <div className="flex items-center">
                    <span className="inline-block px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-blue-200 text-blue-800 mr-2">
                        {value.code}
                    </span>
                    <span className="font-medium">{value.display}</span>
                    <span className="ml-2 text-xs text-blue-500">({value.system.split('/').pop()})</span>
                </div>
                {!disabled && (
                    <button onClick={() => onChange(undefined)} className="text-blue-500 hover:text-blue-700">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {renderValue()}

            {(!value || config.allowMultiple) && !disabled && (
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setIsOpen(true)}
                        placeholder={placeholder}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />

                    {loading && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                        </div>
                    )}
                </div>
            )}

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                    {options.length > 0 ? (
                        <ul className="py-1">
                            {options.map((option) => {
                                const isSelected = Array.isArray(value)
                                    ? value.some(v => v.code === option.code)
                                    : value?.code === option.code;

                                return (
                                    <li
                                        key={option.code}
                                        onClick={() => handleSelect(option)}
                                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 flex items-center justify-between
                      ${isSelected ? 'bg-blue-50 text-blue-900' : 'text-gray-700'}`}
                                    >
                                        <div>
                                            <div className="font-medium">{option.display}</div>
                                            <div className="text-xs text-gray-500 font-mono">
                                                {option.code} • {option.system.split('/').pop()}
                                            </div>
                                        </div>
                                        {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                            {loading ? 'Searching...' : 'No concepts found'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
