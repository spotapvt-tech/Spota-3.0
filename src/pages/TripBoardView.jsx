import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, UserPlus, Plus, ThumbsUp, CheckSquare, Square, Info, Sparkles } from 'lucide-react';
import TripInviteModal from '../components/TripInviteModal';
import SpotDetailsModal from '../components/SpotDetailsModal';
import TripRecapModal from '../components/TripRecapModal';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './TripBoardView.css';

// Fix for default Leaflet markers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function MapCenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);
  return null;
}

// Dynamic Bounds & Polyline Path Component
function MapBoundsAndPath({ spots }) {
  const map = useMap();

  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const cleanStr = timeStr.trim().toUpperCase();
    
    // Match hours, minutes, and optional AM/PM modifier with or without spacing
    const match = cleanStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
    if (!match) return 0;
    
    let hours = parseInt(match[1], 10) || 0;
    const minutes = parseInt(match[2], 10) || 0;
    const modifier = match[3] || 'AM';
    
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  useEffect(() => {
    if (!spots || spots.length === 0) return;
    
    // Extract coordinates safely (guarantees no NaN values)
    const coords = spots
      .map(s => {
        if (!s.spots) return null;
        const lat = parseFloat(s.spots.latitude);
        const lng = parseFloat(s.spots.longitude);
        return (!isNaN(lat) && !isNaN(lng)) ? [lat, lng] : null;
      })
      .filter(Boolean);

    if (coords.length > 0) {
      try {
        // Auto-fit bounds of all markers with safety padding
        map.fitBounds(coords, { padding: [50, 50], maxZoom: 15 });
      } catch (err) {
        console.error("Leaflet fitBounds failed:", err);
      }
    }
  }, [spots, map]);

  if (!spots || spots.length < 2) return null;

  // Draw connecting itinerary line sorted by Day -> sort_order -> schedule_time (intraday minutes sorting)
  const pathCoords = [...spots]
    .sort((a, b) => {
      if (a.itinerary_day !== b.itinerary_day) {
        return (a.itinerary_day || 1) - (b.itinerary_day || 1);
      }
      if (a.sort_order !== b.sort_order) {
        return (a.sort_order || 0) - (b.sort_order || 0);
      }
      return parseTimeToMinutes(a.schedule_time) - parseTimeToMinutes(b.schedule_time);
    })
    .map(s => {
      if (!s.spots) return null;
      const lat = parseFloat(s.spots.latitude);
      const lng = parseFloat(s.spots.longitude);
      return (!isNaN(lat) && !isNaN(lng)) ? [lat, lng] : null;
    })
    .filter(Boolean);

  return (
    <Polyline
      positions={pathCoords}
      pathOptions={{
        color: '#8e44ad',
        weight: 3,
        opacity: 0.6,
        dashArray: '8, 8',
        lineJoin: 'round'
      }}
    />
  );
}

