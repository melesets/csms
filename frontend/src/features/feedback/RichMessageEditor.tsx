// RichMessageEditor - modern message writing area for feedback
// Header section with automatic Ethiopian date + full formatting toolbar
// (bold / italic / underline / strikethrough / bullets / alignment /
// text color / text size / font style) over a formal minute-book ruled page.
import React, { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, Type, Palette, CalendarDays, FileText, User,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Strikethrough, RemoveFormatting
} from 'lucide-react';
import { getCurrentEthiopianDate, formatEthiopianDate, getEthiopianWeekdayName } from '../../utils/ethiopianCalendar';

const SIZES = [
  { label: 'Small', px: '12px' },
  { label: 'Normal', px: '15px' },
  { label: 'Large', px: '20px' },
  { label: 'XL', px: '26px' },
];

const COLORS = [
  { label: 'Black', value: '#1f2937' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Green', value: '#059669' },
  { label: 'Purple', value: '#9333ea' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Teal', value: '#0d9488' },
];

const FONTS = [
  { label: 'Default', value: 'inherit' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Sans', value: 'Arial, sans-serif' },
  { label: 'Monospace', value: 'Consolas, monospace' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
];

const stripHtml = (html: string) =>
  (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

interface Props {
  value: string;
  onChange: (html: string) => void;
  userName?: string;
  department?: string | null;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

export default function RichMessageEditor({ value, onChange, userName, department, placeholder, maxLength = 2000, className = '' }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [states, setStates] = useState({ bold: false, italic: false, underline: false, strike: false, bullet: false, numbered: false, align: '' as string });
  const [showColors, setShowColors] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [showFonts, setShowFonts] = useState(false);
  const [len, setLen] = useState(stripHtml(value).length);

  const ethDate = getCurrentEthiopianDate();
  const dateLabel = `${getEthiopianWeekdayName(new Date(), 'full')}, ${formatEthiopianDate(ethDate, 'long')} EC`;

  const exec = (cmd: string, arg?: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, arg);
    if (cmd === 'fontSize') {
      // Convert <font size="7"> into a real pixel size (modern look)
      el.querySelectorAll('font[size]').forEach(f => {
        f.style.fontSize = arg || '15px';
        f.removeAttribute('size');
      });
    }
    if (cmd === 'fontName') {
      // Convert <font face="..."> into real font-family styles
      el.querySelectorAll('font[face]').forEach(f => {
        f.style.fontFamily = arg || 'inherit';
        f.removeAttribute('face');
      });
    }
    sync();
  };

  const sync = () => {
    const el = editorRef.current;
    if (!el) return;
    onChange(el.innerHTML);
    setLen(stripHtml(el.innerHTML).length);
    setStates({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      bullet: document.queryCommandState('insertUnorderedList'),
      numbered: document.queryCommandState('insertOrderedList'),
      align: ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull']
        .find(c => document.queryCommandState(c)) || '',
    });
  };

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    document.execCommand('defaultParagraphSeparator', false, 'div');
    const onSel = () => setStates({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      bullet: document.queryCommandState('insertUnorderedList'),
      numbered: document.queryCommandState('insertOrderedList'),
      align: ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull']
        .find(c => document.queryCommandState(c)) || '',
    });
    el.addEventListener('keyup', onSel);
    el.addEventListener('mouseup', onSel);
    document.addEventListener('selectionchange', onSel);
    return () => {
      el.removeEventListener('keyup', onSel);
      el.removeEventListener('mouseup', onSel);
      document.removeEventListener('selectionchange', onSel);
    };
  }, []);

  // Sync external reset (after submit)
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== value) {
      el.innerHTML = value;
      setLen(stripHtml(value).length);
    }
  }, [value]);

  const toolBtn = (active: boolean) =>
    `p-1.5 rounded-lg transition-colors ${active ? 'bg-[#003153] text-white' : 'text-gray-500 hover:bg-gray-100'}`;

  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm focus-within:ring-2 focus-within:ring-[#003153] flex flex-col min-h-0 ${className}`}>
      {/* Header section — automatic Ethiopian date */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 bg-gradient-to-r from-[#003153] to-[#0a4a7a] text-white">
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          <CalendarDays className="w-3.5 h-3.5 text-white/70" />
          Date: <span className="text-white">{dateLabel}</span>
        </div>
        {userName && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/90">
            <User className="w-3.5 h-3.5 text-white/70" />
            By: {userName}
          </div>
        )}
        {department && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/90">
            <FileText className="w-3.5 h-3.5 text-white/70" />
            Dept: {department}
          </div>
        )}
        <span className={`ml-auto text-[10px] font-semibold ${len > maxLength * 0.9 ? 'text-amber-300' : 'text-white/60'}`}>
          {len}/{maxLength}
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-2.5 py-1.5 border-b border-gray-100 bg-gray-50/70 select-none" onMouseDown={e => e.preventDefault()}>
        <button type="button" onClick={() => exec('bold')} title="Bold" className={toolBtn(states.bold)}>
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('italic')} title="Italic" className={toolBtn(states.italic)}>
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('underline')} title="Underline" className={toolBtn(states.underline)}>
          <Underline className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('strikeThrough')} title="Strikethrough" className={toolBtn(states.strike)}>
          <Strikethrough className="w-4 h-4" />
        </button>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <button type="button" onClick={() => exec('insertUnorderedList')} title="Bullet list" className={toolBtn(states.bullet)}>
          <List className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('insertOrderedList')} title="Numbered list" className={toolBtn(states.numbered)}>
          <ListOrdered className="w-4 h-4" />
        </button>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <button type="button" onClick={() => exec('justifyLeft')} title="Align left" className={toolBtn(states.align === 'justifyLeft')}>
          <AlignLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('justifyCenter')} title="Center" className={toolBtn(states.align === 'justifyCenter')}>
          <AlignCenter className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('justifyRight')} title="Align right" className={toolBtn(states.align === 'justifyRight')}>
          <AlignRight className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => exec('justifyFull')} title="Justify" className={toolBtn(states.align === 'justifyFull')}>
          <AlignJustify className="w-4 h-4" />
        </button>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        {/* Font style */}
        <div className="relative">
          <button type="button" onClick={() => { setShowFonts(v => !v); setShowColors(false); setShowSizes(false); }}
            title="Font style" className={`${toolBtn(false)} text-[10px] font-bold`}>
            Aa
          </button>
          {showFonts && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 min-w-[150px]" onMouseDown={e => e.preventDefault()}>
              {FONTS.map(f => (
                <button key={f.value} type="button" onClick={() => { exec('fontName', f.value); setShowFonts(false); }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-700 font-semibold"
                  style={{ fontFamily: f.value === 'inherit' ? undefined : f.value }}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text size */}
        <div className="relative">
          <button type="button" onClick={() => { setShowSizes(v => !v); setShowColors(false); setShowFonts(false); }}
            title="Text size" className={`${toolBtn(false)} flex items-center gap-1`}>
            <Type className="w-4 h-4" />
            <span className="text-[9px] font-bold">A</span>
          </button>
          {showSizes && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 min-w-[110px]" onMouseDown={e => e.preventDefault()}>
              {SIZES.map(s => (
                <button key={s.px} type="button" onClick={() => { exec('fontSize', s.px); setShowSizes(false); }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-700 font-semibold"
                  style={{ fontSize: s.px }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text color */}
        <div className="relative">
          <button type="button" onClick={() => { setShowColors(v => !v); setShowSizes(false); setShowFonts(false); }}
            title="Text color" className={`${toolBtn(false)} flex items-center gap-1`}>
            <Palette className="w-4 h-4" />
            <span className="w-3 h-1 rounded-full" style={{ background: COLORS[0].value }} />
          </button>
          {showColors && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2 flex gap-1.5" onMouseDown={e => e.preventDefault()}>
              {COLORS.map(c => (
                <button key={c.value} type="button" title={c.label}
                  onClick={() => { exec('foreColor', c.value); setShowColors(false); }}
                  className="w-6 h-6 rounded-full ring-1 ring-black/10 hover:scale-110 transition-transform"
                  style={{ background: c.value }} />
              ))}
            </div>
          )}
        </div>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <button type="button" onClick={() => exec('removeFormat')} title="Clear formatting"
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-500 transition-colors">
          <RemoveFormatting className="w-4 h-4" />
        </button>
      </div>

      {/* Ruled minute-book writing area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || 'Write your report here as minutes of the meeting...'}
        onInput={sync}
        onKeyUp={sync}
        className="minute-book w-full flex-1 min-h-[300px] overflow-y-auto px-0 py-3 outline-none"
      />
    </div>
  );
}