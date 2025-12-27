
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateIncidentSummary(type: string, description: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `O motorista relatou o seguinte incidente em uma linha de ônibus: 
      Tipo: ${type}
      Descrição: ${description}
      
      Por favor, gere uma mensagem curta, educada e informativa para os passageiros que estão esperando no ponto, sugerindo o que eles devem fazer ou quanto tempo aproximado isso pode impactar. Responda em Português do Brasil de forma concisa.`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Houve um imprevisto na linha. Recomendamos acompanhar o mapa para atualizações em tempo real.";
  }
}

/**
 * Uses Google Maps Grounding to find nearby points of interest.
 * Requires Gemini 2.5 or 3 series.
 */
export async function findNearbyPlaces(query: string, lat: number, lng: number) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Procure por: ${query} próximo à minha localização atual.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        }
      },
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    return {
      text: response.text,
      links: groundingChunks?.filter((chunk: any) => chunk.maps).map((chunk: any) => ({
        title: chunk.maps.title,
        uri: chunk.maps.uri
      })) || []
    };
  } catch (error) {
    console.error("Maps Grounding Error:", error);
    return { text: "Não foi possível buscar locais próximos no momento.", links: [] };
  }
}
