import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function SearchableSelect({ options = [], onSelect, placeholder = 'Digite para buscar...' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);

  const updatePos = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  };

  useEffect(() => {
    if (open) updatePos();
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (inputRef.current && !inputRef.current.closest('[data-searchable]')?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.length > 0
    ? options.filter(o => 
        o.label?.toLowerCase().includes(query.toLowerCase()) || 
        o.sublabel?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 50)
    : options.slice(0, 30);

  return (
    <div data-searchable="1">
      <div className="relative" ref={inputRef}>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); updatePos(); }}
          onFocus={() => { setOpen(true); updatePos(); }}
          placeholder={placeholder}
          className="input-dark pr-8"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
        {query && (
          <button
            onMouseDown={e => { e.preventDefault(); setQuery(''); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && createPortal(
        <div
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 99999 }}
          className="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-h-52 overflow-y-auto"
        >
          {filtered.map((o, i) => (
            <button
              key={i}
              onMouseDown={e => { e.preventDefault(); onSelect(o); setQuery(''); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-gray-700 transition-all border-b border-gray-700/50 last:border-0"
            >
              <div className="font-medium">{o.label}</div>
              {o.sublabel && <div className="text-xs text-gray-400 mt-0.5">{o.sublabel}</div>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}