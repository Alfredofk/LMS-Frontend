import React, { useEffect, useRef, useState } from 'react';
import { Bold, Heading3, Italic, Link2, List, ListOrdered, Pilcrow, Quote, Underline } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';

/*
  A small editor for a TEXT material (owner, 2026-10-04: simple, no new library).
  A contentEditable box and a toolbar for what the server keeps (content.service.js
  TEXT_RULES: p, strong/em/u, h3, ul/ol/li, blockquote, https links) - nothing it
  would strip. The server sanitises what arrives anyway; this only keeps the
  teacher from formatting something that would vanish on save.

  document.execCommand is deprecated but still the one way to edit rich text in
  every browser without a library, and enough for these few commands.

  @param value     the starting HTML (read once, when the editor mounts)
  @param onChange  (html) => void, on every edit
*/

const TOOLS = [
  { key: 'bold', icon: Bold, command: 'bold' },
  { key: 'italic', icon: Italic, command: 'italic' },
  { key: 'underline', icon: Underline, command: 'underline' },
  { key: 'heading', icon: Heading3, command: 'formatBlock', arg: 'h3' },
  { key: 'paragraph', icon: Pilcrow, command: 'formatBlock', arg: 'p' },
  { key: 'bullets', icon: List, command: 'insertUnorderedList' },
  { key: 'numbers', icon: ListOrdered, command: 'insertOrderedList' },
  { key: 'quote', icon: Quote, command: 'formatBlock', arg: 'blockquote' },
];

export const TextEditor = ({ id, value = '', onChange, disabled = false, invalid = false, labelledBy }) => {
  const { t } = useT();
  const boxRef = useRef(null);
  const savedRange = useRef(null);
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState('https://');

  useEffect(() => {
    if (boxRef.current) boxRef.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the starting HTML only; later edits live in the DOM
  }, []);

  const emit = () => onChange(boxRef.current?.innerHTML ?? '');

  const run = (command, arg) => {
    boxRef.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const startLink = () => {
    const selection = window.getSelection();
    savedRange.current = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    setHref('https://');
    setLinking(true);
  };

  const applyLink = () => {
    const url = href.trim();
    setLinking(false);
    if (!/^https:\/\/\S+$/i.test(url)) return;
    boxRef.current?.focus();
    const selection = window.getSelection();
    if (savedRange.current && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
    if (selection && !selection.isCollapsed) document.execCommand('createLink', false, url);
    else document.execCommand('insertHTML', false, `<a href="${url.replace(/"/g, '&quot;')}">${url.replace(/</g, '&lt;')}</a>`);
    emit();
  };

  return (
    <div className={`rounded-xl border bg-white ${invalid ? 'border-red-400' : 'border-slate-200'} ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-slate-100" role="toolbar" aria-label={t('teach.editor.toolbar')}>
        {TOOLS.map(({ key, icon, command, arg }) => {
          const Icon = icon;
          return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(command, arg)}
            title={t(`teach.editor.${key}`)}
            aria-label={t(`teach.editor.${key}`)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed"
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
          </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={startLink}
          title={t('teach.editor.link')}
          aria-label={t('teach.editor.link')}
          aria-expanded={linking}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed"
        >
          <Link2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {linking && (
        <div className="flex flex-col sm:flex-row gap-2 p-2 border-b border-slate-100 bg-slate-50">
          <input
            type="url"
            value={href}
            autoFocus
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              }
              if (e.key === 'Escape') setLinking(false);
            }}
            aria-label={t('teach.editor.linkUrl')}
            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
          <div className="flex gap-2">
            <button type="button" onClick={applyLink} className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-extrabold hover:bg-brand-deep cursor-pointer">
              {t('teach.editor.linkAdd')}
            </button>
            <button type="button" onClick={() => setLinking(false)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      <div
        ref={boxRef}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        aria-invalid={invalid || undefined}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        className="content-html min-h-40 max-h-96 overflow-y-auto px-3.5 py-3 text-sm text-slate-800 focus:outline-none"
      />
    </div>
  );
};

export default TextEditor;
