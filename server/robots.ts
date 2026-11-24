/**
 * Respeta el robots.txt de cada tienda (grupo "*" o "KreaPC").
 * Si no se puede leer el robots.txt se permite el acceso, como hacen los buscadores.
 */
import type { FetchFn } from './http';

interface Rule {
  allow: boolean;
  pattern: RegExp;
  length: number;
}

const UA_TOKEN = 'kreapc';

function toRegex(path: string): RegExp {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

export function parseRobots(txt: string): Rule[] {
  const groups: Array<{ agents: string[]; rules: Rule[] }> = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;

  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current || (key !== 'allow' && key !== 'disallow')) continue;
    if (key === 'disallow' && value === '') continue; // "Disallow:" vacío = todo permitido
    current.rules.push({ allow: key === 'allow', pattern: toRegex(value), length: value.length });
  }

  const specific = groups.filter((g) => g.agents.some((a) => a.includes(UA_TOKEN)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

export function isAllowed(rules: Rule[], pathAndQuery: string): boolean {
  let best: Rule | undefined;
  for (const r of rules) {
    if (!r.pattern.test(pathAndQuery)) continue;
    if (!best || r.length > best.length || (r.length === best.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

export class RobotsCache {
  private cache = new Map<string, { expires: number; rules: Promise<Rule[]> }>();
  constructor(private fetchFn: FetchFn = fetch, private ttlMs = 24 * 3_600_000) {}

  async allowed(url: string): Promise<boolean> {
    const u = new URL(url);
    let entry = this.cache.get(u.origin);
    if (!entry || entry.expires < Date.now()) {
      entry = { expires: Date.now() + this.ttlMs, rules: this.load(u.origin) };
      this.cache.set(u.origin, entry);
    }
    return isAllowed(await entry.rules, u.pathname + u.search);
  }

  private async load(origin: string): Promise<Rule[]> {
    try {
      const res = await this.fetchFn(`${origin}/robots.txt`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KreaPC/2.0; +https://github.com/marcogugliandolo/KreaPC)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return [];
      return parseRobots(await res.text());
    } catch {
      return [];
    }
  }
}
