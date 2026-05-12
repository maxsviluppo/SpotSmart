import { NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, summary, content, apiKey: customApiKey } = body;

    if (!title) {
      return NextResponse.json({ error: "Titolo mancante" }, { status: 400 });
    }

    const apiKey = customApiKey || process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ 
        error: "Chiave API Gemini mancante. Configura la variabile d'ambiente o inseriscila nelle impostazioni." 
      }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      Sei un giornalista esperto e analista critico.
      Analizza la seguente notizia e fornisci un riassunto puntuale in 3 punti chiave, 
      evidenziando l'impatto potenziale o una prospettiva critica.
      
      Titolo: ${title}
      Sintesi: ${summary || ""}
      ${content ? `Contenuto: ${content}` : ""}
    `;

    // Utilizziamo un modello veloce e affidabile per evitare limiti di quota frequenti
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    return NextResponse.json({ analysis: response.text });
  } catch (error: any) {
    console.error("AI analysis error:", error);
    return NextResponse.json({ 
      error: "Si è verificato un errore durante l'analisi AI: " + (error.message || "Quota superata o errore di rete") 
    }, { status: 500 });
  }
}
