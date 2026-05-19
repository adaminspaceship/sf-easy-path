import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Init Gemini
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // API route for AI route analysis
  app.post("/api/analyze-routes", async (req, res) => {
    try {
      const { routes, destination } = req.body;
      
      if (!routes || routes.length === 0) {
        return res.status(400).json({ error: "No routes provided" });
      }

      if (!ai) {
        return res.status(500).json({ error: "Gemini AI is not configured" });
      }

      // Format routes for AI summary
      const routeText = routes.map((r: any, index: number) => {
        const isEasiest = index === 0;
        const totalClimb = r.metrics.totalClimb;
        const maxGradient = r.metrics.maxGradient;
        const duration = Math.round(r.durationMillis / 60000);
        const distance = ((r.distanceMeters || 0) * 0.000621371).toFixed(1);
        
        return `Route ${isEasiest ? 'A (Flattest)' : 'B (Alternate)'}: 
- Distance: ${distance} miles
- Duration: ${duration} minutes
- Total Climb: ${totalClimb} feet
- Max Slope: ${maxGradient}%
`;
      }).join("\n\n");

      const prompt = `Compare these walking routes to ${destination}. Which one is objectively easier and why? Should I choose the alternate route if it's much faster, or is the flat one much better? Keep the answer to a punchy, 2-3 sentence paragraph. Be engaging and helpful, a little conversational. Never use asterisks or formatting.\n\n${routeText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
      });

      res.json({ analysis: response.text });
    } catch (error) {
      console.error("Error analyzing routes:", error);
      res.status(500).json({ error: "Failed to analyze routes" });
    }
  });

  // Vite middleware for development
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
