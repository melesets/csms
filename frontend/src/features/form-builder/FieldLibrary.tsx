import React, { useState } from 'react';
import { fieldTemplates } from '../../data/fieldTemplates';
import * as LucideIcons from 'lucide-react';
import { Search, Plus, Database } from 'lucide-react';
import { Spinner } from '../../components/shared';
import { TerminologyService } from '../../services/terminologyService';
import { CodedValue } from '../../types/formBuilder';

interface FieldLibraryProps {
  onAddField: (fieldType: any) => void;
}

export const FieldLibrary: React.FC<FieldLibraryProps> = ({ onAddField }) => {
  const [activeTab, setActiveTab] = useState<'fields' | 'concepts'>('fields');
  const [conceptSearch, setConceptSearch] = useState('');
  const [conceptResults, setConceptResults] = useState<CodedValue[]>([]);
  const [searching, setSearching] = useState(false);

  const categories = [
    { id: 'basic', name: 'Basic Fields', color: 'text-blue-600' },
    { id: 'medical', name: 'Medical Fields', color: 'text-red-600' },
    { id: 'isbar', name: 'ISBAR Fields', color: 'text-green-600' },
    { id: 'advanced', name: 'Advanced Fields', color: 'text-purple-600' }
  ];

  const groupedFields = fieldTemplates.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, typeof fieldTemplates>);

  const handleConceptSearch = async (query: string) => {
    setConceptSearch(query);
    if (query.length < 2) {
      setConceptResults([]);
      return;
    }

    setSearching(true);
    try {
      // Use general search (search all systems)
      const results = await TerminologyService.getInstance().search(query, { system: 'All' } as any);
      setConceptResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const addConceptField = (concept: CodedValue) => {
    // Determine field type based on concept datatype
    let fieldType = 'text';
    let defaultProps: any = {};

    if (concept.datatype === 'number') {
      fieldType = 'number';
      defaultProps = { units: concept.units };
    } else if (concept.datatype === 'boolean') {
      fieldType = 'select'; // or radio? select is safer
      defaultProps = {
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' }
        ]
      };
    } else {
      fieldType = 'text'; // Default to text
    }

    const newField = {
      type: fieldType,
      defaultProps: {
        label: concept.display,
        placeholder: `Enter ${concept.display}...`,
        ...defaultProps,
        conceptBinding: concept,
        description: `Concept: ${concept.code} (${concept.system})`
      }
    };
    onAddField(newField);
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('fields')}
          className={`flex-1 py-3 text-sm font-medium text-center ${activeTab === 'fields' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Generic Fields
        </button>
        <button
          onClick={() => setActiveTab('concepts')}
          className={`flex-1 py-3 text-sm font-medium text-center ${activeTab === 'concepts' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Clinical Concepts
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'fields' ? (
          <div className="space-y-6">
            <p className="text-sm text-gray-600 mb-2">
              Drag and drop to add fields:
            </p>
            {categories.map((category) => {
              const fields = groupedFields[category.id] || [];
              return (
                <div key={category.id}>
                  <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${category.color}`}>
                    {category.name}
                  </h4>
                  <div className="space-y-2">
                    {fields.map((field) => {
                      const IconComponent = (LucideIcons as any)[field.icon];
                      return (
                        <button
                          key={field.type}
                          onClick={() => onAddField(field)}
                          className="w-full flex items-center p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:ring-1 hover:ring-blue-300 hover:bg-blue-50 transition-all group"
                        >
                          <div className={`p-2 rounded-md mr-3 ${field.category === 'medical' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'} group-hover:bg-white`}>
                            {IconComponent && <IconComponent className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                              {field.label}
                            </div>
                            <div className="text-xs text-gray-500">
                              {field.type}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 ml-auto text-gray-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Search Terminology
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={conceptSearch}
                  onChange={(e) => handleConceptSearch(e.target.value)}
                  placeholder="e.g. Heart Rate, Cough..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                {searching && (
                  <div className="absolute right-3 top-2.5">
                    <Spinner size="xs" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Search ICD-11, LOINC, and Nursing terms to create concept-bound fields.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {conceptResults.length > 0 ? (
                conceptResults.map((concept) => (
                  <button
                    key={`${concept.system}-${concept.code}`}
                    onClick={() => addConceptField(concept)}
                    className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm text-gray-900 group-hover:text-blue-700 line-clamp-2">
                        {concept.display}
                      </span>
                      {concept.datatype && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {concept.datatype === 'number' ? 'NUM' : concept.datatype === 'boolean' ? 'BOOL' : 'TXT'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center text-xs text-gray-500 font-mono">
                      <Database className="w-3 h-3 mr-1" />
                      {concept.code} • {concept.system}
                    </div>
                  </button>
                ))
              ) : (
                conceptSearch.length > 1 && !searching && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No concepts found. Check spelling or try a broad term like "Vital".
                  </div>
                )
              )}

              {!conceptSearch && (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm mb-4">Start typing to search the dictionary...</p>
                  <button
                    onClick={async () => {
                      setSearching(true);
                      try {
                        await TerminologyService.getInstance().seedBahmni();
                        alert('✅ Bahmni concepts loaded! Try searching for "Pallor" or "Pulse" now.');
                      } catch (err) {
                        alert('❌ Failed to load concepts. Ensure backend is running.');
                      } finally {
                        setSearching(false);
                      }
                    }}
                    className="px-4 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                  >
                    Load Bahmni Concepts
                  </button>
                  <p className="text-[10px] text-gray-400 mt-2">
                    Click if search is empty (initial setup)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
