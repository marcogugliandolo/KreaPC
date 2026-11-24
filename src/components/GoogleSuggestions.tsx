import { useRef, useState } from 'react';

/**
 * Muestra las "Sugerencias de búsqueda" de Google tal cual las devuelve la API
 * (es obligatorio mostrarlas al usar Grounding with Google Search).
 * Va en un iframe aislado y sin scripts para que su CSS no afecte a la web.
 */
export function GoogleSuggestions({ html, className = '' }: { html?: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(56);
  if (!html) return null;

  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style></head><body>${html}</body></html>`;

  return (
    <iframe
      ref={ref}
      title="Sugerencias de búsqueda de Google"
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className={`w-full border-0 block ${className}`}
      style={{ height }}
      onLoad={() => {
        const h = ref.current?.contentDocument?.documentElement.scrollHeight;
        if (h) setHeight(Math.min(h, 200));
      }}
    />
  );
}
