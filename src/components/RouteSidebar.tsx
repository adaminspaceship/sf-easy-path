import { useState, useEffect, useRef } from 'react';
import { useMapsLibrary, useMap } from '@vis.gl/react-google-maps';
import { Search, Navigation2, MapPin, Loader2, ArrowRight, TrendingUp, Clock, MoveRight, ChevronDown, ChevronUp, Info, Activity, X, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { ElevationProfile } from './ElevationProfile';

interface RouteSidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  routes: any[];
  selectedRouteIndex: number;
  onSelectRoute: (index: number) => void;
  onRoutesFound: (routes: any[]) => void;
}

export function RouteSidebar({
  isOpen,
  setIsOpen,
  routes,
  selectedRouteIndex,
  onSelectRoute,
  onRoutesFound
}: RouteSidebarProps) {
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [destination, setDestination] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const placesLib = useMapsLibrary('places');
  const geometryLib = useMapsLibrary('geometry');
  
  const destContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location: ", error);
          setCurrentLocation({ lat: 37.7749, lng: -122.4194 }); // SF default
        }
      );
    } else {
      setCurrentLocation({ lat: 37.7749, lng: -122.4194 });
    }
  }, []);

  // Initialize Autocomplete
  useEffect(() => {
    if (!placesLib || !destContainerRef.current) return;

    const sfBounds = {
      north: 37.86,
      south: 37.68,
      east: -122.32,
      west: -122.51,
    };

    try {
      destContainerRef.current.innerHTML = '';

      // Create input for Destination
      const destInput = document.createElement('input');
      destInput.type = 'text';
      destInput.placeholder = 'Where to?';
      destInput.className = "w-full pl-8 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl transition-all focus:bg-white focus:border-blue-500 outline-none text-sm text-gray-900";

      const destAutocomplete = new placesLib.Autocomplete(destInput, {
        bounds: sfBounds,
        fields: ['formatted_address', 'name'],
      });

      destContainerRef.current.appendChild(destInput);

      // Listeners
      destAutocomplete.addListener('place_changed', () => {
        const place = destAutocomplete.getPlace();
        if (place && place.formatted_address) {
          setDestination(place.formatted_address);
        } else if (place && place.name) {
          setDestination(place.name);
        }
      });
      destInput.addEventListener('input', (e: any) => {
        setDestination(e.target.value);
      });

    } catch (e) {
      console.error("Google Maps Places Autocomplete failed to initialize", e);
    }
  }, [placesLib]);

  const findRoutes = async () => {
    if (!routesLib || !currentLocation || !destination) return;

    setIsSearching(true);
    try {
      if (!routesLib || !geometryLib) return;

      const response = await routesLib.Route.computeRoutes({
        origin: currentLocation,
        destination: destination,
        travelMode: 'WALKING',
        computeAlternativeRoutes: true,
        fields: ['*']
      });

      if (!response.routes || response.routes.length === 0) {
        alert('No routes found.');
        return;
      }

      // Analyze each route for elevation
      const analyzedRoutes = await Promise.all(
        response.routes.map(async (route: any, index: number) => {
          let path;
          if (route.polyline?.encodedPolyline) {
            path = geometryLib.encoding.decodePath(route.polyline.encodedPolyline);
          } else if (route.path) {
            path = route.path;
          } else {
            path = [];
          }
          const elevations = await getElevationData(path);
          const metrics = calculateElevationMetrics(elevations);
          
          return {
            routeObject: route,
            distanceMeters: route.distanceMeters,
            durationMillis: route.durationMillis,
            polyline: route.polyline,
            path: path,
            index,
            elevationData: elevations,
            metrics,
            origin: path.length > 0 ? (typeof path[0].toJSON === 'function' ? path[0].toJSON() : { lat: path[0].lat, lng: path[0].lng }) : null,
            destination: path.length > 0 ? (typeof path[path.length - 1].toJSON === 'function' ? path[path.length - 1].toJSON() : { lat: path[path.length - 1].lat, lng: path[path.length - 1].lng }) : null
          };
        })
      );

      // Sort routes by "effort" / difficulty
      // Lowest total climb + max gradient penalty
      analyzedRoutes.sort((a, b) => a.metrics.effortScore - b.metrics.effortScore);

      let finalRoutes = analyzedRoutes;
      if (analyzedRoutes.length > 2) {
        finalRoutes = [analyzedRoutes[0], analyzedRoutes[analyzedRoutes.length - 1]];
      }

      onRoutesFound(finalRoutes);
      onSelectRoute(0);
      
      // Trigger AI Analysis
      setIsAnalyzingAi(true);
      try {
        const response = await fetch('/api/analyze-routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ routes: finalRoutes, destination })
        });
        const data = await response.json();
        if (data.analysis) {
          setAiAnalysis(data.analysis);
        }
      } catch (err) {
        console.error("AI Error:", err);
      } finally {
        setIsAnalyzingAi(false);
      }
      
    } catch (error) {
      console.error('Error finding routes:', error);
      alert('Error finding routes. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const getElevationData = (path: google.maps.LatLng[]): Promise<any[]> => {
    return new Promise((resolve) => {
      const elevationService = new google.maps.ElevationService();
      
      // Sample ~50 points along the path for elevation profile
      const samples = Math.max(2, Math.min(path.length, 50));
      const cleanPath = path.map((p: any) => ({ 
        lat: typeof p.lat === 'function' ? p.lat() : p.lat, 
        lng: typeof p.lng === 'function' ? p.lng() : p.lng 
      }));
      
      // getElevationAlongPath restricts path to 512 points. Simplify if needed.
      const step = Math.max(1, Math.floor(cleanPath.length / 500));
      const simplifiedPath = cleanPath.filter((_: any, i: number) => i % step === 0).slice(0, 512);

      elevationService.getElevationAlongPath({
        path: simplifiedPath,
        samples: samples
      }, (results, status) => {
        if (status === 'OK' && results) {
          resolve(results.map(r => ({
            elevation: r.elevation,
            location: r.location.toJSON()
          })));
        } else {
          console.error('Elevation service failed:', status);
          resolve([]);
        }
      });
    });
  };

  const calculateElevationMetrics = (elevations: any[]) => {
    if (elevations.length < 2) return { totalClimb: 0, maxGradient: 0, effortScore: 0 };

    let totalClimb = 0;
    let maxGradient = 0;

    for (let i = 1; i < elevations.length; i++) {
        const diff = elevations[i].elevation - elevations[i-1].elevation;
        if (diff > 0) totalClimb += diff;

        // Roughly calculate gradient between points
        // Distance between samples (approximate)
        const gradient = Math.abs(diff) / 100; // Simplified
        if (gradient > maxGradient) maxGradient = gradient;
    }

    // Effort score: distance + climb * penalty
    // Higher max gradient increases effort significantly
    const effortScore = totalClimb + (maxGradient * 500);

    return {
      totalClimb: Math.round(totalClimb * 3.28084), // meters to feet
      maxGradient: (maxGradient * 100).toFixed(1),
      effortScore
    };
  };

  const handleReset = () => {
    onRoutesFound([]);
    setDestination('');
    setAiAnalysis(null);
    if (destContainerRef.current) {
      const input = destContainerRef.current.querySelector('input');
      if (input) input.value = '';
    }
  };

  const selectedRoute = routes[selectedRouteIndex];

  return (
    <div className="bg-white md:rounded-3xl rounded-t-3xl shadow-[0_-8px_30px_rgb(0,0,0,0.12)] border-t border-gray-200 md:border-none p-5 relative overflow-hidden transition-all duration-300">
      
      {/* SEARCH FORM */}
      <div className={cn("transition-all duration-300", routes.length > 0 ? "hidden" : "block")}>
        <div className="flex items-center gap-2 mb-4">
          <Navigation2 className="w-6 h-6 text-blue-600 fill-blue-600" />
          <h2 className="font-bold text-gray-900 text-xl tracking-tight">FlatPath</h2>
        </div>
        
        <div className="relative mb-3">
          <div ref={destContainerRef} className="w-full transition-all" />
        </div>
        
        <button
          onClick={findRoutes}
          disabled={isSearching || !currentLocation || !destination}
          className="w-full py-3.5 bg-black hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg"
        >
          {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
          {isSearching ? 'Finding routes...' : 'Find Easiest Path'}
        </button>
      </div>

      {/* ROUTE RESULTS */}
      {routes.length > 0 && selectedRoute && (
        <div className="animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-gray-900 text-xl flex items-center gap-2">
                {selectedRouteIndex === 0 ? (routes.length === 1 ? 'Suggested Path' : 'Easiest Path') : 'Hardest Path'}
                {selectedRouteIndex === 0 && <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full uppercase font-bold tracking-wide">Easiest</span>}
                {selectedRouteIndex === 1 && <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full uppercase font-bold tracking-wide">Hardest</span>}
              </h3>
              <p className="text-sm text-gray-500 font-medium mt-1 uppercase tracking-wide">
                {selectedRoute.durationMillis ? Math.round(selectedRoute.durationMillis / 60000) : 0} mins • {((selectedRoute.distanceMeters || 0) * 0.000621371).toFixed(1)} miles
              </p>
            </div>
            <button 
              onClick={handleReset} 
              className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Total Climb</p>
              <p className="font-bold text-gray-900 flex items-baseline gap-1 text-2xl">
                {selectedRoute.metrics.totalClimb} <span className="text-sm text-gray-500 font-medium">ft</span>
              </p>
            </div>
            <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Max Slope</p>
              <p className="font-bold text-gray-900 flex items-baseline gap-1 text-2xl">
                {selectedRoute.metrics.maxGradient} <span className="text-sm text-gray-500 font-medium">%</span>
              </p>
            </div>
          </div>

          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${currentLocation?.lat},${currentLocation?.lng}&destination=${encodeURIComponent(destination)}&travelmode=walking&dir_action=navigate`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm"
          >
            <MapPin className="w-5 h-5" />
            Export to Google Maps
          </a>
        </div>
      )}

    </div>
  );
}
