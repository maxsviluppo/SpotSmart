"use client";

import React from 'react';
import SpotSmartApp from './SpotSmartApp';

export default function SpotSmartAppWrapper({ initialNews }: { initialNews?: any[] }) {
  return <SpotSmartApp initialNews={initialNews} />;
}
