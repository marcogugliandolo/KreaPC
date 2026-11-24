import { GoogleGenAI, ThinkingLevel, type GenerateContentConfig, type GroundingMetadata } from '@google/genai';

export interface AiRequest {
  prompt: string;
  system?: string;
  /** JSON Schema de la respuesta (salida estructurada). */
  jsonSchema?: Record<string, unknown>;
  /** Activa Grounding with Google Search. */
  googleSearch?: boolean;
  thinkingLevel?: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
  signal?: AbortSignal;
}

export interface AiResponse {
  text: string;
  grounding?: GroundingMetadata;
  model: string;
}

export interface AiClient {
  generate(req: AiRequest): Promise<AiResponse>;
  readonly models: string[];
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason ?? new Error('aborted'));
    }, { once: true });
  });

const errStatus = (err: any): number | undefined => (typeof err?.status === 'number' ? err.status : undefined);
const errText = (err: any): string => `${err?.message ?? ''} ${typeof err?.status === 'string' ? err.status : ''}`;

export function isQuotaError(err: any): boolean {
  return errStatus(err) === 429 || /429|RESOURCE_EXHAUSTED|depleted|quota/i.test(errText(err));
}

function isModelUnavailable(err: any): boolean {
  return errStatus(err) === 404 || /is not found|was not found|not supported for generateContent|unknown model|has been shut down/i.test(errText(err));
}

function isTransient(err: any): boolean {
  const s = errStatus(err);
  return s === 500 || s === 503 || s === 504 || /UNAVAILABLE|overloaded|INTERNAL|DEADLINE_EXCEEDED/i.test(errText(err));
}

/** Mensaje en castellano para mostrar al usuario. */
export function friendlyAiError(err: any): string {
  if (isQuotaError(err)) {
    if (/depleted|billing|prepa/i.test(errText(err))) {
      return 'Los créditos de la API de Gemini se han agotado. Revisa la facturación de tu proyecto o cambia la GEMINI_API_KEY.';
    }
    return 'Se ha superado el límite de uso de la API de Gemini. Espera un minuto y vuelve a intentarlo.';
  }
  if (errStatus(err) === 400 && /API key/i.test(errText(err))) return 'La GEMINI_API_KEY no es válida.';
  const msg = err instanceof Error ? err.message : String(err);
  return `Hubo un problema con la IA: ${msg.slice(0, 300)}`;
}

/** Extrae el primer objeto JSON de un texto (con o sin bloque ```json). */
export function parseJsonFromText<T = unknown>(text: string): T | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  const slice = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch {
    try {
      return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1')) as T;
    } catch {
      return null;
    }
  }
}

export function createGeminiClient(apiKey: string, models: string[]): AiClient {
  const ai = new GoogleGenAI({ apiKey });
  let preferred: string | null = null;

  async function call(model: string, req: AiRequest, useSchema: boolean, useThinking: boolean): Promise<AiResponse> {
    let prompt = req.prompt;
    if (req.jsonSchema && !useSchema) {
      prompt += `\n\nReply with ONLY a JSON object (no markdown) that follows this JSON Schema:\n${JSON.stringify(req.jsonSchema)}`;
    }
    const config: GenerateContentConfig = {
      systemInstruction: req.system,
      abortSignal: req.signal,
    };
    if (req.googleSearch) config.tools = [{ googleSearch: {} }];
    if (req.jsonSchema && useSchema) {
      config.responseMimeType = 'application/json';
      config.responseJsonSchema = req.jsonSchema;
    }
    if (req.thinkingLevel && useThinking) config.thinkingConfig = { thinkingLevel: ThinkingLevel[req.thinkingLevel] };

    try {
      const res = await ai.models.generateContent({ model, contents: prompt, config });
      return { text: res.text ?? '', grounding: res.candidates?.[0]?.groundingMetadata, model };
    } catch (err) {
      // Algunos modelos no admiten salida estructurada + Google Search, o el nivel de razonamiento:
      // reintentamos sin esa opción en lugar de fallar.
      if (errStatus(err) === 400) {
        if (useThinking && req.thinkingLevel && /thinking/i.test(errText(err))) return call(model, req, useSchema, false);
        if (useSchema && req.jsonSchema && /schema|mime|json|structured|tool/i.test(errText(err))) return call(model, req, false, useThinking);
      }
      throw err;
    }
  }

  async function callWithRetry(model: string, req: AiRequest): Promise<AiResponse> {
    const delays = [1500, 4000];
    for (let attempt = 0; ; attempt++) {
      try {
        return await call(model, req, true, true);
      } catch (err) {
        const retryable = isTransient(err) || (isQuotaError(err) && !/depleted|billing/i.test(errText(err)));
        if (!retryable || attempt >= delays.length || req.signal?.aborted) throw err;
        await sleep(isQuotaError(err) ? 6000 : delays[attempt], req.signal);
      }
    }
  }

  return {
    models,
    async generate(req) {
      const order = preferred ? [preferred, ...models.filter((m) => m !== preferred)] : models;
      let lastErr: unknown;
      for (const model of order) {
        try {
          const res = await callWithRetry(model, req);
          preferred = model;
          return res;
        } catch (err) {
          lastErr = err;
          if (isModelUnavailable(err)) {
            console.warn(`[gemini] modelo ${model} no disponible, probando el siguiente`);
            continue;
          }
          throw err;
        }
      }
      throw lastErr;
    },
  };
}
