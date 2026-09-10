import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/recommend", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Falta configurar la API Key de Gemini (GEMINI_API_KEY) en las variables de entorno." });
      }

      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const { deviceType, useCase, budget, ram, storage, vram, extraDetails, includePeripherals } = req.body;
      
      const isLaptop = deviceType === 'Portátil';
      const prompt = `I need a recommendation for a ${deviceType}.
Primary use case: ${useCase}.
Budget: ${budget}.
Preferred RAM: ${ram || 'Cualquiera'}.
Preferred Storage: ${storage || 'Cualquiera'}.
Preferred VRAM: ${vram || 'Cualquiera'}.
Additional details: ${extraDetails || 'None'}.
Include peripherals: ${includePeripherals ? 'Yes (Monitor, Keyboard, Mouse)' : 'No'}.

If the request is for a Laptop (Portátil), recommend 1 to 3 of the best specific laptop models that fit the criteria. List each laptop as an item in the 'components' array with type 'Laptop'. Set totalPrice to the price of your primary recommended laptop.
If the request is for a Desktop (Torre), provide a full list of compatible PC components (CPU, GPU, Motherboard, RAM, Storage, PSU, Case, Cooler) for a custom build.
${includePeripherals ? 'Since peripherals are requested, also include a Monitor, Keyboard, and Mouse as separate items in the components array. Make sure the total price includes these peripherals and respects the overall budget.' : 'Do not include peripherals (monitor, keyboard, mouse).'}

Include approximate prices in EUR based on real, current market data in Spain (PcComponentes, Coolmod, Amazon ES). Provide a short explanation in Spanish of why this recommendation fits the user's needs.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an expert PC builder and tech advisor. Provide realistic, current market prices for PC components in Spanish stores. Do NOT hallucinate unrealistically low prices (e.g. an RTX 4060 laptop is usually >1000 EUR). Always respond in Spanish. For 'searchQuery', provide a CLEAN search term optimized for store search engines. Use ONLY alphanumeric characters and spaces. NO slashes, NO quotes, NO commas. Use the core model name (e.g., 'ASUS TUF Gaming A15 FA507NV' or 'Intel Core i5-13600K').",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: {
                type: Type.STRING,
                description: "A short explanation in Spanish of why these items were chosen.",
              },
              components: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      description: "Component category (CPU, GPU, Motherboard, RAM, Storage, PSU, Case, Cooler, Monitor, Keyboard, Mouse) OR 'Laptop' if recommending laptops.",
                    },
                    name: {
                      type: Type.STRING,
                      description: "Exact model name of the component or laptop.",
                    },
                    price: {
                      type: Type.NUMBER,
                      description: "Realistic approximate current price in EUR.",
                    },
                    searchQuery: {
                      type: Type.STRING,
                      description: "A clean, store-optimized search query. DO NOT include slashes (/), quotes (\"), or commas. Example: 'ASUS TUF Gaming A15 FA507NV' instead of full specs with slashes.",
                    },
                  },
                  required: ["type", "name", "price", "searchQuery"],
                },
              },
              totalPrice: {
                type: Type.NUMBER,
                description: "Total sum of all components in EUR (or the price of the main laptop).",
              }
            },
            required: ["explanation", "components", "totalPrice"],
          }
        },
      });

      res.json(JSON.parse(response.text));
    } catch (error: any) {
      const isQuotaError = 
        error?.status === 429 || 
        error?.status === 'RESOURCE_EXHAUSTED' || 
        error?.message?.includes('429') || 
        error?.message?.includes('RESOURCE_EXHAUSTED') ||
        error?.message?.includes('depleted');

      if (!isQuotaError) {
        console.error("GEMINI API ERROR:", error);
      }
      
      if (isQuotaError) {
        let errorMsg = "Se ha excedido el límite de cuota de la IA o los créditos están agotados.";
        if (error?.message?.includes('depleted')) {
          errorMsg = "Tus créditos prepagos de la API de Gemini se han agotado. Por favor, revisa tu facturación o cambia la API Key en Settings > Secrets.";
        }
        res.status(429).json({ error: errorMsg });
      } else {
        const actualError = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: `Hubo un problema al generar la recomendación: ${actualError}` });
      }
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
