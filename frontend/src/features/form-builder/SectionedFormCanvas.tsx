import React from 'react';
import { DndContext, closestCenter, DragEndEvent, DragOverEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormField, FormSection } from '../../types/formBuilder';
import { GripVertical, ChevronDown, ChevronRight, Plus, Move } from 'lucide-react';

// Color schemes for sections
const SECTION_COLORS = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', accent: 'bg-blue-500', hover: 'hover:bg-blue-100' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', accent: 'bg-green-500', hover: 'hover:bg-green-100' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', accent: 'bg-purple-500', hover: 'hover:bg-purple-100' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', accent: 'bg-orange-500', hover: 'hover:bg-orange-100' },
  pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-900', accent: 'bg-pink-500', hover: 'hover:bg-pink-100' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900', accent: 'bg-indigo-500', hover: 'hover:bg-indigo-100' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-900', accent: 'bg-teal-500', hover: 'hover:bg-teal-100' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-900', accent: 'bg-gray-500', hover: 'hover:bg-gray-100' },
};

interface SectionedFormCanvasProps {
  fields: FormField[];
  sections: FormSection[];
  selectedField: FormField | null;
  onSelectField: (field: FormField) => void;
  onMoveField: (fieldId: string, newSectionId: string, newIndex: number) => void;
  onReorderSections: (oldIndex: number, newIndex: number) => void;
  onToggleSection: (sectionId: string) => void;
}

interface SortableFieldProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  sectionId: string;
}

const SortableField: React.FC<SortableFieldProps> = ({
  field,
  isSelected,
  onSelect,
  sectionId
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: field.id,
    data: {
      type: 'field',
      field,
      sectionId
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab hover:cursor-grabbing p-1 mr-2 hover:bg-gray-100 rounded"
            title="Drag to move field"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-900">
                {field.label}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {field.type}
                </span>
                {field.required && (
                  <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                    Required
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs text-gray-600">
              {field.placeholder || 'No placeholder'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DroppableSectionProps {
  section: FormSection;
  fields: FormField[];
  selectedField: FormField | null;
  onSelectField: (field: FormField) => void;
  onToggleSection: (sectionId: string) => void;
  isOver?: boolean;
}

const DroppableSection: React.FC<DroppableSectionProps> = ({
  section,
  fields,
  selectedField,
  onSelectField,
  onToggleSection,
  isOver = false
}) => {
  const sectionFields = fields.filter(field => field.section === section.id);

  const { setNodeRef } = useDroppable({
    id: section.id,
    data: {
      type: 'section',
      section
    }
  });

  return (
    <div 
      ref={setNodeRef}
      className={`border rounded-lg mb-4 transition-all duration-200 ${
        isOver 
          ? 'border-blue-400 bg-blue-50 shadow-md' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Section Header */}
      <div 
        className={`flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200 cursor-pointer transition-colors ${
          isOver ? 'bg-blue-100' : 'hover:bg-gray-100'
        }`}
        onClick={() => onToggleSection(section.id)}
      >
        <div className="flex items-center">
          {section.isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-500 mr-2" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500 mr-2" />
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-900">{section.name}</h3>
            {section.description && (
              <p className="text-xs text-gray-500 mt-1">{section.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            {sectionFields.length} field{sectionFields.length !== 1 ? 's' : ''}
          </span>
          {isOver && (
            <Move className="w-4 h-4 text-blue-500" />
          )}
        </div>
      </div>

      {/* Section Content */}
      {!section.isCollapsed && (
        <div className={`p-3 transition-colors ${isOver ? 'bg-blue-25' : ''}`}>
          {sectionFields.length === 0 ? (
            <div className={`text-center py-8 border-2 border-dashed rounded-lg transition-all ${
              isOver 
                ? 'border-blue-400 bg-blue-50 text-blue-700' 
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}>
              <Plus className={`w-8 h-8 mx-auto mb-2 ${isOver ? 'text-blue-500' : 'text-gray-400'}`} />
              <p className="text-sm">
                {isOver ? 'Drop field here' : 'Drop fields here or drag from the field library'}
              </p>
            </div>
          ) : (
            <SortableContext
              items={sectionFields.map(field => field.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {sectionFields.map((field) => (
                  <SortableField
                    key={field.id}
                    field={field}
                    isSelected={selectedField?.id === field.id}
                    onSelect={() => onSelectField(field)}
                    sectionId={section.id}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
};

export const SectionedFormCanvas: React.FC<SectionedFormCanvasProps> = ({
  fields,
  sections,
  selectedField,
  onSelectField,
  onMoveField,
  onReorderSections,
  onToggleSection
}) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setOverId(null);
    
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === 'field') {
      const fieldId = active.id as string;
      
      if (overData?.type === 'section') {
        // Dropped on a section
        const newSectionId = over.id as string;
        onMoveField(fieldId, newSectionId, 0);
      } else if (overData?.type === 'field') {
        // Dropped on another field
        const targetField = overData.field;
        const targetSectionId = overData.sectionId;
        const sectionFields = fields.filter(f => f.section === targetSectionId);
        const targetIndex = sectionFields.findIndex(f => f.id === targetField.id);
        
        onMoveField(fieldId, targetSectionId, targetIndex);
      }
    }
  };

  // Fields without a section (unassigned)
  const unassignedFields = fields.filter(field => !field.section);

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="space-y-4">
        {/* Unassigned Fields Section */}
        {unassignedFields.length > 0 && (
          <div className="border border-amber-200 rounded-lg bg-amber-50">
            <div className="p-3 border-b border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-amber-800">Unassigned Fields</h3>
                  <p className="text-xs text-amber-600 mt-1">
                    Drag these fields to a section to organize your form
                  </p>
                </div>
                <span className="text-xs text-amber-700 bg-amber-200 px-2 py-1 rounded">
                  {unassignedFields.length} field{unassignedFields.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="p-3">
              <SortableContext
                items={unassignedFields.map(field => field.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {unassignedFields.map((field) => (
                    <SortableField
                      key={field.id}
                      field={field}
                      isSelected={selectedField?.id === field.id}
                      onSelect={() => onSelectField(field)}
                      sectionId=""
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          </div>
        )}

        {/* Sections */}
        {sections.map((section) => (
          <DroppableSection
            key={section.id}
            section={section}
            fields={fields}
            selectedField={selectedField}
            onSelectField={onSelectField}
            onToggleSection={onToggleSection}
            isOver={overId === section.id}
          />
        ))}

        {/* Empty State */}
        {sections.length === 0 && fields.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
            <Plus className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Start Building Your Form
            </h3>
            <p className="text-gray-500 mb-4">
              Add sections to organize your form, then drag fields from the library.
            </p>
          </div>
        )}

        {/* Instructions */}
        {(sections.length > 0 || unassignedFields.length > 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Tips:</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Drag fields from the library on the left to add them to sections</li>
              <li>• Drag fields between sections to reorganize your form</li>
              <li>• Use the grip handle (⋮⋮) to drag fields around</li>
              <li>• Click on fields to edit their properties on the right</li>
              <li>• Yellow fields are unassigned - drag them to sections</li>
            </ul>
          </div>
        )}
      </div>
    </DndContext>
  );
};