function generateRandomId() {
  return `lead_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export default function TripBoardView() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [members, setMembers] = useState([]);
  const [tripSpots, setTripSpots] = useState([]);
  const [votes, setVotes] = useState([]); // Array of { spot_id, user_id }
  const [allAvailableSpots, setAllAvailableSpots] = useState([]); // Spots not in trip yet
  
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddSpotDrawer, setShowAddSpotDrawer] = useState(false);
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState(null); // For details modal
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]); // Default to Delhi
  const [agencyBrand, setAgencyBrand] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Fetch all collaborative trip board details
  const fetchTripData = useCallback(async () => {
    try {
      // 1. Fetch trip details
      let tripData = null;
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .single();

        if (!error && data) {
          tripData = data;
        }
      } catch (err) {
        console.warn('DB error fetching trip details', err);
      }

      // Fallback check in local storage
      if (!tripData) {
        const localTripStr = localStorage.getItem(`spota_trip_${tripId}`);
        if (localTripStr) {
          tripData = JSON.parse(localTripStr);
        }
      }

      if (!tripData) {
        throw new Error('Trip board not found');
      }
      setTrip(tripData);

      // Fetch Agency branding if associated with agency
      let isAgencyOwner = false;
      if (tripData.agency_id) {
        let agencyProfile = null;
        try {
          const { data, error } = await supabase
            .from('agency_profiles')
            .select('*')
            .eq('id', tripData.agency_id)
            .maybeSingle();
          if (!error && data) {
            agencyProfile = data;
          }
        } catch (err) {
          console.warn('DB error fetching trip agency brand', err);
        }

        // Fallback check in local storage
        if (!agencyProfile) {
          const localKeys = Object.keys(localStorage);
          for (const key of localKeys) {
            if (key.startsWith('spota_agency_')) {
              const val = JSON.parse(localStorage.getItem(key));
              if (val && val.id === tripData.agency_id) {
                agencyProfile = val;
                break;
              }
            }
          }
        }
        setAgencyBrand(agencyProfile);

        if (agencyProfile && agencyProfile.profile_id === user.id) {
          isAgencyOwner = true;
        }
      } else {
        setAgencyBrand(null);
      }

      // 2. Fetch trip members
      let membersList = [];
      try {
        const { data, error } = await supabase
          .from('trip_members')
          .select(`
            user_id,
            role,
            profiles:user_id (
              username,
              avatar_url
            )
          `)
          .eq('trip_id', tripId);

        if (!error && data) {
          membersList = data;
        }
      } catch (membersErr) {
        console.warn('DB error fetching members', membersErr);
      }

      // Local storage fallback for members
      const localTripMembersKey = `spota_trip_members_${tripId}`;
      const localMembers = localStorage.getItem(localTripMembersKey);
      if (membersList.length === 0 && localMembers) {
        membersList = JSON.parse(localMembers);
      }
      setMembers(membersList);

      // Verify active user is a member or the agency owner of the board
      const isMember = membersList.some(m => m.user_id === user.id) || isAgencyOwner;
      if (!isMember) {
        alert('You are not a member of this trip board.');
        navigate('/trips');
        return;
      }

      // 3. Fetch trip spots with itinerary and booking info
      let tripSpotsData = [];
      let tripSpotsError = null;
      try {
        const { data, error } = await supabase
          .from('trip_spots')
          .select(`
            trip_id,
            spot_id,
            added_by,
            visited,
            added_at,
            itinerary_day,
            schedule_time,
            booking_cta_label,
            booking_cta_url,
            spots:spot_id (
              id,
              title,
              description,
              latitude,
              longitude,
              image_url,
              category
            )
          `)
          .eq('trip_id', tripId);
        
        if (error) throw error;
        tripSpotsData = data;
      } catch (err) {
        console.warn('DB select with itinerary fields failed, using basic select query', err);
        try {
          const { data, error } = await supabase
            .from('trip_spots')
            .select(`
              trip_id,
              spot_id,
              added_by,
              visited,
              added_at,
              spots:spot_id (
                id,
                title,
                description,
                latitude,
                longitude,
                image_url,
                category
              )
            `)
            .eq('trip_id', tripId);
          if (error) throw error;
          tripSpotsData = data;
        } catch (innerErr) {
          tripSpotsError = innerErr;
        }
      }

      if (tripSpotsError) throw tripSpotsError;
      
      // Merge with local storage itinerary details (sandbox fallback)
      const localSpotsKey = `spota_trip_spots_${tripId}`;
      const localSpots = JSON.parse(localStorage.getItem(localSpotsKey) || '[]');
      
      const validTripSpots = (tripSpotsData || [])
        .filter(item => item.spots !== null)
        .map(dbItem => {
          const localItem = localSpots.find(ls => (ls.id === dbItem.spot_id || ls.spot_id === dbItem.spot_id));
          return {
            ...dbItem,
            itinerary_day: dbItem.itinerary_day !== undefined && dbItem.itinerary_day !== null ? dbItem.itinerary_day : (localItem?.itinerary_day || 1),
            schedule_time: dbItem.schedule_time !== undefined && dbItem.schedule_time !== null ? dbItem.schedule_time : (localItem?.schedule_time || ''),
            booking_cta_label: dbItem.booking_cta_label !== undefined && dbItem.booking_cta_label !== null ? dbItem.booking_cta_label : (localItem?.booking_cta_label || 'Book Spot'),
            booking_cta_url: dbItem.booking_cta_url !== undefined && dbItem.booking_cta_url !== null ? dbItem.booking_cta_url : (localItem?.booking_cta_url || '')
          };
        });
      setTripSpots(validTripSpots);

      if (validTripSpots.length > 0) {
        // Center on the last added spot
        const lastSpot = validTripSpots[validTripSpots.length - 1].spots;
        setMapCenter([lastSpot.latitude, lastSpot.longitude]);
      }

      // 4. Fetch spot votes
      const { data: votesData, error: votesError } = await supabase
        .from('trip_spot_votes')
        .select('spot_id, user_id')
        .eq('trip_id', tripId);

      if (votesError) throw votesError;
      setVotes(votesData || []);

      // 5. Fetch all database spots to allow adding to trip
      const { data: allSpots, error: allSpotsError } = await supabase
        .from('spots')
        .select('id, title, category, description, latitude, longitude, image_url')
        .neq('status', 'deleted')
        .neq('status', 'flagged');

      if (allSpotsError) throw allSpotsError;

      // Filter out spots already in the trip
      const existingSpotIds = validTripSpots.map(ts => ts.spot_id);
      const available = (allSpots || []).filter(s => !existingSpotIds.includes(s.id));
      setAllAvailableSpots(available);

    } catch (err) {
      console.error('Error loading trip board:', err);
      alert('Failed to load trip board.');
      navigate('/trips');
    } finally {
      setLoading(false);
    }
  }, [tripId, user.id, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTripData();
    }, 0);

    // Set up Realtime Sync with Presence indicators
    const channel = supabase.channel(`realtime-trip-${tripId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat().map(presence => ({
          userId: presence.user_id,
          username: presence.username
        }));
        setOnlineUsers(users);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_spots', filter: `trip_id=eq.${tripId}` }, () => {
        fetchTripData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_spot_votes', filter: `trip_id=eq.${tripId}` }, () => {
        fetchTripData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${tripId}` }, () => {
        fetchTripData();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user && !user.isGuest) {
          await channel.track({
            user_id: user.id,
            username: user.username || user.email || 'Explorer'
          });
        }
      });

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [tripId, fetchTripData, user]);

  // Vote Actions
  const handleToggleVote = async (spotId) => {
    const hasVoted = votes.some(v => v.spot_id === spotId && v.user_id === user.id);
    
    // Optimistic UI updates
    if (hasVoted) {
      setVotes(prev => prev.filter(v => !(v.spot_id === spotId && v.user_id === user.id)));
      try {
        await supabase
          .from('trip_spot_votes')
          .delete()
          .eq('trip_id', tripId)
          .eq('spot_id', spotId)
          .eq('user_id', user.id);
      } catch (err) {
        console.error('Failed to delete vote:', err);
        fetchTripData();
      }
    } else {
      setVotes(prev => [...prev, { spot_id: spotId, user_id: user.id }]);
      try {
        await supabase
          .from('trip_spot_votes')
          .insert({
            trip_id: tripId,
            spot_id: spotId,
            user_id: user.id
          });
      } catch (err) {
        console.error('Failed to cast vote:', err);
        fetchTripData();
      }
    }
  };

  // Visited Toggle
  const handleToggleVisited = async (spotId, currentVisited) => {
    // Optimistic UI update
    setTripSpots(prev => 
      prev.map(ts => ts.spot_id === spotId ? { ...ts, visited: !currentVisited } : ts)
    );

    try {
      const { error } = await supabase
        .from('trip_spots')
        .update({ visited: !currentVisited })
        .eq('trip_id', tripId)
        .eq('spot_id', spotId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to toggle visited status:', err);
      fetchTripData();
    }
  };

  // Add Spot to Trip Board
  const handleAddSpotToTrip = async (spotId) => {
    try {
      const { error } = await supabase
        .from('trip_spots')
        .insert({
          trip_id: tripId,
          spot_id: spotId,
          added_by: user.id
        });

      if (error) throw error;
      setShowAddSpotDrawer(false);
      fetchTripData();
    } catch (err) {
      console.error('Failed to add spot to trip:', err);
      alert('Failed to add spot to trip.');
    }
  };

  // Remove Spot from Trip Board
  const handleRemoveSpotFromTrip = async (spotId) => {
    if (!confirm('Are you sure you want to remove this spot from the trip board?')) return;
    try {
      const { error } = await supabase
        .from('trip_spots')
        .delete()
        .eq('trip_id', tripId)
        .eq('spot_id', spotId);

      if (error) throw error;
      fetchTripData();
    } catch (err) {
      console.error('Failed to remove spot:', err);
      alert('Failed to remove spot.');
    }
  };

  const getSpotVotesCount = (spotId) => {
    return votes.filter(v => v.spot_id === spotId).length;
  };

  const userHasVoted = (spotId) => {
    return votes.some(v => v.spot_id === spotId && v.user_id === user.id);
  };

  const handleBookingClick = async (e, ts) => {
    e.stopPropagation();
    if (!ts.booking_cta_url) return;

    try {
      await supabase
        .from('agency_leads')
        .insert({
          agency_id: trip.agency_id,
          visitor_id: user.id,
          spot_id: ts.spot_id,
          source_platform: 'trip_board'
        });
    } catch (err) {
      console.warn('Lead tracking insertion failed, logging click in local storage:', err);
    }

    // Save lead locally as well for analytics dashboard metrics fallbacks
    const localLeadsKey = `spota_agency_leads_${trip.agency_id}`;
    const localLeads = JSON.parse(localStorage.getItem(localLeadsKey) || '[]');
    const newLead = {
      id: generateRandomId(),
      clicked_at: new Date().toISOString(),
      source_platform: 'trip_board',
      spot_name: ts.spots?.title || 'Unknown Spot',
      visitor_name: user.user_metadata?.username || 'Guest Explorer',
      commission: 3.50
    };
    localStorage.setItem(localLeadsKey, JSON.stringify([newLead, ...localLeads]));

    // Open booking link
    window.open(ts.booking_cta_url, '_blank');
  };

  const renderSpotItemRow = (ts) => {
    const spot = ts.spots;
    if (!spot) return null;
    const votesCount = getSpotVotesCount(spot.id);
    const isVoted = userHasVoted(spot.id);

    return (
      <div key={spot.id} className={`trip-spot-item ${ts.visited ? 'visited' : ''} ${ts.booking_cta_url ? 'has-booking' : ''}`}>
        <div className="item-main" onClick={() => setMapCenter([spot.latitude, spot.longitude])}>
          {spot.image_url ? (
            <img src={spot.image_url} alt={spot.title} className="item-thumbnail" />
          ) : (
            <div className="item-thumbnail placeholder">💎</div>
          )}
          <div className="item-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0 }}>{spot.title}</h4>
              {ts.schedule_time && (
                <span className="schedule-time-badge" style={{ fontSize: '10px', background: 'rgba(108,140,116,0.12)', color: 'var(--color-accent)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  🕒 {ts.schedule_time}
                </span>
              )}
            </div>
            <span className="item-cat">{spot.category}</span>
          </div>
        </div>

        <div className="item-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {ts.booking_cta_url && (
            <button 
              className="row-booking-btn" 
              onClick={(e) => handleBookingClick(e, ts)}
              style={{
                background: '#8e44ad',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🎟️ {ts.booking_cta_label || 'Book'}
            </button>
          )}

          <button 
            className={`vote-btn ${isVoted ? 'active' : ''}`}
            onClick={() => handleToggleVote(spot.id)}
            title="Upvote Destination"
          >
            <ThumbsUp size={16} />
            <span>{votesCount}</span>
          </button>

          <button 
            className="visited-toggle-btn"
            onClick={() => handleToggleVisited(spot.id, ts.visited)}
            title={ts.visited ? 'Mark Unvisited' : 'Mark Visited'}
          >
            {ts.visited ? <CheckSquare size={18} color="var(--color-accent)" /> : <Square size={18} />}
          </button>

          <button 
            className="remove-btn"
            onClick={() => handleRemoveSpotFromTrip(spot.id)}
            title="Remove Spot"
          >
            ×
          </button>
        </div>
      </div>
    );
  };

  const renderSpotsList = () => {
    if (tripSpots.length === 0) {
      return (
        <div className="empty-spots">
          <Info size={24} />
          <p>No locations added yet.</p>
          <span>Click "Add Spot" above to pin items from the map database onto your group board!</span>
        </div>
      );
    }

    if (agencyBrand) {
      // Group spots by day
      const spotsByDay = {};
      tripSpots.forEach(ts => {
        const day = ts.itinerary_day || 1;
        if (!spotsByDay[day]) spotsByDay[day] = [];
        spotsByDay[day].push(ts);
      });

      const sortedDays = Object.keys(spotsByDay).sort((a, b) => parseInt(a) - parseInt(b));

      return sortedDays.map(dayNum => (
        <div key={dayNum} className="itinerary-day-group" style={{ marginBottom: '16px' }}>
          <div className="itinerary-day-separator" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            margin: '12px 0 8px 0', 
            fontSize: '11px', 
            fontWeight: 700, 
            color: '#8e44ad',
            letterSpacing: '1px'
          }}>
            <span style={{ background: 'rgba(142,68,173,0.1)', padding: '4px 10px', borderRadius: '4px' }}>
              DAY {dayNum}
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(142,68,173,0.15)', marginLeft: '8px' }}></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {spotsByDay[dayNum]
              .sort((a, b) => (a.schedule_time || '').localeCompare(b.schedule_time || ''))
              .map(ts => renderSpotItemRow(ts))}
          </div>
        </div>
      ));
    }

    // Default voting-based sorting list
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tripSpots
          .sort((a, b) => getSpotVotesCount(b.spot_id) - getSpotVotesCount(a.spot_id))
          .map(ts => renderSpotItemRow(ts))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="trip-board-container loading-state">
        <p>Loading collaborative board...</p>
      </div>
    );
  }

  if (!trip) return null;

  return (
    <div className="trip-board-container animate-fade-in">
      {/* Top Banner Toolbar */}
      <div className={`trip-board-header glass-panel ${agencyBrand ? 'co-branded' : ''}`} style={agencyBrand ? { borderTop: '4px solid #8e44ad' } : {}}>
        <button className="back-btn" onClick={() => navigate('/trips')}>
          <ArrowLeft size={20} />
        </button>
        <div className="header-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2>{trip.name}</h2>
            {agencyBrand && (
              <span className="verified-agency-badge" style={{ backgroundColor: 'rgba(142, 68, 173, 0.12)', color: '#8e44ad', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                👑 {agencyBrand.company_name} Partner
              </span>
            )}
          </div>
          <span className="destination-tag">{trip.destination || 'Flexible Route'}</span>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="invite-action-btn" onClick={() => setShowRecapModal(true)} style={{ backgroundColor: 'rgba(221, 161, 94, 0.12)', color: '#DDA15E' }}>
            <Sparkles size={18} />
            <span>Recap</span>
          </button>
          <button className="invite-action-btn" onClick={() => setShowInviteModal(true)}>
            <UserPlus size={18} />
            <span>Invite</span>
          </button>
        </div>
      </div>

      {/* Split Screens Layout */}
      <div className="trip-board-body">
        {/* Map panel */}
        <div className="trip-board-map">
          <MapContainer 
            center={mapCenter} 
            zoom={13} 
            scrollWheelZoom={true} 
            zoomControl={false}
            className="trip-map"
          >
            <MapCenter position={mapCenter} />
            <MapBoundsAndPath spots={tripSpots} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />

            {tripSpots.map((ts) => {
              const spot = ts.spots;
              const votesCount = getSpotVotesCount(spot.id);
              const customPin = L.divIcon({
                className: 'custom-trip-marker',
                html: `<div class="trip-gem-pin ${ts.visited ? 'visited' : ''}" style="${agencyBrand ? 'border-color: #8e44ad;' : ''}">
                  <span class="pin-votes">${votesCount > 0 ? `👍 ${votesCount}` : '💎'}</span>
                </div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 36]
              });

              return (
                <Marker key={spot.id} position={[spot.latitude, spot.longitude]} icon={customPin}>
                  <Popup>
                    <div className="custom-popup">
                      {spot.image_url && <img src={spot.image_url} alt={spot.title} className="popup-image-mini" />}
                      <h3>{spot.title}</h3>
                      <p>{spot.description || spot.category}</p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button className="popup-details-btn" onClick={() => setSelectedSpot(spot)} style={{ margin: 0, flex: 1 }}>
                          Details
                        </button>
                        <button 
                          onClick={() => handleToggleVote(spot.id)}
                          style={{
                            background: userHasVoted(spot.id) ? 'var(--color-accent)' : 'rgba(108,140,116,0.1)',
                            color: userHasVoted(spot.id) ? '#fff' : 'var(--color-accent)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <ThumbsUp size={12} />
                          <span>{votesCount}</span>
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Spot planning list drawer */}
        <div className="trip-board-sidebar glass-panel">
          <div className="sidebar-header">
            <h3>Pinned Locations ({tripSpots.length})</h3>
            <button className="add-spot-trigger" onClick={() => setShowAddSpotDrawer(true)}>
              <Plus size={16} />
              <span>Add Spot</span>
            </button>
          </div>

          <div className="sidebar-members">
            <span className="members-title">Collaborators:</span>
            <div className="members-avatars">
              {members.map((m, idx) => {
                const username = m.profiles?.username || 'Explorer';
                const avatarInitials = username.substring(0, 2).toUpperCase();
                const isOnline = onlineUsers.some(ou => ou.userId === m.user_id);
                return (
                  <div 
                    key={idx} 
                    className={`member-avatar-circle ${isOnline ? 'online' : ''}`} 
                    title={`${username} (${m.role}) ${isOnline ? '(Online)' : ''}`}
                    style={{ 
                      zIndex: 10 - idx, 
                      cursor: 'pointer',
                      border: isOnline ? '2px solid #2ecc71' : '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: isOnline ? '0 0 8px #2ecc71' : 'none'
                    }}
                    onClick={() => navigate('/profile', { state: { userId: m.user_id, collaborator: m } })}
                  >
                    {m.profiles?.avatar_url ? (
                      <img src={m.profiles.avatar_url} alt={username} />
                    ) : (
                      avatarInitials
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="trip-spots-list">
            {renderSpotsList()}
          </div>
        </div>
      </div>

      {/* ADD SPOT DRAWER MODAL OVERLAY */}
      {showAddSpotDrawer && (
        <div className="add-spot-drawer-backdrop" onClick={() => setShowAddSpotDrawer(false)}>
          <div className="add-spot-drawer glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Add Spot to Trip</h3>
              <button className="drawer-close" onClick={() => setShowAddSpotDrawer(false)}>×</button>
            </div>
            <div className="available-spots-list">
              {allAvailableSpots.length === 0 ? (
                <p className="no-spots-msg">All approved map spots are already added to this trip board!</p>
              ) : (
                allAvailableSpots.map((spot) => (
                  <div key={spot.id} className="available-spot-card">
                    {spot.image_url ? (
                      <img src={spot.image_url} alt={spot.title} className="avail-thumb" />
                    ) : (
                      <div className="avail-thumb placeholder">💎</div>
                    )}
                    <div className="avail-info">
                      <h4>{spot.title}</h4>
                      <p>{spot.category} · {spot.description || 'No desc'}</p>
                    </div>
                    <button className="add-to-trip-btn" onClick={() => handleAddSpotToTrip(spot.id)}>
                      + Pin
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <TripInviteModal 
          inviteCode={trip.invite_code} 
          tripName={trip.name} 
          onClose={() => setShowInviteModal(false)} 
        />
      )}

      {showRecapModal && (
        <TripRecapModal 
          trip={{
            ...trip,
            agency_name: agencyBrand ? agencyBrand.company_name : null,
            logo_url: agencyBrand ? agencyBrand.logo_url : null
          }} 
          tripSpots={tripSpots} 
          members={members} 
          votes={votes} 
          onClose={() => setShowRecapModal(false)} 
        />
      )}

      {selectedSpot && (
        <SpotDetailsModal spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
      )}
    </div>
  );
}
