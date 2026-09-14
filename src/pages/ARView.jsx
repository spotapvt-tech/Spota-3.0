import { useState, useEffect, useRef } from 'react';
import { X, Navigation, Compass, CameraOff } from 'lucide-react';
import { haversineDistance } from '../lib/utils';
import './ARView.css';

// Helper to compute bearing from user (lat1, lon1) to spot (lat2, lon2)
function getBearing(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export default function ARView({ spots, userLocation, onClose, onSelectSpot }) {
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(false);
  const [heading, setHeading] = useState(0); // 0 = North, 90 = East, etc.
  const [dragOffset, setDragOffset] = useState(0); // Manual look offset for desktop drag
  const [isDragging, setIsDragging] = useState(false);
  const startDragX = useRef(0);
  const videoRef = useRef(null);

  const targetHeading = useRef(0);
  const currentHeadingSmooth = useRef(0);

  // Field of View in degrees
  const FOV = 60;

  // 1. Initialize Camera
  useEffect(() => {
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setCameraError(true);
      }
    }
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 2. Track Orientation Sensor and LERP heading smoothly
  useEffect(() => {
    const handleOrientation = (e) => {
      let currentVal = e.alpha;
      if (e.webkitCompassHeading) {
        currentVal = e.webkitCompassHeading;
      }
      if (currentVal !== null && currentVal !== undefined) {
        // webkitCompassHeading is aligned to magnetic north.
        // Standard alpha is counter-clockwise, compass heading is clockwise.
        targetHeading.current = (360 - currentVal + 360) % 360;
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);

    // Run animation frame loop to smoothly transition heading to target (lerp)
    let animFrame;
    const lerpAngle = (current, target, step) => {
      let diff = target - current;
      while (diff < -180) diff += 360;
      while (diff > 180) diff -= 360;
      return (current + diff * step + 360) % 360;
    };

    const updateSmoothHeading = () => {
      const nextHeading = lerpAngle(currentHeadingSmooth.current, targetHeading.current, 0.15);
      currentHeadingSmooth.current = nextHeading;
      setHeading(nextHeading);
      animFrame = requestAnimationFrame(updateSmoothHeading);
    };

    animFrame = requestAnimationFrame(updateSmoothHeading);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  // 3. Desktop Drag to look handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    startDragX.current = e.clientX;
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startDragX.current;
    // Map screen movement to degrees offset (e.g. 1px = 0.25deg)
    setDragOffset((prev) => (prev - deltaX * 0.25 + 360) % 360);
    startDragX.current = e.clientX;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 4. Calculate positions of visible spots
  const effectiveHeading = (heading + dragOffset + 360) % 360;

  // Mock a user location if browser geolocation was denied (for testing/desktop)
  const userCoords = userLocation || [28.6139, 77.2090]; // Default to Delhi

  const visibleSpots = spots
    .map((spot) => {
      const distance = haversineDistance(
        userCoords[0],
        userCoords[1],
        spot.latitude,
        spot.longitude
      );
      
      const bearing = getBearing(
        userCoords[0],
        userCoords[1],
        spot.latitude,
        spot.longitude
      );

      // Angle relative to our heading
      let diff = bearing - effectiveHeading;
      // Normalise to [-180, 180]
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      return {
        ...spot,
        distance,
        bearing,
        relativeAngle: diff,
        visible: Math.abs(diff) < (FOV / 2) + 5
      };
    })
    .filter((spot) => spot.visible);

  return (
    <div 
      className="ar-view-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={(e) => handleMouseDown({ clientX: e.touches[0].clientX })}
      onTouchMove={(e) => handleMouseMove({ clientX: e.touches[0].clientX })}
      onTouchEnd={handleMouseUp}
    >
      {/* Full-Screen Camera Feed */}
      {!cameraError ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="ar-camera-feed"
        />
      ) : (
        <div className="ar-camera-fallback">
          <CameraOff size={48} />
          <h3>Camera Feed Unavailable</h3>
          <p>Please check camera permissions. Drag left/right to look around the virtual radar.</p>
        </div>
      )}

      {/* Compass HUD */}
      <div className="ar-hud">
        <div className="hud-heading">
          <Compass size={18} className="hud-icon" />
          <span>{Math.round(effectiveHeading)}° {getCompassDirection(effectiveHeading)}</span>
        </div>
        <div className="hud-helper">
          <Navigation size={12} />
          <span>Drag screen left/right to rotate camera manually</span>
        </div>
      </div>

      <button className="ar-close-btn glass-panel" onClick={onClose}>
        <X size={24} />
      </button>

      {/* Floating Spot Labels Container */}
      <div className="ar-overlay">
        {visibleSpots.map((spot) => {
          // Horizontal offset percent (from -50% to +50%)
          const xPercent = (spot.relativeAngle / (FOV / 2)) * 50 + 50; 
          
          // Vertical offset scales based on distance (closer = lower/bigger, further = higher/smaller)
          const scale = Math.max(0.6, Math.min(1.2, 1 / (spot.distance + 0.1)));
          const yOffset = 150 + spot.distance * 80; // Distance shifts spot lower

          // Smoothly fade out spots near the screen edge (within the +5 degree extra buffer)
          const boundary = FOV / 2;
          const fadeStart = boundary - 5;
          const absAngle = Math.abs(spot.relativeAngle);
          let opacity = 1;
          if (absAngle > fadeStart) {
            opacity = Math.max(0, 1 - (absAngle - fadeStart) / (boundary + 5 - fadeStart));
          }

          return (
            <div
              key={spot.id}
              className="ar-spot-marker clickable"
              onClick={() => onSelectSpot(spot)}
              style={{
                left: `${xPercent}%`,
                top: `${Math.min(yOffset, window.innerHeight - 200)}px`,
                transform: `translate(-50%, -50%) scale(${scale})`,
                zIndex: Math.round(100 - spot.distance * 10),
                opacity: opacity
              }}
            >
              <div className="ar-marker-card glass-panel">
                <span className="ar-marker-emoji">
                  {spot.category === 'cafe' ? '☕' : (spot.category === 'viewpoint' ? '🌅' : '💎')}
                </span>
                <div className="ar-marker-details">
                  <h4>{spot.title}</h4>
                  <span>{spot.distance.toFixed(2)} km away</span>
                </div>
              </div>
            </div>
          );
        })}

        {visibleSpots.length === 0 && (
          <div className="ar-no-spots animate-pulse">
            <span>Scan around for nearby spots...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Compass direction labels
function getCompassDirection(deg) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((deg % 360) / 45)) % 8;
  return directions[index];
}
