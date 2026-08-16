import React, { useState, useRef, useCallback } from 'react';
import { Search, Settings, Download, Upload } from 'lucide-react';
import { FormTemplate } from '../../types/formBuilder';
import { useDepartments } from '../../hooks/useDepartments';

interface TemplateManagerProps {
  templates: FormTemplate[];
  onEdit: (template: FormTemplate) => void;
  onPreview: (template: FormTemplate) => void;
  onDelete: (templateId: string) => void;
  onToggleActive: (templateId: string) => void;
  onImport: (templates: FormTemplate[]) => void;
  userRole: string;
  userDepartment: string;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  templates,
  onEdit,
  onPreview,
  onDelete,
  onToggleActive,
  onImport,
  userRole,
  userDepartment
}) => {
  const { departments } = useDepartments();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [isImporting, setIsImporting] = useState(false);

  // Filter templates based on user permissions and search criteria (supports multiple departments)
  const filteredTemplates = templates.filter(template => {
    const hasDept = (dept: string) =>
      (Array.isArray((template as any).departments) && (template as any).departments.includes(dept)) ||
      template.department === dept;

    const matchesDepartment = userRole === 'admin' || (userDepartment && hasDept(userDepartment));
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDeptFilter = filterDepartment === 'All' || hasDept(filterDepartment);
    const matchesStatus = filterStatus === 'All' ||
      (filterStatus === 'Active' && Boolean(template.isActive)) ||
      (filterStatus === 'Inactive' && !Boolean(template.isActive));

    return matchesDepartment && matchesSearch && matchesDeptFilter && matchesStatus;
  });

  const getDepartmentColor = (_department: string) => {
    return 'bg-blue-100 text-blue-800'; // Simplified or could use a hash function for dynamic colors
  };

  // Enhanced CSV Download with proper field serialization (templates)
  const downloadCSV = () => {
    try {
      const csvHeaders = [
        'Template ID',
        'Template Name',
        'Department',
        'Description',
        'Version',
        'Active Status',
        'Created By',
        'Created Date',
        'Field Count',
        'Fields JSON'
      ];

      const csvRows = [
        csvHeaders,
        ...filteredTemplates.map(template => [
          template.id?.toString() || '',
          template.name || '',
          template.department || '',
          template.description || '',
          template.version?.toString() || '1',
          (template.isActive || (template as any).is_active) ? 'Active' : 'Inactive',
          template.createdBy || '',
          template.createdAt ? new Date(new Date(template.createdAt).getTime() + 3 * 3600 * 1000).toLocaleDateString() : '',
          template.fields?.length?.toString() || '0',
          JSON.stringify(template.fields || [])
        ])
      ];

      const csvContent = csvRows.map(row =>
        row.map(cell => {
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return '"' + cellStr.replace(/"/g, '""') + '"';
          }
          return cellStr;
        }).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `form_templates_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`Successfully exported ${filteredTemplates.length} templates to CSV`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting templates to CSV. Please try again.');
    }
  };

  // Export selected template in Kobo-style CSV (type,name,label with begin_group/end_group)
  const exportKoboCSV = (template: FormTemplate) => {
    try {
      const headers = ['type', 'name', 'label'];
      const lines: string[][] = [headers];
      const slug = (s: string) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
      const sections = (template.sections || []).slice().sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      const fields = template.fields || [];
      const fieldsBySection: Record<string, any[]> = {};
      fields.forEach((f: any) => {
        const key = f.section || 'main-section';
        (fieldsBySection[key] = fieldsBySection[key] || []).push(f);
      });

      const mapType = (f: any): string => {
        const t = String(f.type || '').toLowerCase();
        if (t === 'number') return 'integer';
        if (t === 'textarea') return 'text';
        if (t === 'date') return 'date';
        if (t === 'time') return 'time';
        if (t === 'measurement') return f.mode === 'bp' ? 'text' : 'decimal';
        if (t === 'multiselect' || t === 'checkbox') return `${f.selectionMode === 'single' ? 'select_one' : 'select_multiple'} list_${slug(f.id || f.name || 'opt')} `;
        if (t === 'select' || t === 'dropdown' || t === 'radio' || t === 'stability') return `select_one list_${slug(f.id || f.name || 'opt')} `;
        return 'text';
      };

      const pushRow = (a: string, b: string, c: string) => {
        const row = [a, b, c].map((cell) => {
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return '"' + cell.replace(/"/g, '""') + '"';
          }
          return cell;
        });
        lines.push(row);
      };

      const ensureMain = sections.length === 0;
      if (ensureMain) {
        pushRow('begin_group', 'main', template.name || 'Form');
        (fieldsBySection['main-section'] || fields).forEach((f: any) => {
          pushRow(mapType(f), f.name || slug(f.label || ''), f.label || f.name || '');
        });
        pushRow('end_group', '', '');
      } else {
        sections.forEach((sec: any) => {
          const sid = sec.id || slug(sec.name || 'section');
          pushRow('begin_group', sid, sec.name || sid);
          (fieldsBySection[sid] || []).forEach((f: any) => {
            pushRow(mapType(f), f.name || slug(f.label || ''), f.label || f.name || '');
          });
          pushRow('end_group', '', '');
        });
      }

      const csv = lines.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const base = (template.name || 'template').toLowerCase().replace(/[^a-z0-9]+/g, '_');
      link.download = `${base}_kobo_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert('Kobo-style CSV exported for template.');
    } catch (err) {
      console.error('Error exporting Kobo CSV:', err);
      alert('Error exporting Kobo CSV.');
    }
  };

  // Export one row per field, including type, section, and key props
  const downloadFieldsCSV = () => {
    try {
      const csvHeaders = [
        'Template ID', 'Template Name', 'Department', 'Version', 'Active Status',
        'Section ID', 'Section Name', 'Field ID', 'Field Label', 'Field Name', 'Field Type',
        'Required', 'Width', 'Placeholder', 'Rows', 'Min', 'Max', 'Options', 'Validation JSON'
      ];

      const rows: string[][] = [csvHeaders];

      filteredTemplates.forEach((t) => {
        const sectionsById: Record<string, any> = {};
        (t.sections || []).forEach((s: any) => { sectionsById[s.id] = s; });
        (t.fields || []).forEach((f: any) => {
          const sec = f.section ? sectionsById[f.section] : null;
          const options = f.options ? JSON.stringify(f.options) : '';
          const validation = f.validation ? JSON.stringify(f.validation) : '';
          rows.push([
            t.id?.toString() || '',
            t.name || '',
            t.department || '',
            t.version?.toString() || '1',
            (t.isActive || (t as any).is_active) ? 'Active' : 'Inactive',
            f.section || '',
            sec?.name || '',
            f.id?.toString() || '',
            f.label || '',
            f.name || '',
            f.type || '',
            f.required ? 'true' : 'false',
            f.width || '',
            f.placeholder || '',
            (f.rows ?? '').toString(),
            (f.min ?? '').toString(),
            (f.max ?? '').toString(),
            options,
            validation
          ]);
        });
      });

      const csvContent = rows.map(row =>
        row.map(cell => {
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return '"' + cellStr.replace(/"/g, '""') + '"';
          }
          return cellStr;
        }).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `form_fields_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert('Fields CSV exported.');
    } catch (error) {
      console.error('Error exporting fields CSV:', error);
      alert('Error exporting fields CSV.');
    }
  };

  // Enhanced CSV Upload with better parsing and validation
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          throw new Error('File is empty');
        }

        // Parse CSV with proper handling of quoted fields
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) {
          throw new Error('CSV file must have at least a header row and one data row');
        }

        const headers = parseCSVLine(lines[0]);
        console.log('CSV Headers:', headers);

        const headersLower = headers.map(h => h.trim().toLowerCase());
        const hasKoboHeaders = ['type', 'name', 'label'].every(h => headersLower.includes(h));
        const hasFieldHeaders = headersLower.some(h => h.includes('field label')) || headersLower.some(h => h.includes('field type'));
        const dataRows = lines.slice(1);

        // Kobo-style (survey) CSV import
        if (hasKoboHeaders) {
          const get = (obj: Record<string, string>, key: string) => {
            const hit = Object.keys(obj).find(k => k.trim().toLowerCase() === key);
            return hit ? obj[hit] : '';
          };
          const fileBase = (file.name || 'Imported').replace(/\.csv$/i, '');
          const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');

          const tmpl: FormTemplate = {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            name: fileBase,
            department: 'Medical Ward',
            description: `Imported from Kobo CSV: ${fileBase} `,
            version: 1,
            isActive: false,
            fields: [],
            sections: [],
            createdBy: 'csv-import',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as any;

          let currentSectionId: string | null = null;

          dataRows.forEach((row, idx) => {
            const values = parseCSVLine(row);
            const rowData: Record<string, string> = {};
            headers.forEach((h, i) => { rowData[h] = values[i] || ''; });
            const typeRaw = get(rowData, 'type').trim();
            const parts = typeRaw.split(/\s+/);
            const baseType = parts[0]?.toLowerCase() || '';
            const typeArg = parts[1] || '';
            const name = get(rowData, 'name').trim();
            const label = get(rowData, 'label').trim();

            if (!typeRaw) return;
            if (baseType === 'begin_group') {
              const sid = name || slug(label || 'section');
              tmpl.sections!.push({ id: sid, name: label || sid, description: '', order: (tmpl.sections!.length || 0) + 1, isCollapsible: true, isCollapsed: false } as any);
              currentSectionId = sid;
              return;
            }
            if (baseType === 'end_group') {
              currentSectionId = null;
              return;
            }

            // Map field types
            let ftype = 'text';
            if (baseType === 'text') ftype = 'text';
            else if (baseType === 'integer' || baseType === 'decimal' || baseType === 'number') ftype = 'number';
            else if (baseType === 'date') ftype = 'date';
            else if (baseType === 'time') ftype = 'time';
            else if (baseType === 'select_one') ftype = 'dropdown';
            else if (baseType === 'select_multiple') ftype = 'multiselect';

            const field: any = {
              id: name || slug(label),
              name: name || slug(label),
              label: label || name,
              type: ftype,
              section: currentSectionId || 'main-section',
              required: false,
              width: 'full'
            };
            (tmpl.fields as any[]).push(field);
          });

          if ((tmpl.sections || []).length === 0) {
            tmpl.sections = [{ id: 'main-section', name: 'Main Section', description: '', order: 1, isCollapsible: false, isCollapsed: false } as any];
          }

          onImport([tmpl]);
          alert('Successfully imported Kobo-style CSV as a template');
          if (fileInputRef.current) fileInputRef.current.value = '';
          setIsImporting(false);
          return;
        }

        // Field-wise CSV import (one row per field)
        if (hasFieldHeaders) {
          const required = ['Template Name', 'Department', 'Field Label', 'Field Type'];
          const missing = required.filter(h => !headers.some(x => x.toLowerCase() === h.toLowerCase()));
          if (missing.length > 0) throw new Error(`Missing required headers: ${missing.join(', ')} `);

          const byKey: Record<string, FormTemplate> = {};
          const getCell = (rowData: Record<string, string>, ...names: string[]) => {
            for (const n of names) {
              const hit = Object.keys(rowData).find(k => k.toLowerCase() === n.toLowerCase());
              if (hit) return rowData[hit];
            }
            return '';
          };
          const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');

          dataRows.forEach((row, idx) => {
            const values = parseCSVLine(row);
            const rowData: Record<string, string> = {};
            headers.forEach((h, i) => { rowData[h] = values[i] || ''; });

            const tName = getCell(rowData, 'Template Name');
            const dept = getCell(rowData, 'Department');
            if (!tName || !dept) return;
            const key = `${tName}__${dept} `;
            if (!byKey[key]) {
              byKey[key] = {
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                name: tName,
                department: dept,
                description: getCell(rowData, 'Description') || `Imported ${tName} `,
                version: parseInt(getCell(rowData, 'Version') || '1') || 1,
                isActive: (getCell(rowData, 'Active Status') || '').toLowerCase() === 'active',
                fields: [],
                sections: [],
                createdBy: 'csv-import',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              } as any;
            }
            const tmpl = byKey[key];

            // Section
            const secName = getCell(rowData, 'Section Name') || 'Main Section';
            const secId = getCell(rowData, 'Section ID') || slug(`section - ${secName} `);
            let sec = (tmpl.sections as any[]).find((s: any) => s.id === secId);
            if (!sec) {
              sec = { id: secId, name: secName, description: '', order: (tmpl.sections?.length || 0) + 1, isCollapsible: true, isCollapsed: false };
              (tmpl.sections as any[]).push(sec);
            }

            // Field
            const optionsCell = getCell(rowData, 'Options');
            let options: any = undefined;
            if (optionsCell) {
              try { options = JSON.parse(optionsCell); } catch { options = optionsCell.split(/;|\|/).map(s => s.trim()).filter(Boolean); }
            }
            const validationCell = getCell(rowData, 'Validation JSON');
            let validation: any = undefined;
            if (validationCell) {
              try { validation = JSON.parse(validationCell); } catch { validation = undefined; }
            }

            const field: any = {
              id: getCell(rowData, 'Field ID') || slug(getCell(rowData, 'Field Label')),
              label: getCell(rowData, 'Field Label'),
              name: getCell(rowData, 'Field Name') || slug(getCell(rowData, 'Field Label')),
              type: getCell(rowData, 'Field Type').toLowerCase(),
              required: (getCell(rowData, 'Required') || '').toLowerCase() === 'true',
              width: getCell(rowData, 'Width') || 'full',
              placeholder: getCell(rowData, 'Placeholder') || '',
              rows: parseInt(getCell(rowData, 'Rows') || '0') || undefined,
              min: parseFloat(getCell(rowData, 'Min') || '') || undefined,
              max: parseFloat(getCell(rowData, 'Max') || '') || undefined,
              options,
              validation,
              section: secId
            };
            (tmpl.fields as any[]).push(field);
          });

          const importedTemplates = Object.values(byKey);
          if (importedTemplates.length === 0) throw new Error('No valid field rows found');
          onImport(importedTemplates);
          alert(`Successfully imported ${importedTemplates.length} templates from field CSV`);
          if (fileInputRef.current) fileInputRef.current.value = '';
          setIsImporting(false);
          return;
        }

        // Default: template-wise CSV (expects Fields JSON column)
        // Validate required headers
        const requiredHeaders = ['Template Name', 'Department'];
        const missingHeaders = requiredHeaders.filter(header =>
          !headers.some(h => h.toLowerCase().includes(header.toLowerCase()))
        );

        if (missingHeaders.length > 0) {
          throw new Error(`Missing required headers: ${missingHeaders.join(', ')} `);
        }

        const importedTemplates: FormTemplate[] = [];

        dataRows.forEach((row, index) => {
          try {
            const values = parseCSVLine(row);
            if (values.length < headers.length) {
              console.warn(`Row ${index + 2} has fewer columns than headers, padding with empty values`);
              while (values.length < headers.length) {
                values.push('');
              }
            }

            const rowData: Record<string, string> = {};
            headers.forEach((header, i) => {
              rowData[header] = values[i] || '';
            });

            // Extract template data
            const templateName = rowData['Template Name'] || rowData['name'] || '';
            const department = rowData['Department'] || rowData['department'] || '';

            if (!templateName.trim()) {
              console.warn(`Row ${index + 2}: Missing template name, skipping`);
              return;
            }

            if (!department.trim()) {
              console.warn(`Row ${index + 2}: Missing department, skipping`);
              return;
            }

            // Validate department
            if (!departments.includes(department)) {
              console.warn(`Row ${index + 2}: Invalid department "${department}", skipping`);
              return;
            }

            // Parse fields JSON if present
            let fields: any[] = [];
            const fieldsJSON = rowData['Fields JSON'] || rowData['fields'] || '';
            if (fieldsJSON.trim()) {
              try {
                fields = JSON.parse(fieldsJSON);
                if (!Array.isArray(fields)) {
                  fields = [];
                }
              } catch (e) {
                console.warn(`Row ${index + 2}: Invalid fields JSON, using empty fields array`);
                fields = [];
              }
            }

            const template: FormTemplate = {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              name: templateName,
              department: department,
              description: rowData['Description'] || rowData['description'] || `Imported template: ${templateName} `,
              version: parseInt(rowData['Version'] || rowData['version'] || '1') || 1,
              isActive: (rowData['Active Status'] || rowData['active'] || '').toLowerCase() === 'active',
              fields: fields,
              sections: [
                {
                  id: 'main-section',
                  name: 'Main Section',
                  description: 'Imported form section',
                  order: 1,
                  isCollapsible: false,
                  isCollapsed: false
                }
              ],
              createdBy: rowData['Created By'] || rowData['createdBy'] || 'csv-import',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            importedTemplates.push(template);
          } catch (rowError) {
            console.error(`Error processing row ${index + 2}: `, rowError);
          }
        });

        if (importedTemplates.length === 0) {
          throw new Error('No valid templates found in CSV file');
        }

        console.log(`Successfully parsed ${importedTemplates.length} templates from CSV`);
        onImport(importedTemplates);

        alert(`Successfully imported ${importedTemplates.length} templates from CSV`);

        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

      } catch (error) {
        console.error('CSV Import Error:', error);
        alert(`Error importing CSV: ${error instanceof Error ? error.message : 'Unknown error'} `);
      } finally {
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      setIsImporting(false);
      alert('Error reading file. Please try again.');
    };

    reader.readAsText(file);
  };

  // Helper function to parse CSV line with proper quote handling
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    result.push(current);
    return result;
  };

  return (
    <div className="space-y-5">
      {/* CSV Import/Export Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Import/Export Templates</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={downloadCSV}
            disabled={filteredTemplates.length === 0}
            className="flex items-center px-4 py-2 bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Templates CSV
          </button>

          <button
            onClick={downloadFieldsCSV}
            disabled={filteredTemplates.length === 0}
            className="flex items-center px-4 py-2 bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Fields CSV
          </button>

          <button
            onClick={handleUploadClick}
            disabled={isImporting}
            className="flex items-center px-4 py-2 bg-[#003153] text-white rounded-lg text-sm font-semibold hover:bg-[#002640] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isImporting ? 'Importing...' : 'Import CSV'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            className="hidden"
          />

          <div className="text-xs text-gray-400">
            <p>Export Templates CSV: One row per template (with Fields JSON)</p>
            <p>Export Fields CSV: One row per field (type, section, options, validation)</p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {userRole === 'admin' && (
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="All">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          )}

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'All' | 'Active' | 'Inactive')}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="mt-3 text-xs text-gray-400">
          Found {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
        </div>
      </div>

      {filteredTemplates.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-xs text-gray-400">
            {searchTerm || filterDepartment !== 'All' || filterStatus !== 'All'
              ? 'No templates match your search criteria.'
              : 'No templates yet. Create your first form above.'
            }
          </p>
        </div>
      )}
    </div>
  );
};
