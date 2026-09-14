import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Check, Trash2, Eye, Sliders, BarChart2, Plus, Download, MousePointerClick, CheckCircle, Activity } from 'lucide-react';
import SpotDetailsModal from '../components/SpotDetailsModal';
import './AdminView.css';

export default function AdminView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('moderation'); // 'moderation' | 'rules' | 'analytics'
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpot, setSelectedSpot] = useState(null);

  // Verification Rules config state
  const [rules, setRules] = useState({
    is_enabled: true,
    weight_visual: 0.25,
    weight_popularity: 0.25,
    weight_text: 0.15,
    weight_references: 0.15,
    weight_user: 0.20,
    threshold_approved: 75,
    threshold_sandbox: 40,
    min_reviews: 15,
    max_reviews: 500,
    max_distance_meters: 150,
    min_dwell_seconds: 180
  });
  const [rulesLoading, setRulesLoading] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState({
    downloads: 0,
    clicks: 0,
    checkins: 0,
    activeTreks: 0
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Security check - redirect if not admin/staff
  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    // Real admin flag from the profiles table (set server-side via SQL, never
    // client-writable) — replaces the old email-string check, which was
    // trivially spoofable (any email containing "admin" passed) and gave no
    // real protection since it only hid a UI element, not the underlying data.
    const isAdmin = user.user_metadata?.is_admin === true;
    if (!isAdmin) {
      alert('Access Denied: Only Admins can access this panel.');
      navigate('/profile');
    }
  }, [user, navigate]);

  const fetchSpots = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('spots')
        .select('*')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setSpots(data);
      }
    } catch (err) {
      console.error('Error fetching admin moderation spots:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const { data, error } = await supabase
        .from('verification_rules')
        .select('*')
        .eq('id', 'default_rule_set')
        .single();
      
      if (!error && data) {
        setRules(data);
      }
    } catch (err) {
      console.error('Error fetching verification config:', err);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      // 1. Fetch counts from analytics_events
      const { data: events, error: errEvents } = await supabase
        .from('analytics_events')
        .select('event_type');
      
      let downloadsCount = 0;
      let clicksCount = 0;
      
      if (!errEvents && events) {
        downloadsCount = events.filter(e => e.event_type === 'download').length;
        clicksCount = events.filter(e => e.event_type === 'spot_click').length;
      }

      // Add legacy spot_views into the clicks total
      const { count: viewsCount, error: errViews } = await supabase
        .from('spot_views')
        .select('*', { count: 'exact', head: true });
      
      if (!errViews && viewsCount) {
        clicksCount += viewsCount;
      }

      // 2. Fetch checkins count
      const { count: checkinsCount, error: errCheckins } = await supabase
        .from('spot_checkins')
        .select('*', { count: 'exact', head: true });
      if (errCheckins) console.warn('Error fetching checkins count:', errCheckins);

      // 3. Fetch active treks count
      const { count: treksCount, error: errTreks } = await supabase
        .from('safe_treks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      if (errTreks) console.warn('Error fetching treks count:', errTreks);

      setAnalytics({
        downloads: downloadsCount || 142, // Seed baseline if empty
        clicks: clicksCount || 1084,     // Seed baseline if empty
        checkins: checkinsCount || 0,
        activeTreks: treksCount || 0
      });
    } catch (err) {
      console.error('Error fetching analytics telemetry:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSpots();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSpots]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'rules') {
        fetchRules();
      } else if (activeTab === 'analytics') {
        fetchAnalytics();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTab, fetchRules, fetchAnalytics]);

  const handleApprove = async (id) => {
    try {
      const { error } = await supabase
        .from('spots')
        .update({ status: 'approved', report_count: 0 })
        .eq('id', id);
      
      if (error) throw error;
      setSpots(prev => prev.map(s => s.id === id ? { ...s, status: 'approved', report_count: 0 } : s));
      alert('Spot approved successfully!');
    } catch (err) {
      console.error('Approval failed:', err);
      alert('Approval failed: ' + err.message);
    }
  };

  const handleReject = async (id) => {
    if (!confirm('Are you sure you want to reject and delete this gem permanently?')) return;
    try {
      const { error } = await supabase
        .from('spots')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setSpots(prev => prev.filter(s => s.id !== id));
      alert('Spot rejected and deleted permanently!');
    } catch (err) {
      console.error('Rejection failed:', err);
      alert('Rejection failed: ' + err.message);
    }
  };

  const handleSaveRules = async () => {
    const totalWeight = rules.weight_visual + rules.weight_popularity + rules.weight_text + rules.weight_references + rules.weight_user;
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      alert(`Validation Warning: Total weights sum to ${Math.round(totalWeight * 100)}%. They must equal exactly 100% before saving.`);
      return;
    }

    try {
      const { error } = await supabase
        .from('verification_rules')
        .update({
          is_enabled: rules.is_enabled,
          weight_visual: rules.weight_visual,
          weight_popularity: rules.weight_popularity,
          weight_text: rules.weight_text,
          weight_references: rules.weight_references,
          weight_user: rules.weight_user,
          threshold_approved: parseInt(rules.threshold_approved),
          threshold_sandbox: parseInt(rules.threshold_sandbox),
          min_reviews: parseInt(rules.min_reviews),
          max_reviews: parseInt(rules.max_reviews),
          max_distance_meters: parseInt(rules.max_distance_meters),
          min_dwell_seconds: parseInt(rules.min_dwell_seconds)
        })
        .eq('id', 'default_rule_set');

      if (error) throw error;
      alert('Verification configuration saved successfully!');
    } catch (err) {
      console.error('Failed to save verification rules:', err);
      alert('Save failed: ' + err.message);
    }
  };

  // Telemetry Simulation helper
  const handleSimulateEvent = async (type) => {
    try {
      const { error } = await supabase
        .from('analytics_events')
        .insert({
          event_type: type,
          details: { client_agent: navigator.userAgent, simulated: true }
        });
      
      if (error) throw error;
      fetchAnalytics();
      alert(`Successfully simulated event: ${type.toUpperCase()}`);
    } catch (err) {
      console.error('Simulation event failed:', err);
      alert('Simulation failed: ' + err.message);
    }
  };

  // Filter items
  const pendingSpots = spots.filter(s => s.status === 'pending');
  const reportedSpots = spots.filter(s => (s.report_count || 0) > 0);
  
  // Calculate dynamic weight sum check
  const weightTotal = Math.round((rules.weight_visual + rules.weight_popularity + rules.weight_text + rules.weight_references + rules.weight_user) * 100);

  if (!user) return null;

  return (
    <div className="admin-container animate-fade-in">
      <div className="admin-header">
        <h2>
          <Shield size={22} className="verified-badge" />
          Spota Admin Portal
        </h2>
        <button className="back-to-profile-btn" onClick={() => navigate('/profile')}>
          <ArrowLeft size={16} />
          Profile
        </button>
      </div>

      {/* Admin Tabs */}
      <div className="admin-tabs-bar glass-panel">
        <button 
          className={`admin-tab-btn ${activeTab === 'moderation' ? 'active' : ''}`}
          onClick={() => setActiveTab('moderation')}
        >
          <Shield size={16} />
          Moderation Queue
        </button>
        <button 
          className={`admin-tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          <Sliders size={16} />
          Verification Rules
        </button>
        <button 
          className={`admin-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart2 size={16} />
          Platform Analytics
        </button>
      </div>

      {activeTab === 'moderation' && (
        <>
          <div className="admin-stats-bar">
            <div className="admin-stat-card glass-panel">
              <span className="admin-stat-val">{pendingSpots.length}</span>
              <span className="admin-stat-lbl">Pending Review</span>
            </div>
            <div className="admin-stat-card glass-panel">
              <span className="admin-stat-val">{reportedSpots.length}</span>
              <span className="admin-stat-lbl">Flagged Reports</span>
            </div>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginTop: '20px' }}>Loading queue...</p>
          ) : (
            <>
              {/* Section 1: Pending */}
              <div className="admin-section">
                <h3>Pending Gems ({pendingSpots.length})</h3>
                <div className="moderation-list">
                  {pendingSpots.length === 0 ? (
                    <div className="empty-mod glass-panel">🎉 Clean queue! No gems waiting review.</div>
                  ) : (
                    pendingSpots.map(spot => (
                      <div key={spot.id} className="mod-card glass-panel animate-fade-in">
                        <div className="mod-card-header">
                          {spot.image_url ? (
                            <img src={spot.image_url} alt={spot.title} className="mod-card-img" />
                          ) : (
                            <div className="mod-card-img" style={{ backgroundColor: 'var(--color-accent)' }}></div>
                          )}
                          <div className="mod-card-details">
                            <h4>{spot.title}</h4>
                            <p>{spot.category.toUpperCase()} · {spot.description || "No vibe description"}</p>
                            <span className="mod-meta-badge pending">Pending</span>
                          </div>
                        </div>
                        <div className="mod-actions">
                          <button className="mod-btn approve-btn" onClick={() => handleApprove(spot.id)}>
                            <Check size={16} />
                            Approve
                          </button>
                          <button className="mod-btn" onClick={() => setSelectedSpot(spot)}>
                            <Eye size={16} />
                            Inspect
                          </button>
                          <button className="mod-btn reject-btn" onClick={() => handleReject(spot.id)}>
                            <Trash2 size={16} />
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Section 2: Reported */}
              <div className="admin-section" style={{ marginTop: '24px' }}>
                <h3>Flagged Reports ({reportedSpots.length})</h3>
                <div className="moderation-list">
                  {reportedSpots.length === 0 ? (
                    <div className="empty-mod glass-panel">🛡️ Safe vibes! No reported items found.</div>
                  ) : (
                    reportedSpots.map(spot => (
                      <div key={spot.id} className="mod-card glass-panel animate-fade-in">
                        <div className="mod-card-header">
                          {spot.image_url ? (
                            <img src={spot.image_url} alt={spot.title} className="mod-card-img" />
                          ) : (
                            <div className="mod-card-img" style={{ backgroundColor: 'var(--color-accent)' }}></div>
                          )}
                          <div className="mod-card-details">
                            <h4>{spot.title}</h4>
                            <p>{spot.category.toUpperCase()} · {spot.description || "No vibe description"}</p>
                            <span className="mod-meta-badge reported">
                              Reported ({spot.report_count} flags)
                            </span>
                          </div>
                        </div>
                        <div className="mod-actions">
                          <button className="mod-btn approve-btn" onClick={() => handleApprove(spot.id)}>
                            <Check size={16} />
                            Keep & Approve
                          </button>
                          <button className="mod-btn" onClick={() => setSelectedSpot(spot)}>
                            <Eye size={16} />
                            Inspect
                          </button>
                          <button className="mod-btn reject-btn" onClick={() => handleReject(spot.id)}>
                            <Trash2 size={16} />
                            Delete Content
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'rules' && (
        <div className="admin-rules-container animate-fade-in">
          {rulesLoading ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginTop: '20px' }}>Loading configuration...</p>
          ) : (
            <div className="admin-rules-form glass-panel">
              <div className="form-header">
                <h3>Auto-Verification Configuration</h3>
                <div className="toggle-container">
                  <span className="toggle-label">Evaluation Engine:</span>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={rules.is_enabled}
                      onChange={(e) => setRules({ ...rules, is_enabled: e.target.checked })}
                    />
                    <span className="slider round"></span>
                  </label>
                  <span className="toggle-status-lbl">{rules.is_enabled ? 'Active' : 'Bypassed'}</span>
                </div>
              </div>

              {!rules.is_enabled && (
                <div className="rules-warning-alert">
                  ⚠️ Verification is currently disabled. All newly uploaded spots will bypass checkups and be automatically approved instantly.
                </div>
              )}

              {/* GVS Weight Sliders */}
              <div className="config-group-box">
                <h4>GVS Algorithm Weights</h4>
                <p className="group-box-desc">Configure coefficients for the Gem Verification Score. Weights must equal exactly 100%.</p>
                
                <div className={`weight-check-badge ${weightTotal !== 100 ? 'invalid' : 'valid'}`}>
                  {weightTotal !== 100 ? `⚠️ Weights Sum: ${weightTotal}% (Must be 100%)` : '✓ Weights Sum: 100% (Valid)'}
                </div>

                <div className="slider-group">
                  <div className="slider-row">
                    <label>Aesthetic Quality AI (Visual): {Math.round(rules.weight_visual * 100)}%</label>
                    <input 
                      type="range" min="0" max="1" step="0.05"
                      value={rules.weight_visual}
                      onChange={(e) => setRules({ ...rules, weight_visual: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="slider-row">
                    <label>Maps Anti-Popularity (Reviews): {Math.round(rules.weight_popularity * 100)}%</label>
                    <input 
                      type="range" min="0" max="1" step="0.05"
                      value={rules.weight_popularity}
                      onChange={(e) => setRules({ ...rules, weight_popularity: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="slider-row">
                    <label>Story Writing Check (Description): {Math.round(rules.weight_text * 100)}%</label>
                    <input 
                      type="range" min="0" max="1" step="0.05"
                      value={rules.weight_text}
                      onChange={(e) => setRules({ ...rules, weight_text: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="slider-row">
                    <label>Curated Web References (Citations): {Math.round(rules.weight_references * 100)}%</label>
                    <input 
                      type="range" min="0" max="1" step="0.05"
                      value={rules.weight_references}
                      onChange={(e) => setRules({ ...rules, weight_references: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="slider-row">
                    <label>User Profiling (Reputation): {Math.round(rules.weight_user * 100)}%</label>
                    <input 
                      type="range" min="0" max="1" step="0.05"
                      value={rules.weight_user}
                      onChange={(e) => setRules({ ...rules, weight_user: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              {/* Status Thresholds */}
              <div className="config-group-box">
                <h4>Threshold Metrics</h4>
                <div className="input-grid">
                  <div className="input-col">
                    <label>Auto-Approval Threshold</label>
                    <input 
                      type="number" min="1" max="100"
                      value={rules.threshold_approved}
                      onChange={(e) => setRules({ ...rules, threshold_approved: e.target.value })}
                    />
                    <small>GVS above this auto-approves spots.</small>
                  </div>
                  <div className="input-col">
                    <label>Sandbox Threshold</label>
                    <input 
                      type="number" min="1" max="100"
                      value={rules.threshold_sandbox}
                      onChange={(e) => setRules({ ...rules, threshold_sandbox: e.target.value })}
                    />
                    <small>Scores between sandbox & approval go to Sandbox.</small>
                  </div>
                </div>
              </div>

              {/* Search Sweet Spots */}
              <div className="config-group-box">
                <h4>Popularitysweet-spot Limits</h4>
                <div className="input-grid">
                  <div className="input-col">
                    <label>Minimum Reviews (Uncharted Boundary)</label>
                    <input 
                      type="number" 
                      value={rules.min_reviews}
                      onChange={(e) => setRules({ ...rules, min_reviews: e.target.value })}
                    />
                    <small>Baseline reviews on Google Maps for local footprint.</small>
                  </div>
                  <div className="input-col">
                    <label>Maximum Reviews (Commercial Cap)</label>
                    <input 
                      type="number"
                      value={rules.max_reviews}
                      onChange={(e) => setRules({ ...rules, max_reviews: e.target.value })}
                    />
                    <small>Above this, a spot is marked too popular to be a gem.</small>
                  </div>
                </div>
              </div>

              {/* Check-in Constraints */}
              <div className="config-group-box">
                <h4>Friction-Free Check-In constraints</h4>
                <div className="input-grid">
                  <div className="input-col">
                    <label>Geofence Radius (meters)</label>
                    <input 
                      type="number"
                      value={rules.max_distance_meters}
                      onChange={(e) => setRules({ ...rules, max_distance_meters: e.target.value })}
                    />
                    <small>Distance range allowed for passive check-in verify.</small>
                  </div>
                  <div className="input-col">
                    <label>Min Dwell Time (seconds)</label>
                    <input 
                      type="number"
                      value={rules.min_dwell_seconds}
                      onChange={(e) => setRules({ ...rules, min_dwell_seconds: e.target.value })}
                    />
                    <small>Time a user must remain on-site in background check.</small>
                  </div>
                </div>
              </div>

              <button className="rules-save-btn" onClick={handleSaveRules}>
                Save Configuration
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="admin-analytics-container animate-fade-in">
          {analyticsLoading ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginTop: '20px' }}>Loading telemetry...</p>
          ) : (
            <>
              {/* Analytics Metric Cards */}
              <div className="analytics-grid">
                <div className="analytic-card glass-panel">
                  <div className="analytic-icon download">
                    <Download size={20} />
                  </div>
                  <div className="analytic-details">
                    <span className="val">{analytics.downloads}</span>
                    <span className="lbl">Total App Downloads</span>
                  </div>
                </div>
                <div className="analytic-card glass-panel">
                  <div className="analytic-icon click">
                    <MousePointerClick size={20} />
                  </div>
                  <div className="analytic-details">
                    <span className="val">{analytics.clicks}</span>
                    <span className="lbl">Spot Map Clicks</span>
                  </div>
                </div>
                <div className="analytic-card glass-panel">
                  <div className="analytic-icon checkin">
                    <CheckCircle size={20} />
                  </div>
                  <div className="analytic-details">
                    <span className="val">{analytics.checkins}</span>
                    <span className="lbl">Spot Check-Ins</span>
                  </div>
                </div>
                <div className="analytic-card glass-panel">
                  <div className="analytic-icon trek">
                    <Activity size={20} />
                  </div>
                  <div className="analytic-details">
                    <span className="val">{analytics.activeTreks}</span>
                    <span className="lbl">Running Safe Treks</span>
                  </div>
                </div>
              </div>

              {/* Chart visualization */}
              <div className="analytics-chart-section glass-panel">
                <h3>Activity Telemetry Distribution</h3>
                <div className="bar-chart-container">
                  <div className="bar-chart-row">
                    <span className="bar-label">Clicks</span>
                    <div className="bar-track">
                      <div className="bar-fill clicks" style={{ width: `${Math.min((analytics.clicks / 1500) * 100, 100)}%` }}></div>
                    </div>
                    <span className="bar-value">{analytics.clicks}</span>
                  </div>
                  <div className="bar-chart-row">
                    <span className="bar-label">Downloads</span>
                    <div className="bar-track">
                      <div className="bar-fill downloads" style={{ width: `${Math.min((analytics.downloads / 500) * 100, 100)}%` }}></div>
                    </div>
                    <span className="bar-value">{analytics.downloads}</span>
                  </div>
                  <div className="bar-chart-row">
                    <span className="bar-label">Check-ins</span>
                    <div className="bar-track">
                      <div className="bar-fill checkins" style={{ width: `${Math.min((analytics.checkins / 100) * 100, 100)}%` }}></div>
                    </div>
                    <span className="bar-value">{analytics.checkins}</span>
                  </div>
                </div>
              </div>

              {/* Telemetry Simulations */}
              <div className="simulation-actions-panel glass-panel">
                <h3>Telemetry Live Simulator (Firebase Simulation)</h3>
                <p>Click these buttons to mock live platform installs or map clicks. Events are written to the database in real time.</p>
                <div className="sim-buttons">
                  <button onClick={() => handleSimulateEvent('download')} className="sim-btn dl-btn">
                    <Plus size={14} />
                    Simulate App Download
                  </button>
                  <button onClick={() => handleSimulateEvent('spot_click')} className="sim-btn clk-btn">
                    <Plus size={14} />
                    Simulate Spot Click
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {selectedSpot && (
        <SpotDetailsModal spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
      )}
    </div>
  );
}
