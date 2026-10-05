import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

/*
  The app's one dropdown (owner, 2026-10-03: "semua dropdown ... 1 macam, yang
  di-polish").

  A native <select> draws its open list with the browser's own widget, which no
  CSS reaches — so the closed box could match the theme while the list stayed a
  grey system menu, different on every browser. This draws both.

  ## Drop-in for <select>

  It takes the same children — `<option>` and `<optgroup>`, arrays, fragments,
  `{cond && <option/>}` — and calls `onChange` with an event-shaped
  `{ target: { value, name, id } }`, so every caller that read `e.target.value`
  keeps working unchanged. An option with `value=""` is the placeholder: shown
  muted in the box, and still choosable unless it is `disabled`.

  ## Focus never leaves the box

  The trigger is a `role="combobox"` button that keeps focus while the list is
  open and points at the highlighted option through `aria-activedescendant`
  (the WAI-ARIA select-only combobox). The dialogs in this app catch Escape on
  `document` and close themselves; keeping focus here lets the first Escape
  close only the list — its handler stops the event before it gets there.

  ## Why a portal

  Dialogs and cards here clip with `overflow: hidden|auto`. The list is placed
  `fixed` against the trigger's rectangle in <body>, above dialogs (z-60), and
  opens upward when there is no room below. It follows the trigger on scroll
  and resize.
*/

const textOf = (node) => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement(node)) return textOf(node.props.children);
  return '';
};

/* <option>/<optgroup> children → [{ type: 'group', label } | { type: 'option', value, label, disabled }]. */
const collect = (children, out = []) => {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      collect(child.props.children, out);
    } else if (child.type === 'optgroup') {
      out.push({ type: 'group', label: child.props.label });
      collect(child.props.children, out);
    } else if (child.type === 'option') {
      const label = textOf(child.props.children);
      out.push({
        type: 'option',
        value: String(child.props.value ?? label),
        label,
        disabled: Boolean(child.props.disabled),
      });
    }
  });
  return out;
};

const SIZES = {
  /* Matches Input: the form fields. */
  md: 'py-2.5 md:py-3 pl-4 pr-11 text-base rounded-xl',
  /* Filters and rows inside cards. */
  sm: 'py-2 pl-3 pr-9 text-xs font-bold rounded-xl',
  /* Beside text inputs of the same height inside a dialog row. */
  row: 'py-2 pl-3 pr-9 text-sm rounded-xl',
};

const CHEVRON = {
  md: 'right-4 w-4 h-4',
  sm: 'right-3 w-3.5 h-3.5',
  row: 'right-3 w-4 h-4',
};

const LIST_MAX = 288;
const GAP = 6;

