import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, ShieldAlert, Check, MapPin, Clock, Phone, User, 
  Mail, ArrowLeft, History, Play, Square, Navigation, AlertTriangle 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './SafeTrekView.css';

import { 
  calculateTimeRemaining, 
  formatCountdown, 
  isNearDeadline, 
  saveActiveTrekLocal, 
  getActiveTrekLocal, 
  clearActiveTrekLocal 
} from '../lib/safeTrekTimer';

import CheckInModal from '../components/CheckInModal';
import { checkBadges } from '../lib/badgeEngine';

// Fix for default Leaflet marker icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to center map dynamically
function MapCenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);
  return null;
}

// Map events handler to allow placing a marker by clicking
function MapEvents({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    }
  });
  return null;
}

export default function SafeTrekView() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Trek State
  const [activeTrek, setActiveTrek] = useState(() => getActiveTrekLocal());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isMuted] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  // Setup Form State
  const [destinationName, setDestinationName] = useState('');
  const [markerPosition, setMarkerPosition] = useState(null);
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]); // Delhi Default
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyEmail, setEmergencyEmail] = useState('');
  const [intervalHours, setIntervalHours] = useState(4);
  const [isTestMode, setIsTestMode] = useState(false);

  // History State
  const [trekHistory, setTrekHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Audio warning reference
  const audioRef = useRef(null);

  // Fetch Trek History
  const fetchHistory = useCallback(async () => {
    if (!user || user.isGuest) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('safe_treks')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTrekHistory(data || []);
    } catch (err) {
      console.error('Error fetching trek history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  // Load Active Trek from DB or Local Storage
  const loadActiveTrek = useCallback(async () => {
    if (!user) return;
    
    // Try local storage first
    let localTrek = getActiveTrekLocal();

    // Guest workflow bypasses database queries
    if (user.isGuest) {
      if (localTrek) {
        setActiveTrek(localTrek);
      } else {
        setActiveTrek(null);
      }
      return;
    }
    
    // Verify with DB to make sure it exists and is still active
    try {
      const { data, error } = await supabase
        .from('safe_treks')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'overdue'])
        .order('started_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const dbTrek = data[0];
        // Merge DB data with local test mode flag if applicable
        if (localTrek && localTrek.id === dbTrek.id) {
          const merged = {
            ...dbTrek,
            isTestMode: localTrek.isTestMode
          };
          setActiveTrek(merged);
          saveActiveTrekLocal(merged);
        } else {
          setActiveTrek(dbTrek);
          saveActiveTrekLocal(dbTrek);
        }
      } else {
        // No active trek in DB
        setActiveTrek(null);
        clearActiveTrekLocal();
      }
    } catch (err) {
      console.error('Error loading active trek:', err);
      if (localTrek) {
        setActiveTrek(localTrek);
      }
    }
  }, [user]);

  // Auto trigger overdue in DB
  const handleTrekOverdue = useCallback(async () => {
    if (!activeTrek || activeTrek.status !== 'active') return;

    try {
      const updatedTrek = { ...activeTrek, status: 'overdue' };
      setActiveTrek(updatedTrek);
      saveActiveTrekLocal(updatedTrek);

      if (!user.isGuest) {
        const { error } = await supabase
          .from('safe_treks')
          .update({ status: 'overdue' })
          .eq('id', activeTrek.id);

        if (error) throw error;
        fetchHistory();
      }
    } catch (err) {
      console.error('Error setting trek overdue:', err);
    }
  }, [activeTrek, user, fetchHistory]);

  // Initialize
  useEffect(() => {
    const timer = setTimeout(() => {
      loadActiveTrek();
      fetchHistory();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadActiveTrek, fetchHistory]);

  // Map Centering Geolocation
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setMapCenter(coords);
          setMarkerPosition(prev => prev || coords);
        },
        (err) => console.log('Geolocation bypass:', err)
      );
    }
  }, []);

  // Countdown timer loop
  useEffect(() => {
    if (!activeTrek) return;

    const updateTimer = () => {
      let remaining;
      if (activeTrek.isTestMode) {
        // Test mode: 60 seconds from last check-in
        const lastCheck = new Date(activeTrek.last_checked_in).getTime();
        const diff = Date.now() - lastCheck;
        remaining = Math.max(0, 60 - Math.floor(diff / 1000));
      } else {
        remaining = calculateTimeRemaining(activeTrek.last_checked_in, activeTrek.check_in_interval_hours);
      }

      setTimeRemaining(remaining);

      // Trigger automatic DB overdue state if timer hits 0
      if (remaining <= 0 && activeTrek.status === 'active') {
        handleTrekOverdue();
      }
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, [activeTrek, handleTrekOverdue]);

  // Alert and alarm sounds
  useEffect(() => {
    if (!activeTrek || timeRemaining <= 0) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    const testOrNear = activeTrek.isTestMode 
      ? timeRemaining <= 15  // Alert under 15 seconds in test mode
      : isNearDeadline(timeRemaining); // Alert under 30 minutes in normal mode

    if (testOrNear && !isMuted) {
      if (!audioRef.current) {
        // Create audio beep
        audioRef.current = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==');
        audioRef.current.loop = true;
      }
      // Simple alarm beep pattern or visual indicator
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [timeRemaining, activeTrek, isMuted]);



  // Start Trek Handler
  const handleStartTrek = async (e) => {
    e.preventDefault();
    if (!destinationName.trim()) {
      alert('Please enter a destination name');
      return;
    }
    if (!emergencyName.trim()) {
      alert('Please enter an emergency contact name');
      return;
    }
    if (!emergencyPhone.trim() && !emergencyEmail.trim()) {
      alert('Please provide at least a phone number or email for your emergency contact');
      return;
    }

    setSubmitting(true);
    try {
      const lat = markerPosition ? markerPosition[0] : mapCenter[0];
      const lng = markerPosition ? markerPosition[1] : mapCenter[1];
      const nowStr = new Date().toISOString();

      const newTrekData = {
        user_id: user.id,
        destination_name: destinationName,
        destination_lat: lat,
        destination_lng: lng,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone || null,
        emergency_contact_email: emergencyEmail || null,
        check_in_interval_hours: isTestMode ? 1 : intervalHours, // DB gets 1 hour default if test mode
        last_checked_in: nowStr,
        status: 'active',
        started_at: nowStr
      };

      let activeData;

      if (user.isGuest) {
        activeData = {
          ...newTrekData,
          id: `guest_trek_${Math.random().toString(36).substr(2, 9)}`,
          isTestMode: isTestMode
        };
      } else {
        const { data, error } = await supabase
          .from('safe_treks')
          .insert(newTrekData)
          .select()
          .single();

        if (error) throw error;
        
        activeData = {
          ...data,
          isTestMode: isTestMode
        };
      }

      setActiveTrek(activeData);
      saveActiveTrekLocal(activeData);
      
      // Reset form
      setDestinationName('');
      setEmergencyName('');
      setEmergencyPhone('');
      setEmergencyEmail('');
      setIsTestMode(false);
      
      if (!user.isGuest) {
        fetchHistory();
      }
    } catch (err) {
      console.error('Error starting trek:', err);
      alert('Failed to start trek: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Check In Handler
  const handleCheckIn = async () => {
    if (!activeTrek) return;

    try {
      const nowStr = new Date().toISOString();
      const updatedTrek = {
        ...activeTrek,
        last_checked_in: nowStr,
        status: 'active' // reset overdue if they check in
      };

      if (!user.isGuest) {
        const { error } = await supabase
          .from('safe_treks')
          .update({ 
            last_checked_in: nowStr,
            status: 'active'
          })
          .eq('id', activeTrek.id);

        if (error) throw error;
      }

      setActiveTrek(updatedTrek);
      saveActiveTrekLocal(updatedTrek);
      setShowAlertModal(false);
      alert("Check-in successful! Timer has been reset.");
      if (!user.isGuest) {
        fetchHistory();
      }
    } catch (err) {
      console.error('Error during check-in:', err);
      alert('Failed to check in: ' + err.message);
    }
  };

  // End Trek Handler
  const handleEndTrek = async () => {
    if (!activeTrek) return;
    if (!confirm('Are you sure you want to end this trek? Your emergency contacts will no longer be monitored.')) return;

    try {
      if (!user.isGuest) {
        const { error } = await supabase
          .from('safe_treks')
          .update({ status: 'completed' })
          .eq('id', activeTrek.id);

        if (error) throw error;
      }

      const count = Number(localStorage.getItem('spota_completed_treks_count') || '0');
      localStorage.setItem('spota_completed_treks_count', String(count + 1));

      setActiveTrek(null);
      clearActiveTrekLocal();
      alert('Trek ended safely. Emergency mode deactivated.');
      if (!user.isGuest) {
        fetchHistory();
      }

      // Trigger badge check
      setTimeout(() => {
        if (user) {
          checkBadges(user);
        }
      }, 600);
    } catch (err) {
      console.error('Error ending trek:', err);
      alert('Failed to end trek: ' + err.message);
    }
  };

  // Leaflet map click helper
  const handleMapClick = (latlng) => {
    setMarkerPosition([latlng.lat, latlng.lng]);
  };

  // Use current browser location
  const useCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setMapCenter(coords);
          setMarkerPosition(coords);
        },
        (err) => alert('Unable to retrieve location: ' + err.message)
      );
    }
  };

  // Circular progress calculations
  const totalDurationSeconds = activeTrek 
    ? (activeTrek.isTestMode ? 60 : activeTrek.check_in_interval_hours * 3600)
    : 3600;
  const progressRatio = activeTrek ? (timeRemaining / totalDurationSeconds) : 1;
  const strokeDashoffset = 502.65 - (progressRatio * 502.65);
  
  const isLowTime = activeTrek 
    ? (activeTrek.isTestMode ? timeRemaining <= 15 : isNearDeadline(timeRemaining))
    : false;

  const isOverdue = activeTrek ? activeTrek.status === 'overdue' : false;

  return (
    <div className="safe-trek-container animate-fade-in">
      {/* Header */}
      <div className="safe-trek-header">
        <button className="back-btn-circle" onClick={() => navigate('/profile')} title="Back to Profile">
          <ArrowLeft size={20} />
        </button>
        <div className="header-title-wrapper">
          <Shield className="shield-icon-active" size={24} />
          <h1>Safe Trek Mode</h1>
        </div>
      </div>

      {activeTrek ? (
        /* ACTIVE TREK COUNTDOWN STATE */
        <div className="active-trek-panel glass-panel">
          <div className={`countdown-wrapper ${isOverdue ? 'overdue' : isLowTime ? 'warning' : ''}`}>
            {/* SVG Radial Countdown */}
            <svg className="progress-ring" width="200" height="200">
              <circle
                className="progress-ring-bg"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="8"
                fill="transparent"
                r="80"
                cx="100"
                cy="100"
              />
              <circle
                className="progress-ring-fill"
                stroke={isOverdue ? '#e07a5f' : isLowTime ? '#f4a261' : 'var(--color-accent)'}
                strokeWidth="8"
                fill="transparent"
                r="80"
                cx="100"
                cy="100"
                style={{
                  strokeDasharray: '502.65',
                  strokeDashoffset: strokeDashoffset,
                  transition: 'stroke-dashoffset 1s linear'
                }}
              />
            </svg>

            <div className="countdown-time-box">
              <span className="countdown-title">
                {isOverdue ? 'OVERDUE' : 'CHECK-IN IN'}
              </span>
              <span className="countdown-time">
                {isOverdue ? '00:00:00' : formatCountdown(timeRemaining)}
              </span>
              {activeTrek.isTestMode && <span className="test-badge">TEST MODE</span>}
            </div>
          </div>

          <div className="trek-details-card glass-panel">
            <h3>{activeTrek.destination_name}</h3>
            <div className="detail-row">
              <MapPin size={16} />
              <span>
                Coordinates: {activeTrek.destination_lat?.toFixed(5)}, {activeTrek.destination_lng?.toFixed(5)}
              </span>
            </div>
            <div className="detail-row">
              <Clock size={16} />
              <span>Interval: {activeTrek.isTestMode ? '1 min (Test)' : `${activeTrek.check_in_interval_hours} hrs`}</span>
            </div>
            <div className="detail-row">
              <User size={16} />
              <span>Contact: {activeTrek.emergency_contact_name}</span>
            </div>
            {(activeTrek.emergency_contact_phone || activeTrek.emergency_contact_email) && (
              <div className="detail-row">
                <Phone size={16} />
                <span>
                  {activeTrek.emergency_contact_phone || activeTrek.emergency_contact_email}
                </span>
              </div>
            )}
          </div>

          {isLowTime && !isOverdue && (
            <div className="warning-banner-trek animate-pulse">
              <AlertTriangle size={18} />
              <span>Trek is nearing check-in limit! Check in to reset.</span>
            </div>
          )}

          {isOverdue && (
            <div className="danger-banner-trek animate-pulse">
              <ShieldAlert size={18} />
              <span>Trek Overdue! Emergency contacts have been notified.</span>
            </div>
          )}

          <div className="trek-actions">
            <button className="check-in-btn-primary" onClick={handleCheckIn}>
              <Check size={20} />
              I'm Safe - Check In
            </button>

            <button className="end-trek-btn-secondary" onClick={handleEndTrek}>
              <Square size={16} />
              End Trek Safely
            </button>
          </div>
        </div>
      ) : (
        /* SETUP MODE STATE */
        <div className="setup-trek-panel">
          <form className="trek-form glass-panel" onSubmit={handleStartTrek}>
            <h2 className="section-title">Configure Safe Trek</h2>

            <div className="form-group">
              <label>Destination Name</label>
              <div className="input-with-icon">
                <MapPin size={18} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="e.g. Mount Marcy Summit" 
                  value={destinationName} 
                  onChange={(e) => setDestinationName(e.target.value)}
                  required 
                />
              </div>
            </div>

            {/* Leaflet Selection Map */}
            <div className="form-group">
              <div className="map-label-row">
                <label>Pin Destination on Map</label>
                <button type="button" className="location-helper-btn" onClick={useCurrentLocation}>
                  <Navigation size={14} />
                  Use Current Location
                </button>
              </div>
              <div className="setup-map-container">
                <MapContainer center={mapCenter} zoom={13} style={{ height: '200px', width: '100%', borderRadius: '12px' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {markerPosition && <Marker position={markerPosition} />}
                  <MapCenter position={mapCenter} />
                  <MapEvents onMapClick={handleMapClick} />
                </MapContainer>
              </div>
              {markerPosition && (
                <span className="coords-helper">
                  Selected: {markerPosition[0].toFixed(5)}, {markerPosition[1].toFixed(5)}
                </span>
              )}
            </div>

            <div className="form-group">
              <label>Check-in Interval</label>
              <div className="interval-selectors">
                {[2, 4, 6, 8].map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={`interval-btn ${intervalHours === h && !isTestMode ? 'active' : ''}`}
                    onClick={() => { setIntervalHours(h); setIsTestMode(false); }}
                  >
                    {h} hrs
                  </button>
                ))}
                <button
                  type="button"
                  className={`interval-btn test-mode-btn ${isTestMode ? 'active' : ''}`}
                  onClick={() => setIsTestMode(true)}
                >
                  1 min (Test)
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Emergency Contact Name</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="e.g. Jane Doe" 
                  value={emergencyName} 
                  onChange={(e) => setEmergencyName(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Emergency Contact Phone</label>
              <div className="input-with-icon">
                <Phone size={18} className="input-icon" />
                <input 
                  type="tel" 
                  placeholder="e.g. +1 555-0199" 
                  value={emergencyPhone} 
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Emergency Contact Email</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input 
                  type="email" 
                  placeholder="e.g. jane@example.com" 
                  value={emergencyEmail} 
                  onChange={(e) => setEmergencyEmail(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="start-trek-submit" disabled={submitting}>
              <Play size={16} />
              {submitting ? 'Initializing...' : 'Start Safe Trek'}
            </button>
          </form>
        </div>
      )}

      {/* HISTORIC SHELF */}
      <div className="trek-history-section">
        <div className="history-header">
          <History size={18} />
          <h2>Trek Log History</h2>
        </div>

        {loadingHistory ? (
          <p className="loading-history-text">Loading past treks...</p>
        ) : trekHistory.length === 0 ? (
          <div className="empty-history-card glass-panel">
            <Shield size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
            <p>No past treks logged yet</p>
          </div>
        ) : (
          <div className="history-list">
            {trekHistory.map((trek) => {
              const dateStr = new Date(trek.started_at).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div key={trek.id} className="history-item glass-panel">
                  <div className="history-info">
                    <h4>{trek.destination_name}</h4>
                    <span className="history-date">{dateStr}</span>
                    <span className="history-details">
                      Interval: {trek.check_in_interval_hours} hrs · Contact: {trek.emergency_contact_name}
                    </span>
                  </div>
                  <span className={`status-badge ${trek.status}`}>
                    {trek.status.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alert modal when user is in the view and countdown requires focus */}
      {showAlertModal && (
        <CheckInModal
          onCheckIn={handleCheckIn}
          onClose={() => setShowAlertModal(false)}
          timeRemainingStr={formatCountdown(timeRemaining)}
          isOverdue={isOverdue}
        />
      )}
    </div>
  );
}
