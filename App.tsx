
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserRole, BusRoute, UserProfile, LatLng, IncidentType, DriverProfile, MapStyle } from './types';
import BusMap from './components/BusMap';
import QRCodeGenerator from './components/QRCodeGenerator';
import QRScanner from './components/QRScanner';
import { generateIncidentSummary, findNearbyPlaces } from './services/geminiService';
import { fetchBestRoute } from './services/routingService';
import { searchAddress } from './services/geocodingService';

interface CompanyProfile {
  name: string;
  tagline: string;
  logoUrl?: string;
  primaryColor: string;
}

const BusLogo = ({ size = "large", customLogo, color = "#3b82f6" }: { size?: "small" | "large", customLogo?: string, color?: string }) => {
  const isLarge = size === "large";
  
  if (customLogo) {
    return (
      <div className={`relative flex items-center justify-center ${isLarge ? 'mb-4 md:mb-8' : 'mr-3'}`}>
        <img src={customLogo} alt="Logo" className={`${isLarge ? 'w-20 h-20' : 'w-8 h-8'} rounded-2xl object-cover border-2 border-white/10 shadow-xl`} />
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center ${isLarge ? 'mb-4 md:mb-8' : 'mr-3'}`}>
      <div className={`absolute inset-0 rounded-full blur-2xl animate-pulse ${isLarge ? 'scale-150' : 'scale-110'}`} style={{ backgroundColor: `${color}33` }}></div>
      <svg 
        width={isLarge ? "60" : "28"} 
        height={isLarge ? "60" : "28"} 
        viewBox="0 0 512 512" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={`${isLarge ? 'drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]' : ''} transition-transform hover:scale-110 duration-500`}
      >
        <path d="M128 32C94.8629 32 68 58.8629 68 92V420C68 437.673 82.3269 452 100 452H412C429.673 452 444 437.673 444 420V92C444 58.8629 417.137 32 384 32H128Z" fill="url(#bus_gradient)" />
        <rect x="100" y="72" width="312" height="180" rx="24" fill="#0f172a" />
        <rect x="120" y="320" width="64" height="24" rx="12" fill="white" />
        <rect x="328" y="320" width="64" height="24" rx="12" fill="white" />
        <defs>
          <linearGradient id="bus_gradient" x1="68" y1="32" x2="444" y2="452" gradientUnits="userSpaceOnUse">
            <stop stopColor={color} />
            <stop offset="1" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

const INITIAL_ROUTES: BusRoute[] = [
  {
    id: 'route-1',
    name: 'Fretado Berrini - Santo Amaro',
    companyId: 'comp-1',
    companyName: 'TransExpress',
    points: [
      { lat: -23.59, lng: -46.68, isStop: true, stopName: 'Partida Berrini' }, 
      { lat: -23.65, lng: -46.72, isStop: true, stopName: 'Terminal Sto. Amaro' }
    ],
    geometry: [
      { lat: -23.59, lng: -46.68 }, 
      { lat: -23.60, lng: -46.685 }, 
      { lat: -23.62, lng: -46.70 },
      { lat: -23.65, lng: -46.72 }
    ],
    status: 'NORMAL',
    qrCodeData: 'meuonibus://route/1',
    isOffRoute: false,
    schedule: '07:00, 08:30, 17:15',
    itineraryText: 'Partida: Av. Eng. Luís Carlos Berrini. Paradas: Shopping Vila Olímpia, Estação Morumbi, Final: Terminal Sto. Amaro.'
  }
];

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<'LOGIN' | 'DASHBOARD'>('LOGIN');
  const [routes, setRoutes] = useState<BusRoute[]>(INITIAL_ROUTES);
  const [drivers, setDrivers] = useState<DriverProfile[]>([
    { id: 'drv-1', name: 'Carlos Oliveira', email: 'carlos@bus.com', phone: '(11) 98888-7777', companyId: 'comp-1' }
  ]);
  
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({
    name: 'Meu Ônibus',
    tagline: 'Rastreamento Inteligente',
    logoUrl: '',
    primaryColor: '#3b82f6'
  });

  const [selectedRouteId, setSelectedRouteId] = useState<string>(INITIAL_ROUTES[0].id);
  const [busLocation, setBusLocation] = useState<LatLng | undefined>(INITIAL_ROUTES[0].points[0]);
  const [nextPoint, setNextPoint] = useState<LatLng | undefined>(INITIAL_ROUTES[0].points[1]);
  
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteSchedule, setNewRouteSchedule] = useState('');
  const [newRouteItinerary, setNewRouteItinerary] = useState('');
  const [newPoints, setNewPoints] = useState<LatLng[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  
  const [addressSearch, setAddressSearch] = useState('');
  const [addressResults, setAddressResults] = useState<{ name: string; location: LatLng }[]>([]);

  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [driverToDelete, setDriverToDelete] = useState<DriverProfile | null>(null);

  const [isRouteRunning, setIsRouteRunning] = useState(false);
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'MAP' | 'MANAGEMENT' | 'SCHEDULE' | 'CONFIG'>('MAP');

  const activeRoute = useMemo(() => routes.find(r => r.id === selectedRouteId), [routes, selectedRouteId]);

  useEffect(() => {
    if (currentView === 'DASHBOARD' && activeRoute && (isRouteRunning || user?.role === UserRole.USER) && !isCreatingRoute) {
      const path = activeRoute.geometry || activeRoute.points;
      if (path.length < 1) return;
      let index = 0;
      const moveInterval = setInterval(() => {
        index = (index + 1) % path.length;
        setBusLocation(path[index]);
        setNextPoint(path[(index + 1) % path.length]);
      }, 4000);
      return () => clearInterval(moveInterval);
    }
  }, [currentView, activeRoute, isCreatingRoute, isRouteRunning, user?.role]);

  const handleLogin = (role: UserRole) => {
    setUser({
      id: `u-${Date.now()}`,
      name: role === UserRole.COMPANY ? companyProfile.name : (role === UserRole.DRIVER ? 'Carlos Oliveira' : 'Passageiro'),
      email: role === UserRole.DRIVER ? 'carlos@bus.com' : 'user@test.com',
      role: role,
      favoriteRoutes: [],
      companyId: 'comp-1'
    });
    setCurrentView('DASHBOARD');
  };

  const startCreatingRoute = () => {
    setEditingRouteId(null);
    setNewRouteName('');
    setNewRouteSchedule('');
    setNewRouteItinerary('');
    setNewPoints([]);
    setIsCreatingRoute(true);
    setActiveTab('MAP');
  };

  const handleSaveRoute = async () => {
    if (newPoints.length < 2 || !newRouteName) return;
    setIsOptimizing(true);
    const geometry = await fetchBestRoute(newPoints);
    
    if (editingRouteId) {
      setRoutes(routes.map(r => r.id === editingRouteId ? {
        ...r,
        name: newRouteName,
        points: newPoints,
        geometry,
        schedule: newRouteSchedule,
        itineraryText: newRouteItinerary
      } : r));
    } else {
      const newRoute: BusRoute = {
        id: `route-${Date.now()}`,
        name: newRouteName,
        companyId: user?.companyId || 'comp-1',
        companyName: companyProfile.name,
        points: newPoints,
        geometry,
        status: 'NORMAL',
        qrCodeData: `meuonibus://route/${Date.now()}`,
        isOffRoute: false,
        schedule: newRouteSchedule,
        itineraryText: newRouteItinerary
      };
      setRoutes([...routes, newRoute]);
      setSelectedRouteId(newRoute.id);
    }
    
    setIsCreatingRoute(false);
    setEditingRouteId(null);
    setNewPoints([]);
    setNewRouteName('');
    setIsOptimizing(false);
  };

  const togglePointIsStop = (index: number) => {
    const updated = [...newPoints];
    updated[index] = { ...updated[index], isStop: !updated[index].isStop };
    setNewPoints(updated);
  };

  const updateStopName = (index: number, name: string) => {
    const updated = [...newPoints];
    updated[index] = { ...updated[index], stopName: name };
    setNewPoints(updated);
  };

  const removePoint = (index: number) => {
    setNewPoints(newPoints.filter((_, i) => i !== index));
  };

  const handleAddressSearch = async (val: string) => {
    setAddressSearch(val);
    if (val.length > 3) {
      const results = await searchAddress(val);
      setAddressResults(results);
    } else {
      setAddressResults([]);
    }
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setNewPoints(prev => [...prev, { lat, lng, isStop: false }]);
  }, []);

  const handlePointsChange = useCallback((updatedPoints: LatLng[]) => {
    setNewPoints(updatedPoints);
  }, []);

  const addPointFromAddress = (location: LatLng) => {
    setNewPoints(prev => [...prev, { ...location, isStop: true }]);
    setAddressResults([]);
    setAddressSearch('');
  };

  const handleAddDriver = () => {
    if (!newDriverName || !newDriverEmail) return;
    const driver: DriverProfile = {
      id: `drv-${Date.now()}`,
      name: newDriverName,
      email: newDriverEmail,
      phone: newDriverPhone,
      companyId: user?.companyId || 'comp-1'
    };
    setDrivers([...drivers, driver]);
    setNewDriverName('');
    setNewDriverEmail('');
    setNewDriverPhone('');
  };

  const handleReportIncident = async (type: IncidentType) => {
    if (!activeRoute) return;
    const summary = await generateIncidentSummary(type, "Relatado pelo motorista em tempo real.");
    setRoutes(routes.map(r => r.id === activeRoute.id ? { 
      ...r, 
      status: type === 'CLEAR' ? 'NORMAL' : (type === 'TRAFFIC' ? 'TRAFFIC' : 'DELAYED'),
      incidentDescription: summary 
    } : r));
  };

  const handleScanSuccess = (data: string) => {
    const matchedRoute = routes.find(r => r.qrCodeData === data);
    if (matchedRoute) {
      setSelectedRouteId(matchedRoute.id);
      setIsScanning(false);
      setActiveTab('MAP');
    } else {
      alert('Código QR inválido ou rota não encontrada no sistema.');
    }
  };

  if (currentView === 'LOGIN') {
    return (
      <div className="h-full w-full bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[70%] bg-blue-600/10 rounded-full blur-[120px]"></div>
        
        <div className="w-full max-w-4xl flex flex-col items-center z-10 animate-in fade-in zoom-in duration-700">
          <div className="text-center mb-10 flex flex-col items-center">
            <BusLogo size="large" customLogo={companyProfile.logoUrl} color={companyProfile.primaryColor} />
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-2">
              <span style={{ color: companyProfile.primaryColor }}>{companyProfile.name.split(' ')[0]}</span> {companyProfile.name.split(' ').slice(1).join(' ')}
            </h1>
            <p className="text-slate-500 text-[10px] md:text-xs font-black uppercase tracking-[0.4em]">{companyProfile.tagline}</p>
          </div>

          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => handleLogin(UserRole.USER)} className="group bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-6 rounded-3xl text-center hover:bg-blue-600/10 hover:border-blue-500 transition-all shadow-2xl flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center group-hover:bg-blue-600 transition-all text-blue-500 group-hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div><span className="font-black text-xl text-white block">Passageiro</span></div>
            </button>
            <button onClick={() => handleLogin(UserRole.DRIVER)} className="group bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-6 rounded-3xl text-center hover:bg-emerald-600/10 hover:border-emerald-500 transition-all shadow-2xl flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center group-hover:bg-emerald-600 transition-all text-emerald-500 group-hover:text-white">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
              </div>
              <div><span className="font-black text-xl text-white block">Motorista</span></div>
            </button>
            <button onClick={() => handleLogin(UserRole.COMPANY)} className="group bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-6 rounded-3xl text-center hover:bg-white/5 hover:border-white/20 transition-all shadow-2xl flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-white transition-all text-slate-400 group-hover:text-slate-950">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
              <div><span className="font-black text-xl text-white block">Empresa</span></div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-950 text-white flex flex-col font-sans ${isNavigationMode ? 'overflow-hidden' : ''}`}>
      {!isNavigationMode && (
        <>
          <header className="px-4 py-3 bg-slate-950/80 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between sticky top-0 z-[1001]">
            <div className="flex items-center gap-2">
              <BusLogo size="small" customLogo={companyProfile.logoUrl} color={companyProfile.primaryColor} />
              <h2 className="text-lg font-black tracking-tighter">
                <span style={{ color: companyProfile.primaryColor }}>{companyProfile.name.split(' ')[0]}</span>{companyProfile.name.split(' ').slice(1).join('')}
              </h2>
            </div>
            <button onClick={() => setCurrentView('LOGIN')} className="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-red-500 border border-white/5">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </header>

          <nav className="flex border-b border-white/5 bg-slate-900/40 sticky top-[53px] z-[1001]">
            <button onClick={() => setActiveTab('MAP')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'MAP' ? 'border-blue-500 text-blue-500 bg-blue-500/5' : 'border-transparent text-slate-500'}`}>Mapa</button>
            <button onClick={() => setActiveTab('SCHEDULE')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'SCHEDULE' ? 'border-emerald-500 text-emerald-500 bg-emerald-500/5' : 'border-transparent text-slate-500'}`}>Horários</button>
            {user?.role === UserRole.COMPANY && (
              <>
                <button onClick={() => setActiveTab('MANAGEMENT')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'MANAGEMENT' ? 'border-white text-white bg-white/5' : 'border-transparent text-slate-500'}`}>Gestão</button>
                <button onClick={() => setActiveTab('CONFIG')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'CONFIG' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-slate-500'}`}>Ajustes</button>
              </>
            )}
          </nav>
        </>
      )}

      <main className={`${isNavigationMode ? 'h-screen w-screen p-0 m-0 relative' : 'flex-1 p-3 md:p-6 max-w-[1400px] mx-auto w-full'}`}>
        {activeTab === 'MAP' && (
          <div className={`${isNavigationMode ? 'h-full w-full relative' : 'flex flex-col gap-4'}`}>
            <div className={`relative ${isNavigationMode ? 'h-full w-full' : ''}`}>
              <BusMap 
                route={activeRoute} 
                currentLocation={busLocation} 
                isDrawingMode={isCreatingRoute} 
                isOptimizing={isOptimizing} 
                onMapClick={handleMapClick} 
                onPointsChange={handlePointsChange}
                previewPoints={newPoints} 
                nextPoint={nextPoint}
                isNavigating={isNavigationMode}
                mapStyle={mapStyle}
              />

              {!isNavigationMode && (
                <div className="absolute bottom-6 right-4 z-[1000] flex flex-col gap-2">
                  <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl flex flex-col gap-1">
                    <button onClick={() => setMapStyle('dark')} className={`p-2.5 rounded-xl transition-all ${mapStyle === 'dark' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3a6.364 6.364 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg></button>
                    <button onClick={() => setMapStyle('light')} className={`p-2.5 rounded-xl transition-all ${mapStyle === 'light' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg></button>
                    <button onClick={() => setMapStyle('satellite')} className={`p-2.5 rounded-xl transition-all ${mapStyle === 'satellite' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg></button>
                  </div>
                </div>
              )}

              {isNavigationMode && user?.role === UserRole.DRIVER && (
                <div className="absolute inset-0 z-[1005] pointer-events-none flex flex-col justify-between p-4">
                  <div className="bg-blue-600 rounded-3xl p-6 shadow-3xl pointer-events-auto border-4 border-white/20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">Próxima Parada</span>
                        <h2 className="text-xl md:text-2xl font-black text-white leading-tight">Shopping Vila Olímpia</h2>
                      </div>
                    </div>
                    <div className="text-right">
                       <span className="text-[10px] font-black uppercase text-blue-200 block">Chegada em</span>
                       <p className="text-2xl font-black text-white">4 min</p>
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-4 pointer-events-auto">
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-6 rounded-[2.5rem] flex flex-col items-center min-w-[120px] shadow-3xl">
                       <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Velocidade</span>
                       <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black text-white">42</span>
                          <span className="text-xs font-bold text-slate-500">km/h</span>
                       </div>
                    </div>

                    <div className="flex-1 flex gap-2">
                       <button onClick={() => handleReportIncident('ACCIDENT')} className="flex-1 bg-red-600 text-white p-4 rounded-3xl font-black flex flex-col items-center justify-center shadow-xl">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          <span className="text-[8px] uppercase mt-1">Alerta</span>
                       </button>
                       <button onClick={() => handleReportIncident('TRAFFIC')} className="flex-1 bg-amber-500 text-white p-4 rounded-3xl font-black flex flex-col items-center justify-center shadow-xl">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="8" cy="15" r="4"/><circle cx="16" cy="15" r="4"/><path d="M16 10V5a1 1 0 0 0-1-1H9a1 1 0 0 0-1-1H9a1 1 0 0 0-1-1v5"/></svg>
                          <span className="text-[8px] uppercase mt-1">Trânsito</span>
                       </button>
                    </div>

                    <button onClick={() => setIsNavigationMode(false)} className="bg-white text-slate-950 p-6 rounded-[2.5rem] font-black uppercase text-xs shadow-3xl">Sair</button>
                  </div>
                </div>
              )}

              {!isNavigationMode && (
                <>
                  {isCreatingRoute && (
                    <div className="absolute top-4 left-4 right-4 z-[1002]">
                      <input 
                        type="text" 
                        placeholder="Adicionar ponto por endereço..." 
                        className="w-full bg-slate-950/90 backdrop-blur-2xl border border-white/10 rounded-xl py-3 px-6 font-bold text-xs shadow-2xl outline-none focus:border-blue-500 text-white"
                        value={addressSearch}
                        onChange={(e) => handleAddressSearch(e.target.value)}
                      />
                      {addressResults.length > 0 && (
                        <div className="mt-2 bg-slate-950 border border-white/10 rounded-xl overflow-hidden max-h-[180px] overflow-y-auto">
                          {addressResults.map((res, i) => (
                            <button key={i} onClick={() => addPointFromAddress(res.location)} className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 text-[10px] font-bold text-white truncate">{res.name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {activeRoute && !isCreatingRoute && (
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-[1000]">
                      <div className="bg-slate-950/90 backdrop-blur-3xl p-3 rounded-2xl border border-white/10 shadow-2xl pointer-events-auto flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeRoute.status === 'NORMAL' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                        </div>
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block">{activeRoute.status}</span>
                          <p className="text-xs text-white font-black leading-tight">{activeRoute.name}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {!isNavigationMode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
                <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/5 rounded-3xl p-5 shadow-2xl">
                  <h3 className="text-sm font-black uppercase tracking-widest mb-4">Linhas Disponíveis</h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {routes.map(r => (
                      <button key={r.id} onClick={() => setSelectedRouteId(r.id)} className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${selectedRouteId === r.id ? 'bg-blue-600 border-blue-400' : 'bg-slate-950 border-white/5'}`}>
                        <div className="flex justify-between items-center"><span className="font-black text-sm tracking-tight">{r.name}</span></div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {user?.role === UserRole.DRIVER && (
                  <div className="bg-slate-900 border border-white/10 rounded-3xl p-5 flex flex-col gap-3">
                    <button onClick={() => setIsRouteRunning(!isRouteRunning)} className={`w-full py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${isRouteRunning ? 'bg-red-600 shadow-xl shadow-red-600/20' : 'bg-emerald-600 shadow-xl shadow-emerald-600/20'}`}>{isRouteRunning ? 'Encerrar Percurso' : 'Iniciar Percurso'}</button>
                    {isRouteRunning && (
                      <button onClick={() => setIsNavigationMode(true)} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                        Modo Navegação
                      </button>
                    )}
                  </div>
                )}

                {user?.role === UserRole.USER && (
                  <div className="bg-white rounded-3xl p-5 shadow-2xl flex flex-col items-center justify-center min-h-[200px]">
                    <div className="text-center w-full px-4">
                      <div className="w-12 h-12 bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
                      <h3 className="text-sm font-black text-slate-900 mb-1">Escanear Linha</h3>
                      <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest mb-4">Leia o código QR no ponto.</p>
                      <button onClick={() => setIsScanning(true)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[9px]">Abrir Câmera</button>
                    </div>
                  </div>
                )}

                {user?.role === UserRole.COMPANY && activeRoute && (
                  <div className="bg-white rounded-3xl p-5 shadow-2xl flex flex-col items-center">
                    <QRCodeGenerator value={activeRoute.qrCodeData} routeName={activeRoute.name} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'SCHEDULE' && activeRoute && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/5 rounded-3xl p-6 shadow-2xl">
               <div className="mb-6">
                  <h2 className="text-2xl font-black tracking-tighter">{activeRoute.name}</h2>
                  <p className="text-slate-500 font-black uppercase tracking-widest text-[9px]">{companyProfile.name}</p>
               </div>
               <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-3 border-b border-white/5 pb-2">Horários</h4>
                    <div className="grid grid-cols-3 gap-2">
                       {activeRoute.schedule?.split(',').map((time, i) => (
                         <div key={i} className="bg-slate-950 border border-white/5 py-3 rounded-xl font-black text-sm text-center">{time.trim()}</div>
                       ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-3 border-b border-white/5 pb-2">Itinerário</h4>
                    <p className="text-slate-400 text-xs leading-relaxed italic">"{activeRoute.itineraryText || 'Informações indisponíveis.'}"</p>
                  </div>
               </div>
             </div>
          </div>
        )}

        {activeTab === 'MANAGEMENT' && user?.role === UserRole.COMPANY && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500 pb-24">
            <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/5 rounded-3xl p-5">
              <h3 className="text-lg font-black mb-6">Equipe</h3>
              <div className="space-y-2 mb-6">
                <input type="text" placeholder="Nome" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 font-bold text-xs" value={newDriverName} onChange={e => setNewDriverName(e.target.value)} />
                <input type="email" placeholder="Email" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 font-bold text-xs" value={newDriverEmail} onChange={e => setNewDriverEmail(e.target.value)} />
                <button onClick={handleAddDriver} className="w-full bg-blue-600 py-3 rounded-xl font-black uppercase text-[10px]">Cadastrar</button>
              </div>
              <div className="space-y-2">
                 {drivers.map(d => (
                   <div key={d.id} className="bg-slate-950 p-3 rounded-xl border border-white/5 flex justify-between items-center group">
                      <div><p className="font-black text-xs">{d.name}</p><p className="text-[8px] text-slate-500 font-bold">{d.email}</p></div>
                      <div className="flex items-center gap-3">
                        <span className="text-[8px] font-black text-emerald-500 uppercase">Ativo</span>
                        <button onClick={() => setDriverToDelete(d)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                      </div>
                   </div>
                 ))}
              </div>
            </div>
            <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/5 rounded-3xl p-5">
               <h3 className="text-lg font-black mb-6">Editor de Linhas</h3>
               <div className="space-y-2">
                  <input type="text" placeholder="Nome da Linha" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 font-bold text-xs" value={newRouteName} onChange={e => setNewRouteName(e.target.value)} />
                  <input type="text" placeholder="Horários" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 font-bold text-xs" value={newRouteSchedule} onChange={e => setNewRouteSchedule(e.target.value)} />
                  <textarea placeholder="Itinerário" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 font-bold text-xs h-20 resize-none" value={newRouteItinerary} onChange={e => setNewRouteItinerary(e.target.value)} />
                  
                  {isCreatingRoute && (
                    <div className="mt-4 space-y-3">
                       <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5 pb-2">Pontos e Paradas ({newPoints.length})</h4>
                       <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                         {newPoints.length === 0 && <p className="text-[9px] text-slate-600 italic">Clique no mapa para adicionar pontos.</p>}
                         {newPoints.map((p, idx) => (
                           <div key={idx} className={`p-3 rounded-xl border transition-all ${p.isStop ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-950 border-white/5'}`}>
                             <div className="flex items-center justify-between gap-2">
                               <div className="flex items-center gap-2">
                                 <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black ${p.isStop ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{idx + 1}</div>
                                 <button onClick={() => togglePointIsStop(idx)} className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${p.isStop ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                   {p.isStop ? 'Parada' : 'Trajeto'}
                                 </button>
                               </div>
                               <button onClick={() => removePoint(idx)} className="p-1.5 text-slate-600 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                             </div>
                             {p.isStop && (
                               <input 
                                 type="text" 
                                 placeholder="Nome da Parada" 
                                 className="w-full mt-2 bg-slate-900 border border-white/10 rounded-lg p-2 text-[9px] font-bold text-white outline-none focus:border-blue-500"
                                 value={p.stopName || ''}
                                 onChange={(e) => updateStopName(idx, e.target.value)}
                               />
                             )}
                           </div>
                         ))}
                       </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-white/5">
                    {isCreatingRoute ? (
                      <button onClick={handleSaveRoute} disabled={newPoints.length < 2 || !newRouteName} className="w-full bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Salvar Rota ({newPoints.length} pontos)
                      </button>
                    ) : (
                      <button onClick={startCreatingRoute} className="w-full bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 py-3 rounded-xl font-black uppercase text-[10px] hover:bg-emerald-600/20 transition-all">Novo Itinerário</button>
                    )}
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'CONFIG' && user?.role === UserRole.COMPANY && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-10 duration-500 pb-20">
            <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/5 rounded-3xl p-6 shadow-2xl">
              <h3 className="text-xl font-black mb-6 flex items-center gap-3"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-amber-500"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>Perfil da Empresa</h3>
              <div className="space-y-4">
                <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-1 block">Nome Comercial</label><input type="text" value={companyProfile.name} onChange={e => setCompanyProfile({...companyProfile, name: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl p-4 font-bold text-sm outline-none focus:border-amber-500 transition-all" placeholder="Ex: TransExpress Brasil" /></div>
                <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-1 block">Slogan / Tagline</label><input type="text" value={companyProfile.tagline} onChange={e => setCompanyProfile({...companyProfile, tagline: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl p-4 font-bold text-sm outline-none focus:border-amber-500 transition-all" placeholder="Ex: Qualidade em cada quilômetro" /></div>
                <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-1 block">URL do Logo (SVG ou PNG)</label><input type="text" value={companyProfile.logoUrl} onChange={e => setCompanyProfile({...companyProfile, logoUrl: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-xl p-4 font-bold text-sm outline-none focus:border-amber-500 transition-all" placeholder="https://..." /></div>
                <div><label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-1 block">Cor da Marca</label><div className="flex gap-3 mt-2">{['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e'].map(color => (<button key={color} onClick={() => setCompanyProfile({...companyProfile, primaryColor: color})} className={`w-10 h-10 rounded-full border-2 transition-all ${companyProfile.primaryColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div></div>
              </div>
              <div className="mt-8"><button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all flex items-center justify-center gap-3"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Salvar Configurações</button></div>
            </div>
            <div className="bg-slate-950 border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: companyProfile.primaryColor }}></div>
               <div className="text-center">
                  <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 block">Visualização do App</span>
                  <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/5 shadow-3xl max-w-[300px] w-full flex flex-col items-center">
                    <BusLogo size="large" customLogo={companyProfile.logoUrl} color={companyProfile.primaryColor} />
                    <h4 className="text-xl font-black text-white mb-1"><span style={{ color: companyProfile.primaryColor }}>{companyProfile.name.split(' ')[0]}</span> {companyProfile.name.split(' ').slice(1).join(' ')}</h4>
                    <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">{companyProfile.tagline}</p>
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>

      {isScanning && <QRScanner onScan={handleScanSuccess} onClose={() => setIsScanning(false)} />}
      
      {driverToDelete && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-3xl text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></div>
            <h3 className="text-xl font-black text-white mb-2">Remover Motorista?</h3>
            <p className="text-slate-400 text-xs font-bold mb-8">Tem certeza que deseja remover <span className="text-white">{driverToDelete.name}</span>?</p>
            <div className="flex gap-3"><button onClick={() => setDriverToDelete(null)} className="flex-1 py-4 bg-slate-800 text-slate-300 rounded-2xl font-black uppercase text-[10px]">Cancelar</button><button onClick={() => {setDrivers(drivers.filter(d => d.id !== driverToDelete.id));setDriverToDelete(null);}} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px]">Remover</button></div>
          </div>
        </div>
      )}

      {isCreatingRoute && activeTab === 'MAP' && (
        <div className="fixed bottom-6 left-4 right-4 z-[2000] flex gap-2 animate-in slide-in-from-bottom-10">
           <button onClick={() => { setIsCreatingRoute(false); setEditingRouteId(null); setNewPoints([]); }} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] border border-white/10">Descartar</button>
           <button onClick={handleSaveRoute} disabled={newPoints.length < 2 || !newRouteName} className="flex-2 bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] disabled:opacity-50 transition-all shadow-xl shadow-emerald-950/20">
             Salvar Rota ({newPoints.length})
           </button>
        </div>
      )}
    </div>
  );
};

export default App;
