import { useEffect, useRef, useState } from 'react';
import { Map, useMap, useMapsLibrary, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

interface MapComponentProps {
  routes: any[];
  selectedRouteIndex: number;
}

export function MapComponent({ routes, selectedRouteIndex }: MapComponentProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  
  // San Francisco center
  const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
  const DEFAULT_ZOOM = 13;

  useEffect(() => {
    if (!map || routes.length === 0) return;

    // Clear existing polylines
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    const selectedRoute = routes[selectedRouteIndex];
    if (selectedRoute) {
      let path;
      if (selectedRoute.polyline?.encodedPolyline) {
        path = google.maps.geometry.encoding.decodePath(selectedRoute.polyline.encodedPolyline);
      } else if (selectedRoute.path) {
        path = selectedRoute.path;
      }

      const decodedPath = path?.map((p: any) => {
        if (typeof p.lat === 'function') return p;
        return new google.maps.LatLng(p.lat, p.lng);
      });

      if (decodedPath && decodedPath.length > 0) {
        const polyline = new google.maps.Polyline({
          path: decodedPath,
          geodesic: true,
          strokeColor: '#2563eb', // blue-600
          strokeOpacity: 1.0,
          strokeWeight: 6,
          map: map
        });

        polylinesRef.current.push(polyline);

        // Fit bounds
        const bounds = new google.maps.LatLngBounds();
        decodedPath.forEach((p: any) => bounds.extend(p));
        map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
      }
    }
  }, [map, routes, selectedRouteIndex]);

  return (
    <Map
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={DEFAULT_ZOOM}
      mapId="SF_ROUTE_MAP"
      disableDefaultUI={false}
      gestureHandling={'greedy'}
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      style={{ width: '100%', height: '100%' }}
    >
      {routes[selectedRouteIndex] && (
        <>
          <AdvancedMarker position={routes[selectedRouteIndex].origin}>
             <Pin background="#10b981" glyphColor="#fff" />
          </AdvancedMarker>
          <AdvancedMarker position={routes[selectedRouteIndex].destination}>
             <Pin background="#ef4444" glyphColor="#fff" />
          </AdvancedMarker>
        </>
      )}
    </Map>
  );
}
