"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Caricamento dinamico puramente client-side
const SpotSmartAppDynamic = dynamic(() => import('./SpotSmartApp'), { ssr: false });

export default function SpotSmartAppWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fino a quando il componente non è montato interamente nel browser, esegue il rendering di un guscio scuro coerente con la UI per blindare il runtime contro l'accesso ai moduli dipendenti da localStorage
  if (!mounted) {
    return <div className="w-screen h-screen bg-black" />;
  }

  return <SpotSmartAppDynamic />;
}
