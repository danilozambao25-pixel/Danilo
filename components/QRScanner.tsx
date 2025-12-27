
import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const qrScanner = new QrScanner(
      videoRef.current,
      (result) => {
        onScan(result.data);
        qrScanner.destroy();
      },
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
      }
    );

    qrScanner.start().catch((err) => {
      console.error(err);
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
    });

    return () => {
      qrScanner.destroy();
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[4000] bg-slate-950 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm aspect-square bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        <video ref={videoRef} className="w-full h-full object-cover" />
        <div className="scanner-line"></div>
        
        {/* Guia visual de foco */}
        <div className="absolute inset-0 border-[40px] border-slate-950/60 pointer-events-none">
          <div className="w-full h-full border-2 border-white/20 rounded-xl"></div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <h3 className="text-xl font-black text-white mb-2">Escanear QR Code</h3>
        <p className="text-slate-400 text-xs font-bold px-8">
          Posicione o código da empresa dentro do quadrado para acessar as informações da linha.
        </p>
      </div>

      {error && (
        <div className="mt-4 bg-red-600/10 border border-red-600/20 p-4 rounded-xl text-red-500 text-[10px] font-black uppercase text-center">
          {error}
        </div>
      )}

      <button 
        onClick={onClose}
        className="mt-12 w-full max-w-sm py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/5 hover:bg-slate-800 transition-all"
      >
        Cancelar
      </button>
    </div>
  );
};

export default QRScanner;
