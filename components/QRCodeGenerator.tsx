
import React from 'react';

interface QRCodeGeneratorProps {
  value: string;
  routeName: string;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ value, routeName }) => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=020617&format=svg`;

  return (
    <div className="flex flex-col items-center">
      <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">Acesso à Rota</h3>
      <div className="bg-white p-4 rounded-2xl shadow-xl mb-4 flex items-center justify-center">
        <img src={qrUrl} alt={`QR Code`} className="w-32 h-32 md:w-48 md:h-48" />
      </div>
      <p className="text-[9px] text-slate-500 text-center font-bold uppercase tracking-widest leading-tight max-w-[150px]">
        Escaneie <span className="text-blue-600">{routeName}</span>
      </p>
      <button 
        onClick={() => window.print()}
        className="mt-4 flex items-center gap-2 px-6 py-2 bg-slate-950 text-white rounded-xl hover:bg-slate-900 transition-all font-black text-[8px] uppercase tracking-widest border border-slate-200"
      >
        Imprimir
      </button>
    </div>
  );
};

export default QRCodeGenerator;