export const Select = ({
  id,
  name,
  value,
  onChange,
  disabled = false,
  invalid = false,
  size = 'md',
  className = '',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  children,
}) => {
  const autoId = useId();
  const baseId = id ?? `select-${autoId.replace(/:/g, '')}`;
  const listId = `${baseId}-list`;
  const optionId = (i) => `${baseId}-opt-${i}`;

  const items = useMemo(() => collect(children), [children]);
  const current = String(value ?? '');
  const selectedIndex = items.findIndex((item) => item.type === 'option' && item.value === current);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState(null);

  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const typed = useRef({ text: '', at: 0 });

  const enabled = (i) => items[i]?.type === 'option' && !items[i].disabled;

  const step = useCallback(
    (from, dir) => {
      for (let i = from + dir; i >= 0 && i < items.length; i += dir) {
        if (items[i].type === 'option' && !items[i].disabled) return i;
      }
      return from;
    },
    [items]
  );
  const first = () => step(-1, 1);
  const last = () => step(items.length, -1);

  const choose = (i) => {
    if (!enabled(i)) return;
    setOpen(false);
    if (items[i].value !== current) {
      onChange?.({ target: { value: items[i].value, name: name ?? id, id }, currentTarget: { value: items[i].value } });
    }
  };

  const openList = (at) => {
    if (disabled) return;
    setActive(at ?? (enabled(selectedIndex) ? selectedIndex : first()));
    setOpen(true);
  };

  /* Where the list goes: under the trigger, or over it when there is no room below. */
  const measure = useCallback(() => {
    const box = triggerRef.current?.getBoundingClientRect();
    if (!box) return;
    const below = window.innerHeight - box.bottom - GAP - 8;
    const above = box.top - GAP - 8;
    const up = below < Math.min(LIST_MAX, 200) && above > below;
    const width = Math.max(box.width, 180);
    const left = Math.min(Math.max(8, box.left), Math.max(8, window.innerWidth - width - 8));
    setPlace({
      left,
      width,
      maxHeight: Math.max(120, Math.min(LIST_MAX, up ? above : below)),
      ...(up ? { bottom: window.innerHeight - box.top + GAP } : { top: box.bottom + GAP }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    measure();
    let frame = 0;
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [open, measure]);

  /* A press anywhere else closes the list, as a native one does. */
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (triggerRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  /* Keep the highlighted option in view while arrowing through a long list. */
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  /* Type a letter to jump to the option that starts with it, open or closed. */
  const typeAhead = (key) => {
    const now = Date.now();
    const text = now - typed.current.at < 600 ? typed.current.text + key : key;
    typed.current = { text, at: now };
    const from = open ? active : selectedIndex;
    const order = [...items.keys()].map((k) => (from + 1 + k) % items.length);
    const hit = order.find((i) => enabled(i) && items[i].label.toLowerCase().startsWith(text.toLowerCase()));
    if (hit === undefined) return;
    if (open) setActive(hit);
    else choose(hit);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    const { key } = e;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        e.preventDefault();
        openList();
      } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        typeAhead(key);
      }
      return;
    }
    switch (key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => step(i, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => step(i, -1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(first());
        break;
      case 'End':
        e.preventDefault();
        setActive(last());
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      case 'Escape':
        /* Only the list closes; the dialog around it stays. */
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeAhead(key);
    }
  };

  const placeholder = !selected || selected.value === '';

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={baseId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`block w-full text-left truncate border bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand ${
          SIZES[size] ?? SIZES.md
        } ${invalid ? 'border-red-400' : open ? 'border-brand ring-2 ring-brand/20' : 'border-slate-200 hover:border-slate-300'} ${
          disabled ? 'bg-slate-50 cursor-not-allowed' : 'cursor-pointer'
        } ${disabled || placeholder ? 'text-slate-500' : 'text-slate-900'}`}
      >
        {selected?.label || ' '}
      </button>
      <ChevronDown
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-500 transition-transform duration-200 ${
          CHEVRON[size] ?? CHEVRON.md
        } ${open ? 'rotate-180 text-brand' : ''}`}
        aria-hidden="true"
      />

      {open &&
        place &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={baseId}
            tabIndex={-1}
            /* Clicks here belong to the list, not to a dialog backdrop behind it. */
            onClick={(e) => e.stopPropagation()}
            /* Pressing an option must not take focus off the trigger. */
            onMouseDown={(e) => e.preventDefault()}
            style={{ position: 'fixed', left: place.left, width: place.width, maxHeight: place.maxHeight, top: place.top, bottom: place.bottom }}
            className="animate-dropdown-in z-[60] overflow-y-auto overscroll-contain bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-900/10 p-1.5 space-y-0.5 text-left"
          >
            {items.map((item, i) =>
              item.type === 'group' ? (
                <li
                  key={`g-${i}`}
                  role="presentation"
                  className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 select-none"
                >
                  {item.label}
                </li>
              ) : (
                <li
                  key={`o-${i}`}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === selectedIndex}
                  aria-disabled={item.disabled || undefined}
                  onMouseEnter={() => !item.disabled && setActive(i)}
                  onClick={() => choose(i)}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm select-none transition-colors ${
                    item.disabled
                      ? 'text-slate-400 cursor-not-allowed'
                      : i === active
                        ? 'bg-brand-tint text-brand cursor-pointer'
                        : item.value === ''
                          ? 'text-slate-500 cursor-pointer'
                          : 'text-slate-700 cursor-pointer'
                  } ${i === selectedIndex ? 'font-extrabold' : 'font-semibold'}`}
                >
                  <span className="min-w-0 break-words">{item.label}</span>
                  {i === selectedIndex && <Check className="w-4 h-4 shrink-0 text-brand" aria-hidden="true" />}
                </li>
              )
            )}
          </ul>,
          document.body
        )}
    </div>
  );
};

export default Select;
