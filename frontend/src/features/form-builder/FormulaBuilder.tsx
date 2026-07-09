import React, { useState } from 'react';
import { Play, Info } from 'lucide-react';
import { FormField } from '../../types/formBuilder';

interface FormulaBuilderProps {
    formula: string;
    onChange: (formula: string) => void;
    fields: FormField[];
    currentFieldId: string;
}

export const FormulaBuilder: React.FC<FormulaBuilderProps> = ({
    formula,
    onChange,
    fields,
    currentFieldId
}) => {
    const [testValues, setTestValues] = useState<Record<string, any>>({});
    const [testResult, setTestResult] = useState<string | number | boolean | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Filter out current field to prevent self-reference
    const availableFields = fields.filter(f => f.id !== currentFieldId && f.name);

    const handleTest = () => {
        try {
            const dependencies = availableFields
                .filter(f => formula.includes(f.name))
                .map(f => f.name);

            // Replace field names with safe variable names
            let safeFormula = formula;
            const context: Record<string, any> = {};

            dependencies.forEach(dep => {
                const safeVarName = dep.replace(/[^a-zA-Z0-9_]/g, '_');
                const regex = new RegExp(`\\b${dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
                safeFormula = safeFormula.replace(regex, safeVarName);
                context[safeVarName] = Number(testValues[dep]) || 0;
            });

            // Execute formula
            const safeVarNames = dependencies.map(dep => dep.replace(/[^a-zA-Z0-9_]/g, '_'));
            const func = new Function(...safeVarNames, `return ${safeFormula}`);
            const result = func(...safeVarNames.map(varName => context[varName]));

            setTestResult(result);
            setError(null);
        } catch (err: any) {
            setError(err.message);
            setTestResult(null);
        }
    };

    const insertField = (fieldName: string) => {
        onChange(formula + (formula ? ' ' : '') + fieldName);
    };

    return (
        <div className="space-y-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Formula Expression</label>
                <div className="group relative">
                    <Info className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="hidden group-hover:block absolute right-0 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                        Supports basic math (+, -, *, /) and ternary operators (condition ? true : false).
                        Use field names as variables.
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <textarea
                    value={formula}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 min-h-[100px] p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. (Systolic_BP + 2 * Diastolic_BP) / 3"
                />

                <div className="w-48 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
                    <div className="p-2 bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-500">
                        Available Fields
                    </div>
                    <div className="overflow-y-auto max-h-[100px] p-1">
                        {availableFields.map(field => (
                            <button
                                key={field.id}
                                onClick={() => insertField(field.name)}
                                className="w-full text-left px-2 py-1 text-xs hover:bg-blue-50 text-gray-700 rounded truncate"
                                title={field.label}
                            >
                                {field.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Play className="w-3 h-3 mr-1" /> Test Calculation
                </h4>

                <div className="grid grid-cols-2 gap-2 mb-2">
                    {availableFields
                        .filter(f => formula.includes(f.name))
                        .map(field => (
                            <div key={field.id} className="flex items-center gap-2">
                                <label className="text-xs text-gray-500 w-1/3 truncate" title={field.name}>
                                    {field.name}
                                </label>
                                <input
                                    type="number"
                                    onChange={(e) => setTestValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                                    placeholder="Value"
                                />
                            </div>
                        ))}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleTest}
                        className="px-3 py-1 bg-brand text-white text-xs rounded hover:bg-brand-600"
                    >
                        Calculate
                    </button>

                    {error ? (
                        <span className="text-xs text-red-600 font-mono">{error}</span>
                    ) : testResult !== null ? (
                        <span className="text-sm font-semibold text-green-700">
                            Result: {String(testResult)}
                        </span>
                    ) : null}
                </div>
            </div>
        </div>
    );
};
