import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export default function SearchableSelect({ options = [], onSelect, placeholder = 'Digite para buscar...' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.length > 0
    ? options.filter(o => o.label?.toLowerCase().includes(query.toLowerCase()) || o.sublabel?.toLowerCase().includes(query.toLowerCase()))
    : options.slice(0, 30);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="input-dark pl-9"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {filtered.map((o, i) => (
            <button key={i} onMouseDown={() => { onSelect(o); setQuery(''); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-gray-700 transition-all border-b border-gray-700/50 last:border-0">
              <div className="font-medium">{o.label}</div>
              {o.sublabel && <div className="text-xs text-gray-400 mt-0.5">{o.sublabel}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}