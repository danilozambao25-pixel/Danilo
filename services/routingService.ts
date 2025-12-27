import { LatLng } from '../types';

/**
 * Busca a melhor rota pelas ruas conectando os pontos fornecidos.
 * Utiliza o OSRM (Open Source Routing Machine).
 */
export async function fetchBestRoute(points: LatLng[]): Promise<LatLng[]> {
  if (points.length < 2) return points;

  const coordinates = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok') {
      console.error('Erro no roteamento OSRM:', data.code);
      return points;
    }

    // OSRM retorna GeoJSON [lng, lat]
    const fullGeometry: LatLng[] = data.routes[0].geometry.coordinates.map((coord: [number, number]) => ({
      lat: coord[1],
      lng: coord[0]
    }));

    return fullGeometry;
  } catch (error) {
    console.error('Falha ao buscar rota otimizada:', error);
    return points;
  }
}
