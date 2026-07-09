import React, { useState } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, GripVertical, Palette } from 'lucide-react';
import { FormSection } from '../../types/formBuilder';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface SectionManagerProps {
  sections: FormSection[];
  onAddSection: () => void;
  onUpdateSection: (section: FormSection) => void;
  onDeleteSection: (sectionId: string) => void;
  onToggleSection: (sectionId: string) => void;
  onReorderSections: (oldIndex: number, newIndex: number) => void;
  selectedSectionId?: string;
  onSelectSection: (sectionId: string) => void;
}

// Color options for sections
const SECTION_COLORS = [
  { name: 'Blue', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', accent: 'bg-blue-500' },
  { name: 'Green', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', accent: 'bg-green-500' },
  { name: 'Purple', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', accent: 'bg-purple-500' },
  { name: 'Orange', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', accent: 'bg-orange-500' },
  { name: 'Pink', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-900', accent: 'bg-pink-500' },
  { name: 'Indigo', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900', accent: 'bg-indigo-500' },
  { name: 'Teal', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-900', accent: 'bg-teal-500' },
  { name: 'Gray', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-900', accent: 'bg-gray-500' },
];

interface SortableSectionProps {
  section: FormSection;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (section: FormSection) => void;
  onDelete: () => void;
  onToggle: () => void;
}

const SortableSection: React.FC<SortableSectionProps> = ({
  section,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onToggle
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editName, setEditName] = useState(section.name);
  const [editDescription, setEditDescription] = useState(section.description || '');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Get current color scheme or default to blue
  const currentColor = SECTION_COLORS.find(color => 
    section.color === color.name.toLowerCase()
  ) || SECTION_COLORS[0];

  const handleSave = () => {
    onUpdate({
      ...section,
      name: editName,
      description: editDescription
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(section.name);
    setEditDescription(section.description || '');
    setIsEditing(false);
  };

  const handleColorChange = (color: typeof SECTION_COLORS[0]) => {
    onUpdate({
      ...section,
      color: color.name.toLowerCase()
    });
    setShowColorPicker(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-3 mb-2 transition-all duration-200 ${
        isSelected 
          ? `${currentColor.border} ${currentColor.bg} shadow-md` 
          : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
      }`}
    >
      {/* Color accent bar */}
      <div className={`h-1 ${currentColor.accent} rounded-full mb-3 opacity-60`}></div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab hover:cursor-grabbing p-1 mr-2 hover:bg-gray-100 rounded transition-colors"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
          
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 rounded mr-2 transition-colors"
          >
            {section.isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>

          <div className="flex-1" onClick={onSelect}>
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Section name"
                  autoFocus
                />
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Section description (optional)"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleSave}
                    className="px-3 py-1 text-xs bg-brand text-white rounded-lg hover:bg-brand-600 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className={`font-medium text-sm ${currentColor.text}`}>{section.name}</div>
                {section.description && (
                  <div className="text-xs text-gray-500 mt-1">{section.description}</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {/* Color picker */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Change section color"
            >
              <Palette className="w-3 h-3" />
            </button>
            
            {showColorPicker && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
                <div className="grid grid-cols-4 gap-1">
                  {SECTION_COLORS.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => handleColorChange(color)}
                      className={`w-6 h-6 rounded-full ${color.accent} hover:scale-110 transition-transform ${
                        currentColor.name === color.name ? 'ring-2 ring-gray-400' : ''
                      }`}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Edit section"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete section"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const SectionManager: React.FC<SectionManagerProps> = ({
  sections,
  onAddSection,
  onUpdateSection,
  onDeleteSection,
  onToggleSection,
  onReorderSections,
  selectedSectionId,
  onSelectSection
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = sections.findIndex((section) => section.id === active.id);
      const newIndex = sections.findIndex((section) => section.id === over.id);
      
      onReorderSections(oldIndex, newIndex);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">Form Sections</h4>
        <button
          onClick={onAddSection}
          className="flex items-center px-3 py-2 text-xs bg-brand text-white rounded-lg hover:bg-brand-600 transition-colors shadow-sm"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Section
        </button>
      </div>

      <div className="space-y-2">
        {sections.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <Palette className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="font-medium">No sections yet</p>
            <p className="text-xs mt-1">Add a section to organize your form fields with colors</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map((section) => (
                <SortableSection
                  key={section.id}
                  section={section}
                  isSelected={selectedSectionId === section.id}
                  onSelect={() => onSelectSection(section.id)}
                  onUpdate={onUpdateSection}
                  onDelete={() => onDeleteSection(section.id)}
                  onToggle={() => onToggleSection(section.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="text-xs text-gray-500 mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <p>• <strong>Drag</strong> sections to reorder them</p>
          <p>• <strong>Click palette</strong> to change colors</p>
          <p>• <strong>Click arrow</strong> to collapse/expand</p>
          <p>• <strong>Fields</strong> will be grouped by section</p>
        </div>
      </div>
    </div>
  );
};
