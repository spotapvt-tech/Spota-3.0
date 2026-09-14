import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Search, X } from 'lucide-react';
import { reverseGeocode, searchPlaces } from '../../lib/geocoding';
import 'leaflet/dist/leaflet.css';
import './StepPin.css';

// Fix Leaflet default icons
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({ iconUrl, shadowUrl: iconShadow, iconSize: [25,41], iconAnchor: [12,41] });
L.Marker.prototype.options.icon = DefaultIcon;

function MapCenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom() < 14 ? 14 : map.getZoom());
  }, [position, map]);
  return null;
}

function ClickMarker({ location, setLocation }) {
  useMapEvents({
    click(e) {
      setLocation(prev => ({ ...prev, lat: e.latlng.lat, lng: e.latlng.lng, source: 'map' }));
    }
  });
  if (!location?.lat) return null;
  return (
    <Marker
      position={[location.lat, location.lng]}
      draggable
      eventHandlers={{
        dragend(e) {
          const p = e.target.getLatLng();
          setLocation(prev => ({ ...prev, lat: p.lat, lng: p.lng, source: 'map' }));
        }
      }}
    />
  );
}

export default function StepPin({ location, setLocation, photoGps }) {
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle | loading | success | denied | photo
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const abortRef = useRef(null);
  const searchContainerRef = useRef(null);

  const mapCenter = location?.lat ? [location.lat, location.lng] : [28.6139, 77.2090];

  // Auto GPS on step entry
  const detectGPS = useCallback(() => {
    if (!('geolocation' in navigator)) { setGpsStatus('denied'); return; }
    if (!navigator.onLine) { setGpsStatus('denied'); return; }
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const { name, address } = await reverseGeocode(lat, lng);
        setLocation({ lat, lng, placeName: name, address, source: 'gps' });
        setGpsStatus('success');
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
    );
  }, [setLocation]);

  useEffect(() => {
    if (location?.lat) {
      // Already have a location — just show it
      setGpsStatus(location.source === 'exif' ? 'photo' : 'success');
      return;
    }
    if (photoGps?.lat && photoGps?.lng) {
      // EXIF GPS found in the photo — use it, then reverse-geocode for place name
      setGpsStatus('loading');
      reverseGeocode(photoGps.lat, photoGps.lng).then(({ name, address }) => {
        setLocation({
          lat: photoGps.lat,
          lng: photoGps.lng,
          placeName: name,
          address,
          source: 'exif',
        });
        setGpsStatus('photo');
      }).catch(() => {
        // reverse geocode failed but we still have coords
        setLocation({ lat: photoGps.lat, lng: photoGps.lng, source: 'exif' });
        setGpsStatus('photo');
      });
    } else {
      // No EXIF GPS — fall back to device GPS
      detectGPS();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reverse geocode when map-tapped location changes
  useEffect(() => {
    if (location?.source === 'map' && location.lat) {
      reverseGeocode(location.lat, location.lng).then(({ name, address }) => {
        setLocation(prev => ({ ...prev, placeName: name, address }));
      });
    }
  }, [location?.lat, location?.lng, location?.source, setLocation]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length < 3) { setSearchResults([]); setShowDropdown(false); return; }
    const t = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setIsSearching(true);
      const results = await searchPlaces(searchQuery, abortRef.current.signal);
      if (results !== null) {
        setSearchResults(results || []);
        setShowDropdown(true);
      }
      setIsSearching(false);
    }, 380);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectResult = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    if (isNaN(lat) || isNaN(lng)) return;
    const parts = (item.display_name || '').split(',');
    setLocation({ lat, lng, placeName: parts[0]?.trim() || '', address: item.display_name || '', source: 'search' });
    setSearchQuery(item.display_name || '');
    setShowDropdown(false);
    setSearchResults([]);
    setGpsStatus('success');
  };

  return (
    <div className="step-pin wizard-step">
      <div className="step-header">
        <h2>Drop the Pin 📍</h2>
        <p>Confirm where this gem lives.</p>
      </div>

      {/* GPS Banner */}
      <div className={`gps-banner ${gpsStatus}`}>
        {gpsStatus === 'loading' && (
          <>
            <span className="gps-spinner">⏳</span>
            <span>Detecting location…</span>
          </>
        )}

        {/* ── Photo EXIF GPS banner */}
        {gpsStatus === 'photo' && (
          <>
            <div className="gps-banner-info">
              <span className="gps-place-name">📸 Location from your photo</span>
              {location?.placeName && (
                <span className="gps-address">{location.placeName}{location.address ? ` · ${location.address.split(',').slice(0,2).join(', ')}` : ''}</span>
              )}
            </div>
            <button
              type="button"
              className="gps-switch-btn"
              onClick={() => { setGpsStatus('idle'); setLocation(null); detectGPS(); }}
              title="Use your current device GPS instead"
            >
              ↻ Use my GPS
            </button>
          </>
        )}

        {gpsStatus === 'success' && location?.source !== 'exif' && location?.placeName && (
          <>
            <div className="gps-banner-info">
              <span className="gps-place-name">📡 {location.placeName}</span>
              {location.address && <span className="gps-address">{location.address.split(',').slice(0,3).join(', ')}</span>}
            </div>
            <button type="button" className="gps-refresh-btn" onClick={detectGPS}>↻ GPS</button>
          </>
        )}
        {gpsStatus === 'success' && location?.source !== 'exif' && !location?.placeName && (
          <>
            <span>📡 Location pinned</span>
            <button type="button" className="gps-refresh-btn" onClick={detectGPS}>↻ GPS</button>
          </>
        )}
        {gpsStatus === 'denied' && (
          <>
            <span>⚠️ GPS unavailable — search or tap the map</span>
            <button type="button" className="gps-refresh-btn" onClick={detectGPS}>↻ Retry</button>
          </>
        )}
        {gpsStatus === 'idle' && (
          <button type="button" className="gps-detect-btn" onClick={detectGPS}>
            📡 Detect My Location
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="pin-search-container" ref={searchContainerRef}>
        <div className="pin-search-wrap">
          <Search size={15} className="pin-search-icon" />
          <input
            type="text"
            placeholder="Search a different place or address…"
            className="pin-search-input"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); }}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          />
          {searchQuery && (
            <button type="button" className="pin-search-clear" onClick={() => { setSearchQuery(''); setShowDropdown(false); }}>
              <X size={13} />
            </button>
          )}
        </div>

        {showDropdown && (searchResults.length > 0 || isSearching) && (
          <div className="pin-search-dropdown glass-panel">
            {isSearching ? (
              <div className="pin-search-loading">Searching… 🗺️</div>
            ) : (
              searchResults.map((item, idx) => {
                const parts = (item.display_name || '').split(',');
                return (
                  <div key={item.place_id || idx} className="pin-search-result" onClick={() => handleSelectResult(item)}>
                    <span className="pin-result-icon">📍</span>
                    <div>
                      <div className="pin-result-main">{parts[0]}</div>
                      {parts[1] && <div className="pin-result-sub">{parts.slice(1,3).join(', ')}</div>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="pin-map-wrapper">
        <MapContainer center={mapCenter} zoom={14} scrollWheelZoom zoomControl={false}
          style={{ height: '100%', width: '100%' }}>
          <MapCenter position={location?.lat ? [location.lat, location.lng] : null} />
          <TileLayer
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <ClickMarker location={location} setLocation={setLocation} />
        </MapContainer>
        <div className="pin-map-hint">Tap map to move pin · Drag pin to fine-tune</div>
      </div>

      {/* Confirmed address */}
      {location?.address && (
        <div className="pin-address-card glass-panel">
          <span>📍</span>
          <div>
            <div className="pin-address-name">{location.placeName || 'Pinned Location'}</div>
            <div className="pin-address-full">{location.address}</div>
            {location.lat && (
              <div className="pin-address-coords">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
