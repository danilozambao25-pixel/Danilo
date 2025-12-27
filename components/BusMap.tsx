
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LatLng, BusRoute, MapStyle } from '../types';

interface BusMapProps {
  route?: BusRoute;
  currentLocation?: LatLng;
  onMapClick?: (lat: number, lng: number) => void;
  onPointsChange?: (points: LatLng[]) => void;
  isDrawingMode?: boolean;
  previewPoints?: LatLng[];
  isOptimizing?: boolean;
  nextPoint?: LatLng;
  isNavigating?: boolean;
  mapStyle?: MapStyle;
}

const BusMap: React.FC<BusMapProps> = ({ 
  route, 
  currentLocation, 
  onMapClick, 
  onPointsChange,
  isDrawingMode, 
  previewPoints,
  isOptimizing,
  nextPoint,
  isNavigating,
  mapStyle = 'dark'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const busMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const stopsLayerRef = useRef<L.FeatureGroup | null>(null);
  const previewLayerRef = useRef<L.FeatureGroup | null>(null);
  const zoomControlRef = useRef<L.Control.Zoom | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialPos: [number, number] = currentLocation 
      ? [currentLocation.lat, currentLocation.lng] 
      : [-23.5505, -46.6333];

    const map = L.map(mapContainerRef.current, {
      center: initialPos,
      zoom: 15,
      zoomControl: false,
      attributionControl: true
    });

    zoomControlRef.current = L.control.zoom({ position: 'topleft' });
    mapInstanceRef.current = map;
    stopsLayerRef.current = L.featureGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const zoomCtrl = zoomControlRef.current;
    if (!map || !zoomCtrl) return;

    const shouldShowZoom = !!route && !isNavigating;
    const isControlVisible = zoomCtrl.getContainer() !== undefined;

    if (shouldShowZoom && !isControlVisible) {
      zoomCtrl.addTo(map);
    } else if (!shouldShowZoom && isControlVisible) {
      zoomCtrl.remove();
    }
  }, [route, isNavigating]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = '';
    let attribution = '';

    switch (mapStyle) {
      case 'light':
        url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        attribution = '&copy; OpenStreetMap &copy; CARTO';
        break;
      case 'satellite':
        url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
        break;
      default: // dark
        url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        attribution = '&copy; OpenStreetMap &copy; CARTO';
        break;
    }

    tileLayerRef.current = L.tileLayer(url, {
      maxZoom: 19,
      attribution: attribution
    }).addTo(map);
  }, [mapStyle]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (isDrawingMode && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [isDrawingMode, onMapClick]);

  const calculateBearing = (start: LatLng, end: LatLng) => {
    const startLat = (start.lat * Math.PI) / 180;
    const startLng = (start.lng * Math.PI) / 180;
    const endLat = (end.lat * Math.PI) / 180;
    const endLng = (end.lng * Math.PI) / 180;
    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  };

  useEffect(() => {
    const map = mapInstanceRef.current;
    const stopsLayer = stopsLayerRef.current;
    if (!map || !stopsLayer) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
    }
    stopsLayer.clearLayers();

    if (route && !isDrawingMode) {
      const path = (route.geometry || route.points).map(p => [p.lat, p.lng] as [number, number]);
      const color = route.status === 'DELAYED' ? '#f59e0b' : (route.isOffRoute ? '#ef4444' : '#0070f3');
      
      routeLayerRef.current = L.polyline(path, {
        color: color,
        weight: 6,
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(map);

      // Renderização das paradas oficiais da rota salva
      route.points.filter(p => p.isStop).forEach((stop, idx) => {
        const stopIcon = L.divIcon({
          className: 'stop-marker',
          html: `
            <div class="flex flex-col items-center">
              <div class="w-6 h-6 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center shadow-lg text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
              </div>
              ${stop.stopName ? `<div class="mt-1 px-2 py-0.5 bg-slate-900/80 backdrop-blur rounded text-[8px] font-black text-white whitespace-nowrap border border-white/10">${stop.stopName}</div>` : ''}
            </div>
          `,
          iconSize: [24, 40],
          iconAnchor: [12, 12]
        });
        L.marker([stop.lat, stop.lng], { icon: stopIcon }).addTo(stopsLayer);
      });

      if (!currentLocation && path.length > 0 && !isNavigating) {
        map.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
      }
    }
  }, [route, isDrawingMode, currentLocation, isNavigating]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentLocation && !isDrawingMode) {
      const rotation = nextPoint ? calculateBearing(currentLocation, nextPoint) : 0;
      const busIconSize = isNavigating ? 80 : 40;
      const busIcon = L.divIcon({
        className: 'bus-marker-icon',
        html: `
          <div class="bus-uber-style" style="transform: rotate(${rotation}deg); transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1); width: ${busIconSize}px; height: ${busIconSize}px;">
            <svg width="100%" height="100%" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="128" y="32" width="256" height="448" rx="60" fill="#0070f3" stroke="white" stroke-width="20"/>
              <rect x="160" y="64" width="192" height="120" rx="20" fill="#e0f2fe"/>
              <rect x="160" y="384" width="192" height="40" rx="10" fill="#cbd5e1"/>
              <circle cx="160" cy="460" r="15" fill="#f43f5e"/>
              <circle cx="352" cy="460" r="15" fill="#f43f5e"/>
            </svg>
          </div>
        `,
        iconSize: [busIconSize, busIconSize],
        iconAnchor: [busIconSize/2, busIconSize/2]
      });

      if (!busMarkerRef.current) {
        busMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng], { icon: busIcon }).addTo(map);
      } else {
        busMarkerRef.current.setLatLng([currentLocation.lat, currentLocation.lng]);
        busMarkerRef.current.setIcon(busIcon);
      }

      if (isNavigating) {
        map.setView([currentLocation.lat, currentLocation.lng], 18, { animate: true, duration: 2 });
      } else {
        map.panTo([currentLocation.lat, currentLocation.lng], { animate: true, duration: 2 });
      }
    } else if (busMarkerRef.current) {
      map.removeLayer(busMarkerRef.current);
      busMarkerRef.current = null;
    }
  }, [currentLocation, nextPoint, isDrawingMode, isNavigating]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (previewLayerRef.current) map.removeLayer(previewLayerRef.current);

    if (isDrawingMode && previewPoints && previewPoints.length > 0) {
      const group = L.featureGroup().addTo(map);
      const latlngs = previewPoints.map(p => [p.lat, p.lng] as [number, number]);
      L.polyline(latlngs, { color: '#10b981', weight: 4, dashArray: '8, 8', opacity: 0.6 }).addTo(group);
      
      previewPoints.forEach((p, i) => {
        const isStop = p.isStop;
        const iconHtml = isStop 
          ? `<div class="w-6 h-6 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center shadow-lg text-white"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg></div>`
          : `<div style="width: 14px; height: 14px; background: #94a3b8; border: 2px solid white; border-radius: 50%;"></div>`;

        const m = L.marker([p.lat, p.lng], {
          draggable: true,
          icon: L.divIcon({
            className: 'edit-marker',
            html: iconHtml,
            iconSize: isStop ? [24, 24] : [14, 14], 
            iconAnchor: isStop ? [12, 12] : [7, 7]
          })
        }).addTo(group);

        m.on('dragend', (e: any) => {
          const newPos = e.target.getLatLng();
          const updated = [...previewPoints];
          updated[i] = { ...updated[i], lat: newPos.lat, lng: newPos.lng };
          if (onPointsChange) onPointsChange(updated);
        });
      });
      previewLayerRef.current = group;
    }
  }, [isDrawingMode, previewPoints, onPointsChange]);

  const mapStyles = isNavigating 
    ? "relative w-full h-full bg-slate-950" 
    : "relative w-full h-[320px] md:h-[600px] rounded-3xl md:rounded-[3rem] overflow-hidden shadow-2xl bg-slate-950 border border-white/5";

  return (
    <div className={mapStyles}>
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {!isNavigating && isOptimizing && (
        <div className="absolute inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center">
          <div className="bg-slate-900/90 border border-white/10 p-8 rounded-3xl flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-blue-500/20 rounded-full"></div>
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
            </div>
            <p className="font-black text-white text-[10px] uppercase tracking-[0.2em]">IA Otimizando Rota</p>
          </div>
        </div>
      )}

      {!isNavigating && route?.isOffRoute && !isDrawingMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-600 text-white px-6 py-2 rounded-xl font-black shadow-3xl flex items-center gap-2 border border-red-400">
          <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
          <span className="uppercase text-[9px] font-black tracking-widest">Fora da Rota</span>
        </div>
      )}

      {!isNavigating && isDrawingMode && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-blue-600/90 backdrop-blur-xl text-white px-5 py-3 rounded-2xl font-black text-[9px] uppercase tracking-[0.15em] shadow-3xl border border-white/20">
          Design de Rota Ativo
        </div>
      )}
    </div>
  );
};

export default BusMap;
