const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
`const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});`,
``
);

code = code.replace(
`      if (!process.env.GEMINI_API_KEY) {`,
`      if (!process.env.GEMINI_API_KEY) {`
);

code = code.replace(
`      const { deviceType, useCase`,
`      const ai = new GoogleGenAI({ 
        apiKey: process.env.GEMINI_API_KEY,
      });
      const { deviceType, useCase`
);

fs.writeFileSync('server.ts', code);
