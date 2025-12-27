import { LatLng } from '../types';

export async function searchAddress(query: string): Promise<{ name: string; location: LatLng }[]> {
  if (!query || query.length < 3) return [];
  
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'pt-BR'
      }
    });
    const data = await response.json();
    
    return data.map((item: any) => ({
      name: item.display_name,
      location: {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }
    }));
  } catch (error) {
    console.error('Erro na busca de endereço:', error);
    return [];
  }
}
