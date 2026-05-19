/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Navigation2, Map as MapIcon, Info, Settings, Search, ArrowRight, TrendingUp, ChevronRight } from 'lucide-react';
import { MapComponent } from './components/Map';
import { RouteSidebar } from './components/RouteSidebar';
import { cn } from './lib/utils';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export default function App() {
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);
  const [routes, setRoutes] = useState<any[]>([]);
  const [bottomOffset, setBottomOffset] = useState(0);

  useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      if (window.visualViewport) {
        // Calculate the difference between normal height and visual viewport height
        // This gives us the keyboard height basically
        const offset = window.innerHeight - window.visualViewport.height;
        // On mobile, if there's a significant offset (>50px), it's likely the keyboard
        setBottomOffset(offset > 50 ? offset : 0);
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center h-screen font-sans bg-gray-50 p-4">
        {/* API key missing warning */}
        <div className="text-center max-w-lg bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-50 p-4 rounded-full">
              <MapIcon className="w-12 h-12 text-blue-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Google Maps API Setup Required</h2>
          <p className="text-gray-600 mb-6 font-medium">To use SF FlatPath, ensure your API key has the correct services enabled.</p>
          <div className="text-left space-y-4 mb-8">
            <p className="text-sm font-semibold text-gray-900">Please enable the Maps JavaScript API, Routes API, Places API, and Elevation API in Google Cloud Console.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="quarterly" libraries={['places', 'geometry', 'routes']}>
      <div className="relative h-[100dvh] w-full bg-[#F9F5EC] overflow-hidden font-sans text-[#162635]">
        
        {/* Map Background */}
        <div className="absolute inset-0 z-0">
          <MapComponent 
            routes={routes} 
            selectedRouteIndex={selectedRouteIndex} 
          />
        </div>

        {/* Floating UI Overlay */}
        <div 
          className="absolute inset-x-0 bottom-0 pointer-events-none z-10 flex flex-col items-center md:items-start md:pl-6 transition-transform duration-200 ease-out pb-0 md:pb-6"
          style={{ transform: `translateY(-${bottomOffset}px)` }}
        >
          <div className="pointer-events-auto w-full md:w-[400px]">
            <RouteSidebar 
              isOpen={true} 
              setIsOpen={() => {}}
              routes={routes}
              selectedRouteIndex={selectedRouteIndex}
              onSelectRoute={setSelectedRouteIndex}
              onRoutesFound={setRoutes}
            />
          </div>
        </div>
      </div>
    </APIProvider>
  );
}
