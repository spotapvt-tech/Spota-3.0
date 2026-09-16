import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MapPin, Compass, Share2, Wifi, WifiOff, Download, 
  Sparkles, Users, Smartphone, MessageSquare, 
  Send, Zap, X, AlertCircle, Play, Pause, Trophy
} from 'lucide-react';
import AuthView from './AuthView';
import './LandingView.css';

// Mock spots for the Interactive Map Simulation
const mockSpots = [
  {
    id: 'secret-waterfall',
    title: 'Secret Chho Waterfall',
    category: 'waterfall',
    color: '#6C8C74', // Sage Green
    address: 'Kasol, Himachal Pradesh',
    description: 'A hidden, mystical waterfall tucked away in a pristine pine forest, a 2.5km scenic hike from the main village. Extremely quiet and rejuvenating.',
    lat: 42, lng: 32, // grid percent
    vibes: [
      { name: 'Zen / Quiet', score: 5 },
      { name: 'Cozy / Warm', score: 2 },
      { name: 'Insta-Worthy', score: 4 },
      { name: 'Lively / Buzzing', score: 1 },
      { name: 'Workspace Friendly', score: 1 }
    ],
    reactions: { zen: 84, lit: 12, love: 55, gem: 94 },
    offline: true
  },
  {
    id: 'aesthetic-cafe',
    title: 'The Sage & Pine Cafe',
    category: 'cafe',
    color: '#E07A5F', // Soft Terracotta
    address: 'Old Manali, India',
    description: 'A cozy glassmorphic cafe overlooking the Beas river. Serves organic local tea, features a firepit, and has high-speed WiFi for digital nomads.',
    lat: 68, lng: 62,
    vibes: [
      { name: 'Cozy / Warm', score: 5 },
      { name: 'Insta-Worthy', score: 5 },
      { name: 'Lively / Buzzing', score: 3 },
      { name: 'Zen / Quiet', score: 4 },
      { name: 'Workspace Friendly', score: 5 }
    ],
    reactions: { zen: 32, lit: 45, love: 88, gem: 29 },
    offline: true
  },
  {
    id: 'triund-campsite',
    title: 'Triund Ridge Star Camp',
    category: 'campsite',
    color: '#E0A96D', // Gold
    address: 'Dharamshala, India',
    description: 'A breathtaking ridge campsite under the shadow of the Dhauladhar range. Panoramic mountain views by day, infinite milky way stars by night.',
    lat: 28, lng: 78,
    vibes: [
      { name: 'Insta-Worthy', score: 5 },
      { name: 'Zen / Quiet', score: 3 },
      { name: 'Cozy / Warm', score: 1 },
      { name: 'Lively / Buzzing', score: 4 },
      { name: 'Workspace Friendly', score: 1 }
    ],
    reactions: { zen: 42, lit: 95, love: 120, gem: 110 },
    offline: false // Requires online connection
  }
];

// Mock conversation history for DM Simulator
const initialMockChat = [
  { sender: 'receiver', text: 'Hey Rahul! Are you heading to Spiti Valley next week?' },
  { sender: 'sender', text: 'Yeah! Planning to drop some gems in Kaza and Langza.' },
  { sender: 'receiver', text: 'Awesome. Can you add me to your Collaborative Trip Board?' },
  { sender: 'sender', text: 'Done! Code is SPITI26. Drop the pin, I\'ll check the vibes!' }
];

// Simulated ambient soundtrack tracks
const trackPlaylist = [
  { name: 'Dharamshala Rain', desc: 'Zen rain falling on slate rooftops' },
  { name: 'Parvati Forest Breeze', desc: 'Whispering pine trees and river flow' },
  { name: 'Manali Nomad Fire', desc: 'Crackling firepit with quiet sitar' }
];

export default function LandingView() {
  const [activeTab, setActiveTab] = useState('map'); // map, ar, scratch, chat
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  
  // 1. Map simulator states
  const [selectedGem, setSelectedGem] = useState(mockSpots[0]);
  const [localReactions, setLocalReactions] = useState({});

  // 2. AR simulator states
  const [arHeading, setArHeading] = useState(0); // degrees (-60 to 60)
  const arContainerRef = useRef(null);
  
  // 3. Scratch Card states
  const canvasRef = useRef(null);
  const [isScratched, setIsScratched] = useState(false);
  const [scratchTriggered, setScratchTriggered] = useState(false);

  // 4. Chat simulator states
  const [chatMessages, setChatMessages] = useState(initialMockChat);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatScrollRef = useRef(null);

  // --- Gamification Engines States ---
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelName, setLevelName] = useState('Novice Explorer');
  const [levelUpToast, setLevelUpToast] = useState(null);
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [quests, setQuests] = useState([
    { id: 'offline', text: '📡 Secure off-grid connection (Toggle Offline)', reward: 50, done: false },
    { id: 'react', text: '🧘 Share good energy (React to a Spot)', reward: 40, done: false },
    { id: 'scratch', text: '🎁 Scratch off the Daily Vibe Drop', reward: 60, done: false },
    { id: 'ar', text: '🧭 Orient lenses (Drag to pan the AR view)', reward: 50, done: false },
    { id: 'chat', text: '💬 Connect with creator (Send a DM message)', reward: 50, done: false }
  ]);

  // Canvas particle emitters
  const particlesCanvasRef = useRef(null);

  // --- Zen Ambient Music states ---
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);

  const spawnFloatingTextAt = (x, y, text) => {
    const id = Date.now() + Math.random();
    setFloatingTexts(prev => [...prev, { id, x, y, text }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(t => t.id !== id));
    }, 1200);
  };

  // Confetti Particle Burst Engine
  const triggerCanvasBurst = (centerX, centerY) => {
    const canvas = particlesCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set canvas sizing to window viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#6C8C74', '#E07A5F', '#E0A96D', '#A3B899', '#FFFFFF', '#D1904C'];
    const activeParticles = [];

    // Create 60 glowing spark particles
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 3 + Math.random() * 8;
      activeParticles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 2, // upwards draft
        radius: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.015 + Math.random() * 0.02
      });
    }

    const renderLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let isAlive = false;

      activeParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // simulated gravity drift
        p.alpha -= p.decay;

        if (p.alpha > 0) {
          isAlive = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      if (isAlive) {
        requestAnimationFrame(renderLoop);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    renderLoop();
  };

  // Handle XP increments and level calculations
  const addXp = useCallback((amount) => {
    setXp(prev => {
      const nextXp = prev + amount;
      
      // Calculate levels: Level 1 (0-99 XP), Level 2 (100-199 XP), Level 3 (200+ XP)
      let nextLevel = 1;
      let name = 'Novice Explorer';
      if (nextXp >= 200) {
        nextLevel = 3;
        name = 'Zen Master';
      } else if (nextXp >= 100) {
        nextLevel = 2;
        name = 'Vibe Hunter';
      }

      if (nextLevel > level) {
        setLevel(nextLevel);
        setLevelName(name);
        // Trigger fullscreen level up celebration
        setLevelUpToast(name);
        setTimeout(() => setLevelUpToast(null), 3500);
        
        // Burst particles in the center of the viewport
        setTimeout(() => {
          triggerCanvasBurst(window.innerWidth / 2, window.innerHeight / 2 - 100);
        }, 100);
      }

      return nextXp;
    });
  }, [level]);

  // Quest Completer function
  const completeQuest = useCallback((id) => {
    setQuests(prev => prev.map(q => {
      if (q.id === id && !q.done) {
        // Award quest rewards
        addXp(q.reward);
        
        // Spawn floating indicator for quest completion
        const questBox = document.querySelector('.l-quest-hud');
        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;
        if (questBox) {
          const rect = questBox.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.top + 20;
        }
        spawnFloatingTextAt(x, y, `Quest Complete! +${q.reward} XP 🏆`);
        
        // Trigger small particle burst on Quest HUD
        triggerCanvasBurst(x, y);

        return { ...q, done: true };
      }
      return q;
    }));
  }, [addXp]);

  // RPG style click floating text generator
  const handleXpClick = (e, text, extraXp = 0) => {
    const x = e.clientX;
    const y = e.clientY;
    spawnFloatingTextAt(x, y, text);
    if (extraXp > 0) {
      addXp(extraXp);
    }
  };

  // Handle sharing gem card as retro aesthetic ticket
  const handleDownloadShareCard = (gem) => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 800);
    grad.addColorStop(0, '#121917');
    grad.addColorStop(1, '#232D29');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 800);

    // Decorative grid
    ctx.strokeStyle = 'rgba(108, 140, 116, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 600; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 800);
      ctx.stroke();
    }
    for (let j = 0; j < 800; j += 40) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(600, j);
      ctx.stroke();
    }

    // Glow in center
    const glow = ctx.createRadialGradient(300, 400, 50, 300, 400, 300);
    glow.addColorStop(0, 'rgba(108, 140, 116, 0.15)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(300, 400, 300, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#6C8C74';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 560, 760);
    ctx.strokeStyle = 'rgba(108, 140, 116, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(25, 25, 550, 750);

    // Header Title
    ctx.fillStyle = '#6C8C74';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SPOTA TRAVEL PASS // EXCLUSIVE ENTRY', 300, 60);

    // Ticket Line
    ctx.strokeStyle = 'rgba(108, 140, 116, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 80);
    ctx.lineTo(560, 80);
    ctx.stroke();

    // Spot Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gem.title.toUpperCase(), 300, 150);

    // Category Badge
    const badgeColor = gem.color || '#6C8C74';
    ctx.fillStyle = badgeColor;
    const badgeText = gem.category.toUpperCase();
    ctx.font = 'bold 12px monospace';
    const textWidth = ctx.measureText(badgeText).width;
    const badgeW = textWidth + 24;
    const badgeH = 26;
    const badgeX = 300 - badgeW / 2;
    const badgeY = 180;
    
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    
    ctx.fillStyle = '#121917';
    ctx.fillText(badgeText, 300, badgeY + 17);

    // Address
    ctx.fillStyle = '#9FA3A0';
    ctx.font = '14px monospace';
    ctx.fillText(gem.address, 300, 240);

    // Description Box
    ctx.fillStyle = 'rgba(108, 140, 116, 0.1)';
    ctx.beginPath();
    ctx.roundRect(50, 280, 500, 180, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(108, 140, 116, 0.2)';
    ctx.strokeRect(50, 280, 500, 180);

    ctx.fillStyle = '#E5E7E6';
    ctx.font = 'italic 16px serif';
    const words = gem.description.split(' ');
    let line = '';
    let lineY = 325;
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let testWidth = ctx.measureText(testLine).width;
      if (testWidth > 460 && n > 0) {
        ctx.fillText(line, 300, lineY);
        line = words[n] + ' ';
        lineY += 28;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 300, lineY);

    // Vibe Check Scores
    ctx.fillStyle = '#6C8C74';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('--- ATMOSPHERIC VECTOR VALUES ---', 300, 510);

    let vibeX = 90;
    const vibeWidth = 140;
    gem.vibes.forEach((v, index) => {
      ctx.fillStyle = 'rgba(108, 140, 116, 0.15)';
      ctx.beginPath();
      ctx.roundRect(vibeX + (index * vibeWidth), 530, 120, 70, 6);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '20px Arial';
      ctx.fillText(v.icon, vibeX + (index * vibeWidth) + 60, 560);

      ctx.fillStyle = '#6C8C74';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(v.name.toUpperCase(), vibeX + (index * vibeWidth) + 60, 585);
    });

    // Barcode Simulation
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 40; i++) {
      const w = Math.random() > 0.4 ? 4 : 2;
      ctx.fillRect(180 + (i * 6), 640, w, 40);
    }

    // Footer Text
    ctx.fillStyle = '#9FA3A0';
    ctx.font = '9px monospace';
    ctx.fillText('GENERATE YOUR TICKETS ON SPOTA.APP', 300, 710);
    ctx.fillText('TICKET ID: ' + Math.random().toString(36).substr(2, 9).toUpperCase(), 300, 725);

    // Download logic
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `spota-gem-${gem.id}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Complete offline quest
  useEffect(() => {
    if (isOffline) {
      const timer = setTimeout(() => {
        completeQuest('offline');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOffline, completeQuest]);

  // Complete AR quest when they actually pan the AR viewfinder
  useEffect(() => {
    if (activeTab === 'ar' && Math.abs(arHeading) > 25) {
      const timer = setTimeout(() => {
        completeQuest('ar');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, arHeading, completeQuest]);

  // Complete scratch quest
  useEffect(() => {
    if (isScratched) {
      const timer = setTimeout(() => {
        completeQuest('scratch');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isScratched, completeQuest]);

  // Auto scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  // Simulated typing sequence when Chat simulation is active
  useEffect(() => {
    if (activeTab !== 'chat') return;
    
    // Periodically post mock comments to keep chat dynamic
    const interval = setInterval(() => {
      const extraTexts = [
        "Somiya: Added the Kaza viewpoint! Rating: Insta-Worthy 5, Zen 4.",
        "System: Rahul marked 'Kaza Viewpoint' as Visited.",
        "Somiya: Did you cache the offline zone yet? Rohtang has zero signal.",
        "Rahul: Just saved 25km radius around Langza offline! Caching took 2s."
      ];
      
      const nextMsg = extraTexts[Math.floor(Math.random() * extraTexts.length)];
      
      if (nextMsg.startsWith("System:")) {
        setChatMessages(prev => [...prev, { sender: 'system', text: nextMsg.replace("System: ", "") }]);
      } else {
        const parts = nextMsg.split(": ");
        setChatMessages(prev => [...prev, { 
          sender: parts[0] === 'Rahul' ? 'sender' : 'receiver', 
          text: parts[1] 
        }]);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [activeTab]);

  // AR View Mouse Move Event
  const handleArMouseMove = (e) => {
    if (!arContainerRef.current) return;
    const rect = arContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    // Map mouse position to heading degree from -80 to 80
    const percent = x / width;
    const heading = (percent - 0.5) * 160;
    setArHeading(Math.round(heading));
  };

  // Scratch card canvas draw
  useEffect(() => {
    if (activeTab !== 'scratch' || isScratched) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Draw canvas texture
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#5C7461'); // Rich sage
    grad.addColorStop(0.5, '#7F9983'); 
    grad.addColorStop(1, '#4B5C4E');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Overlay light texture
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 200; i++) {
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
    }

    // Text instructions
    ctx.font = 'bold 15px "Outfit", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('SCRATCH WITH CURSOR', canvas.width / 2, canvas.height / 2 - 12);
    
    ctx.font = '12px "Outfit", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('To Reveal Today\'s Vibe Drop', canvas.width / 2, canvas.height / 2 + 12);
  }, [activeTab, isScratched]);

  const handleScratch = (e) => {
    if (isScratched) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    // Support both mouse and touch
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    if (!clientX) return;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    // Check transparency ratio to trigger full reveal
    if (!scratchTriggered) {
      setScratchTriggered(true);
      setTimeout(() => {
        // Sample pixels to see if scratched enough
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let clearCount = 0;
        for (let i = 3; i < imgData.data.length; i += 80) { // check alpha channels
          if (imgData.data[i] === 0) {
            clearCount++;
          }
        }
        const pct = (clearCount / (imgData.data.length / 80)) * 100;
        if (pct > 30) {
          setIsScratched(true);
        }
        setScratchTriggered(false);
      }, 300);
    }
  };

  const resetScratch = () => {
    setIsScratched(false);
  };

  // Chat input submit
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: 'sender', text: userText }]);
    setChatInput('');
    
    // Complete Chat quest!
    completeQuest('chat');

    // Trigger typing response
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const responses = [
        "That place sounds amazing! Added it to the Spiti Board.",
        "Sweet! I will check the cozy vibe ratings on that.",
        "Nice, downloading the offline zone for that trek as we speak.",
        "Perfect. I'll drop a lit reactions badge on that secret gem!"
      ];
      const answer = responses[Math.floor(Math.random() * responses.length)];
      setChatMessages(prev => [...prev, { sender: 'receiver', text: answer }]);
    }, 1500);
  };

  // Reactions click
  const handleReact = (e, vibe) => {
    const spotId = selectedGem.id;
    const current = localReactions[spotId]?.[vibe] || selectedGem.reactions[vibe];
    setLocalReactions({
      ...localReactions,
      [spotId]: {
        ...(localReactions[spotId] || {}),
        [vibe]: current + 1
      }
    });

    // Award standard interaction XP + click FX
    const reactionsEmojiMap = { zen: '🧘 +1 Zen', lit: '🔥 +1 Lit', love: '❤️ +1 Love', gem: '💎 +1 Gem' };
    handleXpClick(e, `${reactionsEmojiMap[vibe]} (+10 XP)`, 10);
    
    // Complete reactions quest
    completeQuest('react');
  };

  // Soundscape track cycle
  const cycleSoundtrack = (e) => {
    if (!isPlayingMusic) {
      setIsPlayingMusic(true);
      handleXpClick(e, '🔊 Soundscape Active (+15 XP)', 15);
    } else {
      const nextIdx = (trackIndex + 1) % trackPlaylist.length;
      setTrackIndex(nextIdx);
      handleXpClick(e, `🎵 Track: ${trackPlaylist[nextIdx].name}`, 5);
    }
  };

  const toggleMusicState = (e) => {
    e.stopPropagation();
    setIsPlayingMusic(!isPlayingMusic);
    handleXpClick(e, isPlayingMusic ? '🔇 Soundscape Paused' : '🔊 Soundscape Resumed (+10 XP)', isPlayingMusic ? 0 : 10);
  };

  return (
    <div className="landing-wrapper">
      {/* Dynamic particles overlays for level transitions */}
      <canvas ref={particlesCanvasRef} className="l-particles-canvas" />

      {/* Floating click XP labels */}
      {floatingTexts.map(t => (
        <span 
          key={t.id} 
          className="floating-rpg-text"
          style={{ left: `${t.x}px`, top: `${t.y}px` }}
        >
          {t.text}
        </span>
      ))}

      {/* Fullscreen level up notification */}
      {levelUpToast && (
        <div className="l-level-up-toast">
          <div className="l-level-up-title">
            <Trophy size={22} style={{ color: '#E0A96D' }} />
            <span>LEVEL UP! LEVEL {level}</span>
          </div>
          <span className="l-level-up-sub">Rank Unlocked: {levelUpToast}</span>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>
            Your contributions have elevated you! Check your Quest Log.
          </p>
        </div>
      )}

      {/* Floating Zen Ambient Soundscape Player (Bottom-Left) */}
      <div 
        className={`l-ambient-player ${isPlayingMusic ? 'active' : ''}`}
        style={{ position: 'fixed', bottom: '30px', left: '30px', zIndex: 1000, width: '280px', background: 'rgba(18,22,19,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(108,140,116,0.3)', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
        onClick={cycleSoundtrack}
      >
        <div className="l-ambient-left">
          <button 
            className="l-ambient-play-btn"
            onClick={toggleMusicState}
            style={{ width: '28px', height: '28px', minWidth: '28px' }}
          >
            {isPlayingMusic ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <div className="l-ambient-info" style={{ pointerEvents: 'none' }}>
            <span className="l-ambient-station">🧘 Zen Vibe Audio</span>
            <span className="l-ambient-track">{trackPlaylist[trackIndex].name}</span>
          </div>
        </div>

        {/* Equalizer columns */}
        <div className="l-music-bars">
          <div className="l-music-bar"></div>
          <div className="l-music-bar"></div>
          <div className="l-music-bar"></div>
          <div className="l-music-bar"></div>
        </div>
      </div>

      {/* 1. Header Navigation */}
      <header className="l-header">
        <div className="l-logo-container">
          <span className="l-logo-dot"></span>
          <span className="l-logo-text">Spota</span>
        </div>
        <nav className="l-nav">
          <a href="#sandbox" className="l-nav-link">Interactive Play</a>
          <a href="#features" className="l-nav-link">Features</a>
          <a href="#specifications" className="l-nav-link">Row Specs</a>
        </nav>
        <div className="l-header-actions">
          <button className="l-btn-secondary" onClick={() => setShowAuthModal(true)}>Sign In</button>
          <button className="l-btn-primary" onClick={() => setShowAuthModal(true)}>Launch Web App</button>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="l-hero">
        <div className="l-hero-text">
          <span className="l-tagline">💎 Zen-Social Spot Discovery</span>
          <h1 className="l-hero-title">Ditch the tourists. Find the vibe.</h1>
          <p className="l-hero-desc">
            Spota is a zen-social discovery map built for off-beat explorers. Track atmospheric vibes, stream loopable Video Vibes, planning cooperative trips, and discover hidden gems in AR—even with zero cellular signal.
          </p>
          <div className="l-hero-ctas">
            <button className="l-btn-primary" onClick={() => setShowAuthModal(true)}>Start Exploring Free</button>
            <a href="#sandbox" className="l-btn-secondary">Try Demo Sandbox</a>
          </div>
          <div className="l-hero-stats">
            <div className="l-stat-item">
              <span className="l-stat-num">24k+</span>
              <span className="l-stat-lbl">Gems Dropped</span>
            </div>
            <div className="l-stat-item">
              <span className="l-stat-num">98.4%</span>
              <span className="l-stat-lbl">Off-grid Reliability</span>
            </div>
            <div className="l-stat-item">
              <span className="l-stat-num">12+</span>
              <span className="l-stat-lbl">Atmospheric Ranks</span>
            </div>
          </div>
        </div>

        {/* 3D-effect app mockup frame */}
        <div className="l-hero-visual">
          <div className="l-phone-glow"></div>
          <div className="l-phone-frame">
            <div className="l-phone-notch"></div>
            
            {/* Live mockup app layout */}
            <div className="l-mock-app">
              <div className="l-mock-topbar">
                <span className="l-mock-title">💎 Spota Explorer</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {isOffline ? <WifiOff size={14} style={{ color: '#D1904C' }} /> : <Wifi size={14} style={{ color: '#6C8C74' }} />}
                  <span style={{ fontSize: '9px', opacity: 0.6 }}>Kasol, India</span>
                </div>
              </div>
              
              <div className="l-mock-body">
                {/* Offline simulation banner */}
                {isOffline && (
                  <div className="l-sim-offline-banner">
                    <WifiOff size={10} />
                    <span>OFFLINE CACHE: Kasol Zone (47 Spots)</span>
                  </div>
                )}
                
                {/* Switchable Simulated Engines */}

                {/* Engine A: Interactive Map */}
                {activeTab === 'map' && (
                  <div className="l-sim-map-container">
                    <div className="l-sim-map-grid"></div>
                    <div className="l-sim-radar"></div>
                    <div className="l-sim-user-dot"></div>
                    
                    {/* Offline mode toggler inside mockup */}
                    <button 
                      className={`l-sim-offline-btn ${isOffline ? '' : 'active'}`}
                      onClick={() => setIsOffline(!isOffline)}
                    >
                      {isOffline ? 'Go Online' : 'Go Offline'}
                    </button>

                    {/* Interactive Pins */}
                    {mockSpots.map((spot) => {
                      const visible = !isOffline || spot.offline;
                      if (!visible) return null;
                      
                      const isSelected = selectedGem?.id === spot.id;
                      
                      return (
                        <div 
                          key={spot.id}
                          className={`l-sim-pin ${spot.category} ${isSelected ? 'active' : ''} ${spot.id === 'aesthetic-cafe' ? 'trending' : ''}`}
                          style={{ top: `${spot.lat}%`, left: `${spot.lng}%` }}
                          onClick={() => setSelectedGem(spot)}
                        >
                          <div className="l-sim-pin-glow">
                            {spot.category === 'waterfall' && '💎'}
                            {spot.category === 'cafe' && '🔥'}
                            {spot.category === 'campsite' && '⛺'}
                          </div>
                        </div>
                      );
                    })}

                    {/* Spot details modal sheet inside phone */}
                    {selectedGem && (!isOffline || selectedGem.offline) && (
                      <div className="l-sim-sheet">
                        <div className="l-sim-sheet-header">
                          <div>
                            <span className="l-sim-sheet-title">{selectedGem.title}</span>
                            <p style={{ fontSize: '9px', color: '#9FA3A0', marginTop: '2px' }}>{selectedGem.address}</p>
                          </div>
                          <span 
                            className="l-sim-sheet-cat" 
                            style={{ 
                              backgroundColor: `${selectedGem.color}22`, 
                              color: selectedGem.color,
                              border: `1px solid ${selectedGem.color}44` 
                            }}
                          >
                            {selectedGem.category}
                          </span>
                        </div>

                        {/* Simulated Loopable Video Vibe */}
                        <div className="l-sim-video-vibe">
                          <div className="l-sim-video-wave"></div>
                          <div className="l-sim-video-glow-effect"></div>
                          <div className="l-sim-video-tag">
                            <Zap size={9} />
                            <span>15s Video Vibe</span>
                          </div>
                          <div style={{ position: 'absolute', bottom: '8px', left: '8px', zIndex: 10, fontSize: '9px', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>
                            🌌 Ambient video loop active
                          </div>
                        </div>

                        {/* Animated Vibe Spectrum metrics */}
                        <div className="l-sim-vibe-list">
                          {selectedGem.vibes.slice(0, 3).map((v, i) => (
                            <div key={i} className="l-sim-vibe-row">
                              <span className="l-sim-vibe-lbl">{v.name}</span>
                              <div className="l-sim-vibe-bar-bg">
                                <div 
                                  className="l-sim-vibe-bar-fill" 
                                  style={{ 
                                    width: `${(v.score / 5) * 100}%`,
                                    backgroundColor: selectedGem.color 
                                  }}
                                ></div>
                              </div>
                              <span className="l-sim-vibe-score">{v.score}.0</span>
                            </div>
                          ))}
                        </div>

                        {/* Actions: canvas share card download + reactions */}
                        <div className="l-sim-actions">
                          <div className="l-sim-reactions-container">
                            <button className="l-sim-react-btn" onClick={(e) => handleReact(e, 'zen')}>
                              🧘 {localReactions[selectedGem.id]?.zen || selectedGem.reactions.zen}
                            </button>
                            <button className="l-sim-react-btn" onClick={(e) => handleReact(e, 'gem')}>
                              💎 {localReactions[selectedGem.id]?.gem || selectedGem.reactions.gem}
                            </button>
                          </div>
                          <button className="l-sim-download-btn" onClick={() => handleDownloadShareCard(selectedGem)}>
                            <Download size={10} />
                            <span>Share Ticket</span>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Blocked message in Offline Mode */}
                    {isOffline && selectedGem && !selectedGem.offline && (
                      <div className="l-sim-sheet" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '180px', textAlign: 'center', gap: '8px' }}>
                        <AlertCircle size={32} style={{ color: '#D1904C' }} />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>Gem Offline Blocked</span>
                        <p style={{ fontSize: '10px', color: '#9FA3A0', maxWidth: '80%' }}>
                          "{selectedGem.title}" was not cached in the Kasol Zone offline map. Pre-download zones while connected to network.
                        </p>
                        <button className="l-sim-download-btn" style={{ marginTop: '8px' }} onClick={() => setIsOffline(false)}>Go Online to View</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Engine B: AR Compass Explorer */}
                {activeTab === 'ar' && (
                  <div 
                    ref={arContainerRef}
                    className="l-sim-ar-container"
                    onMouseMove={handleArMouseMove}
                  >
                    {/* Panoramic background panning based on heading angle */}
                    <div 
                      className="l-sim-ar-camera-feed"
                      style={{ transform: `translateX(${-arHeading * 1.5}px)` }}
                    ></div>
                    
                    {/* Compass HUD HUD overlay */}
                    <div className="l-sim-ar-overlay">
                      <div className="l-sim-ar-compass-hud">
                        <span className="l-sim-ar-heading">{Math.abs(arHeading)}° {arHeading < 0 ? 'W' : 'E'}</span>
                        <span className="l-sim-ar-direction">Drag mouse to pan camera lenses</span>
                      </div>
                      
                      {/* Floating AR Cards with spatial positions relative to heading */}
                      {[
                        { name: "Triund Summit Peak", dist: "250m", bearing: -20, top: 110, category: 'Viewpoint' },
                        { name: "Aesthetic Sage Cafe", dist: "1.2km", bearing: 25, top: 160, category: 'Food' },
                        { name: "Secret Forest Cascade", dist: "4.8km", bearing: -50, top: 220, category: 'Waterfall' }
                      ].map((card, idx) => {
                        const relativeAngle = card.bearing - arHeading;
                        // Field of view boundaries
                        const inView = relativeAngle > -50 && relativeAngle < 50;
                        if (!inView) return null;
                        
                        const horizontalOffset = 160 + (relativeAngle * 2.8); // width centering math
                        const depthScale = Math.max(0.65, 1 - Math.abs(card.bearing) / 180);
                        
                        return (
                          <div 
                            key={idx}
                            className="l-sim-ar-card"
                            style={{
                              left: `${horizontalOffset - 90}px`,
                              top: `${card.top}px`,
                              transform: `scale(${depthScale}) perspective(600px) rotateY(${relativeAngle * 0.4}deg)`
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="l-sim-ar-card-title">{card.name}</span>
                              <span style={{ fontSize: '8px', color: '#9FA3A0', opacity: 0.8 }}>{card.category}</span>
                            </div>
                            <span className="l-sim-ar-card-dist">📍 {card.dist} nearby</span>
                          </div>
                        );
                      })}

                      {/* Cardinal compass dial wheel */}
                      <div 
                        className="l-sim-ar-compass-wheel"
                        style={{ transform: `rotate(${-arHeading}deg)` }}
                      >
                        <div className="l-sim-ar-compass-arrow"></div>
                        <span className="l-sim-ar-compass-label l-sim-ar-compass-n">N</span>
                        <span className="l-sim-ar-compass-label l-sim-ar-compass-s">S</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Engine C: Scratch Card Drop */}
                {activeTab === 'scratch' && (
                  <div className="l-sim-scratch-container">
                    <div className="l-sim-scratch-card">
                      <div className="l-sim-scratch-result">
                        <div className="l-sim-scratch-image">💧</div>
                        <div>
                          <h4 style={{ fontSize: '15px', fontWeight: '800' }}>Today's Vibe Drop</h4>
                          <span style={{ color: '#E0A96D', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginTop: '2px', display: 'block' }}>
                            ⭐ hidden waterfall
                          </span>
                        </div>
                        <p style={{ fontSize: '11px', color: '#9FA3A0', lineHeight: 1.4 }}>
                          You found the <strong>Kheer Ganga Hot Spring</strong>. Hidden natural thermal baths at the peak of the mountain! 5.0 Cozy & Warm vibes.
                        </p>
                        <button className="l-sim-download-btn" style={{ alignSelf: 'center', marginTop: '6px' }} onClick={resetScratch}>
                          Reset Scratch
                        </button>
                      </div>

                      {/* Interactive holographic silver paint canvas mask */}
                      {!isScratched && (
                        <canvas 
                          ref={canvasRef}
                          width={200}
                          height={320}
                          className="l-sim-scratch-canvas"
                          onMouseMove={handleScratch}
                          onTouchMove={handleScratch}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Engine D: Real-time Live DM Chat */}
                {activeTab === 'chat' && (
                  <div className="l-sim-chat-container">
                    <div className="l-sim-chat-history" ref={chatScrollRef}>
                      {chatMessages.map((msg, i) => (
                        <div 
                          key={i} 
                          className={`l-sim-chat-bubble ${msg.sender}`}
                        >
                          {msg.text}
                        </div>
                      ))}
                      
                      {isTyping && (
                        <div className="l-sim-chat-bubble receiver" style={{ display: 'flex', gap: '4px', padding: '10px 14px' }}>
                          <span className="l-logo-dot animate-pulse" style={{ width: '6px', height: '6px', backgroundColor: '#9FA3A0', boxShadow: 'none' }}></span>
                          <span className="l-logo-dot animate-pulse" style={{ width: '6px', height: '6px', backgroundColor: '#9FA3A0', boxShadow: 'none', animationDelay: '0.2s' }}></span>
                          <span className="l-logo-dot animate-pulse" style={{ width: '6px', height: '6px', backgroundColor: '#9FA3A0', boxShadow: 'none', animationDelay: '0.4s' }}></span>
                        </div>
                      )}
                    </div>
                    
                    {/* Fully interactive text bar where mock bot replies */}
                    <form onSubmit={handleSendChat} className="l-sim-chat-input-bar">
                      <input 
                        type="text" 
                        placeholder="Type message to Rahul..."
                        className="l-sim-chat-input"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                      />
                      <button type="submit" style={{ color: 'var(--l-accent)' }}>
                        <Send size={14} />
                      </button>
                    </form>
                  </div>
                )}
              </div>
              
              {/* Bottom Navigation for Mock App */}
              <div className="l-mock-bottomnav">
                <div 
                  className={`l-mock-navitem ${activeTab === 'map' ? 'active' : ''}`}
                  onClick={() => setActiveTab('map')}
                >
                  <MapPin size={16} />
                  <span>Interactive Map</span>
                </div>
                <div 
                  className={`l-mock-navitem ${activeTab === 'ar' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ar')}
                >
                  <Compass size={16} />
                  <span>AR Camera</span>
                </div>
                <div 
                  className={`l-mock-navitem ${activeTab === 'scratch' ? 'active' : ''}`}
                  onClick={() => setActiveTab('scratch')}
                >
                  <Sparkles size={16} />
                  <span>Daily Drop</span>
                </div>
                <div 
                  className={`l-mock-navitem ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chat')}
                >
                  <MessageSquare size={16} />
                  <span>DMs Chat</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Sandbox Panel controls */}
      <section id="sandbox" className="l-sandbox-section">
        <div className="l-sandbox-intro">
          <h2 className="l-sandbox-title">Explore Spota Features Live</h2>
          <p className="l-sandbox-desc">
            Interact with our simulated mobile sandbox. Toggle between the tabs inside the phone frame or use the control deck below to see how Spota operates.
          </p>
        </div>

        <div className="l-sandbox-layout">
          <div className="l-sandbox-controls">
            <div 
              className={`l-control-card ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              <div className="l-control-icon">
                <MapPin size={20} />
              </div>
              <div className="l-control-text">
                <h3 className="l-control-title">Interactive Zen Map</h3>
                <p className="l-control-desc">
                  Browse spots using category badges. Check atmospheric vectors on slide cards, reactions counts, and click <strong>"Share Ticket"</strong> to generate and download an aesthetic HTML5 Canvas card!
                </p>
              </div>
            </div>

            <div 
              className={`l-control-card ${activeTab === 'ar' ? 'active' : ''}`}
              onClick={() => setActiveTab('ar')}
            >
              <div className="l-control-icon">
                <Compass size={20} />
              </div>
              <div className="l-control-text">
                <h3 className="l-control-title">Spatial AR Camera Explorer</h3>
                <p className="l-control-desc">
                  Simulate real-time camera tracking. Move your mouse cursor across the screen to orient the camera view, rotating the cardinal compass and adjusting floating AR cards in 3D perspective.
                </p>
              </div>
            </div>

            <div 
              className={`l-control-card ${activeTab === 'scratch' ? 'active' : ''}`}
              onClick={() => setActiveTab('scratch')}
            >
              <div className="l-control-icon">
                <Sparkles size={20} />
              </div>
              <div className="l-control-text">
                <h3 className="l-control-title">Daily Vibe Drop Scratch Card</h3>
                <p className="l-control-desc">
                  Scratch off the silver holographic coating using your cursor/touch. Erase more than 40% of the paint layers to trigger an elegant drop reveal of today's recommendation.
                </p>
              </div>
            </div>

            <div 
              className={`l-control-card ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <div className="l-control-icon">
                <MessageSquare size={20} />
              </div>
              <div className="l-control-text">
                <h3 className="l-control-title">Real-Time DM Sync & Chats</h3>
                <p className="l-control-desc">
                  Type a custom message in the chat input inside the phone. A mock bot representing a community contributor will reply to your texts using contextual responses.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Displaying visual indicators for active control tab */}
            <div className="glass-panel" style={{ padding: '32px', borderRadius: '24px', border: '1px solid var(--l-border)' }}>
              <h4 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px', color: '#fff' }}>
                {activeTab === 'map' && "🗺️ Interactive Map Spec"}
                {activeTab === 'ar' && "🧭 Orientation Lenses Spec"}
                {activeTab === 'scratch' && "🎁 Vibe Drops Spec"}
                {activeTab === 'chat' && "💬 Real-Time Chats Spec"}
              </h4>
              <p style={{ color: 'var(--l-text-secondary)', fontSize: '15px', lineHeight: '1.6', marginBottom: '20px' }}>
                {activeTab === 'map' && "Renders floating coordinates, proximity radii (1km - 25km), and maps pins based on current user status. Fully integrated with shareable HTML5 canvases."}
                {activeTab === 'ar' && "Listens to absolute heading sensors (deviceorientation) on native mobile devices. Displays cardinal headers and aligns overlays to actual compass directions."}
                {activeTab === 'scratch' && "Curates off-beat local suggestions based on vibe ratings and tags, giving explorers an interactive reward loop each day."}
                {activeTab === 'chat' && "Bypasses slow message polling using Supabase real-time PostgreSQL replication sockets. Features optimistic updates for lightning-fast speeds."}
              </p>
              <div style={{ borderTop: '1px solid var(--l-border)', paddingTop: '20px' }}>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--l-accent)', fontWeight: '700', letterSpacing: '1px', display: 'block', marginBottom: '12px' }}>
                  Core Tech Stack Used
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {activeTab === 'map' && ["React 19", "React Leaflet", "HTML5 Canvas API", "CartoDB Tiles"].map((tech, idx) => (
                    <span key={idx} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--l-border)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '12px', color: 'var(--l-text-primary)' }}>{tech}</span>
                  ))}
                  {activeTab === 'ar' && ["Orientation Sensors", "WebKit Compass API", "CSS 3D Transforms", "Parallax Depth Engine"].map((tech, idx) => (
                    <span key={idx} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--l-border)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '12px', color: 'var(--l-text-primary)' }}>{tech}</span>
                  ))}
                  {activeTab === 'scratch' && ["HTML5 Canvas 2D Context", "Composite Clip Operations", "Pixel sampling matrix", "Holographic Gradients"].map((tech, idx) => (
                    <span key={idx} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--l-border)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '12px', color: 'var(--l-text-primary)' }}>{tech}</span>
                  ))}
                  {activeTab === 'chat' && ["Supabase Realtime Channel", "Postgres WAL Replication", "Optimistic UI renders", "Capacitor Push Notifications"].map((tech, idx) => (
                    <span key={idx} style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--l-border)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '12px', color: 'var(--l-text-primary)' }}>{tech}</span>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Global product spec summary card */}
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--l-border)' }}>
              <div style={{ backgroundColor: 'rgba(224, 122, 95, 0.15)', color: '#E07A5F', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                <WifiOff size={20} />
              </div>
              <div>
                <h5 style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>Offline Zone Downloads</h5>
                <p style={{ fontSize: '12.5px', color: 'var(--l-text-secondary)', marginTop: '2px' }}>
                  Spota utilizes IndexedDB layers inside Capacitor WebViews to cache full map tiles and images offline, securing travel safety in remote zones.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Features List */}
      <section id="features" className="l-features-section">
        <div className="l-sandbox-intro">
          <span className="l-tagline">🚀 Complete Ecosystem</span>
          <h2 className="l-sandbox-title">Designed for Off-Grid Adventure</h2>
          <p className="l-sandbox-desc">
            Spota replaces cluttered travel spreadsheets and urban-biased apps with a unified discovery system.
          </p>
        </div>

        <div className="l-features-grid">
          <div className="l-feature-card">
            <div className="l-feature-icon"><MapPin size={22} /></div>
            <h3 className="l-feature-title">Atmospheric Vibe Vectors</h3>
            <p className="l-feature-desc">
              Rate spots by atmosphere rather than generic 5-stars: Cozy/Warm, Insta-Worthy, Lively/Buzzing, Zen/Quiet, and Workspace Friendly.
            </p>
          </div>

          <div className="l-feature-card">
            <div className="l-feature-icon"><Compass size={22} /></div>
            <h3 className="l-feature-title">Real-Time DM Sync</h3>
            <p className="l-feature-desc">
              Direct connection with local spot creators. Send questions, coordinate plans, and share maps in real-time through secure channels.
            </p>
          </div>

          <div className="l-feature-card">
            <div className="l-feature-icon"><Smartphone size={22} /></div>
            <h3 className="l-feature-title">15s Loopable Video Vibes</h3>
            <p className="l-feature-desc">
              Verify the vibe instantly. Spot detail modals host quick loopable video clips uploaded directly from users' phones.
            </p>
          </div>

          <div className="l-feature-card">
            <div className="l-feature-icon"><Users size={22} /></div>
            <h3 className="l-feature-title">Collaborative Trip Boards</h3>
            <p className="l-feature-desc">
              Assemble friends via simple 8-digit codes. Co-create shared itineraries, track group visits, and upvote spots collaboratively.
            </p>
          </div>

          <div className="l-feature-card">
            <div className="l-feature-icon"><Zap size={22} /></div>
            <h3 className="l-feature-title">Offline Zone Caching</h3>
            <p className="l-feature-desc">
              One-click geographic radius downloads. Save map tiles, photos, coordinates, and addresses to local cache for off-grid hikes.
            </p>
          </div>

          <div className="l-feature-card">
            <div className="l-feature-icon"><Share2 size={22} /></div>
            <h3 className="l-feature-title">Reputation Achievements</h3>
            <p className="l-feature-desc">
              Earn contribution points. Advance from "Explorer" to "Verified Contributor", unlocking custom playlists and profile badging.
            </p>
          </div>
        </div>
      </section>

      {/* 5. PRD Specifications and Row-Level Security rules */}
      <section id="specifications" className="l-specs-section">
        <div className="l-sandbox-intro" style={{ alignSelf: 'center' }}>
          <span className="l-tagline">⚙️ Engineering Specs</span>
          <h2 className="l-sandbox-title">System Architecture</h2>
        </div>

        <div className="l-specs-layout">
          <div className="l-specs-card">
            <h3 className="l-specs-headline">Database Tables Schema</h3>
            <div className="l-specs-list">
              <div className="l-specs-item">
                <span style={{ color: 'var(--l-accent)', fontWeight: '700' }}>01</span>
                <div>
                  <h4 className="l-specs-item-title">public.profiles</h4>
                  <p className="l-specs-item-desc">Links users to authentication records: username, avatar_url, reputation points, verified tags.</p>
                </div>
              </div>
              <div className="l-specs-item">
                <span style={{ color: 'var(--l-accent)', fontWeight: '700' }}>02</span>
                <div>
                  <h4 className="l-specs-item-title">public.spots</h4>
                  <p className="l-specs-item-desc">Geocoded items containing titles, descriptions, addresses, category, lat/lng float pairs, reactions, video_url.</p>
                </div>
              </div>
              <div className="l-specs-item">
                <span style={{ color: 'var(--l-accent)', fontWeight: '700' }}>03</span>
                <div>
                  <h4 className="l-specs-item-title">public.vibe_ratings</h4>
                  <p className="l-specs-item-desc">Vector check metrics (1-5 scales) of cozy, insta_worthy, lively, zen, and workspace properties.</p>
                </div>
              </div>
              <div className="l-specs-item">
                <span style={{ color: 'var(--l-accent)', fontWeight: '700' }}>04</span>
                <div>
                  <h4 className="l-specs-item-title">public.chats & chat_messages</h4>
                  <p className="l-specs-item-desc">Unique threads pairing participants together. Instantly synchronized via Postgres replication triggers.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="l-specs-card">
            <h3 className="l-specs-headline">Row-Level Security (RLS) Policy</h3>
            <div className="l-specs-list">
              <div className="l-specs-item">
                <span style={{ color: 'var(--l-vibe-cozy)', fontWeight: '700' }}>A</span>
                <div>
                  <h4 className="l-specs-item-title">Spots & Comments Policies</h4>
                  <p className="l-specs-item-desc">Unauthenticated guests can view approved spots/tips and drop new ones. Only the creator can modify or delete posts.</p>
                </div>
              </div>
              <div className="l-specs-item">
                <span style={{ color: 'var(--l-vibe-cozy)', fontWeight: '700' }}>B</span>
                <div>
                  <h4 className="l-specs-item-title">Private Playlist Rules</h4>
                  <p className="l-specs-item-desc">Public playlists are readable globally. Private checklists are viewable and editable only by their author.</p>
                </div>
              </div>
              <div className="l-specs-item">
                <span style={{ color: 'var(--l-vibe-cozy)', fontWeight: '700' }}>C</span>
                <div>
                  <h4 className="l-specs-item-title">Private Chats Privacy</h4>
                  <p className="l-specs-item-desc">Users can only query or insert messages if their auth uuid matches one of the two thread participants.</p>
                </div>
              </div>
              <div className="l-specs-item">
                <span style={{ color: 'var(--l-vibe-cozy)', fontWeight: '700' }}>D</span>
                <div>
                  <h4 className="l-specs-item-title">Trip Boards Cooperation</h4>
                  <p className="l-specs-item-desc">Members assigned to collaborative boards can view maps and mark spots as visited. Only owners can remove board members.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Hero CTA Area */}
      <section className="l-cta-section">
        <div className="l-cta-card">
          <h2 className="l-cta-title">Ready to find your next adventure?</h2>
          <p className="l-cta-desc">
            Join thousands of modern explorers dropping gems in Kasol, Dharamshala, Manali, and beyond. Launch the web app directly or sign up to cache offline maps.
          </p>
          <button className="l-btn-primary" style={{ padding: '16px 40px', fontSize: '16px' }} onClick={() => setShowAuthModal(true)}>
            Open Web App Interface
          </button>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="l-footer">
        <div className="l-footer-top">
          <div className="l-footer-brand">
            <div className="l-logo-container">
              <span className="l-logo-dot"></span>
              <span className="l-logo-text">Spota</span>
            </div>
            <p className="l-footer-motto">
              Zen-social map discovery application. Ditch the tourists, find the vibe. Built for Gen Z explorers.
            </p>
          </div>
          <div className="l-footer-links-grid">
            <div className="l-footer-col">
              <span className="l-footer-col-title">Product</span>
              <div className="l-footer-col-links">
                <a href="#sandbox" className="l-footer-link">Demo Sandbox</a>
                <a href="#features" className="l-footer-link">Core App Features</a>
                <a href="#specifications" className="l-footer-link">System Spec</a>
              </div>
            </div>
            <div className="l-footer-col">
              <span className="l-footer-col-title">Adventure</span>
              <div className="l-footer-col-links">
                <span className="l-footer-link">Kasol Maps</span>
                <span className="l-footer-link">Manali Cafes</span>
                <span className="l-footer-link">Dharamshala Trails</span>
              </div>
            </div>
            <div className="l-footer-col">
              <span className="l-footer-col-title">Tech</span>
              <div className="l-footer-col-links">
                <span className="l-footer-link">React 19 + Vite</span>
                <span className="l-footer-link">Capacitor 8</span>
                <span className="l-footer-link">Supabase DB</span>
              </div>
            </div>
          </div>
        </div>

        <div className="l-footer-bottom">
          <span className="l-copyright">© {new Date().getFullYear()} Spota Inc. All rights reserved.</span>
          <div className="l-footer-socials">
            <span className="l-social-icon">𝕏</span>
            <span className="l-social-icon">📸</span>
            <span className="l-social-icon">🐙</span>
          </div>
        </div>
      </footer>

      {/* Floating Quest HUD Widget — placed after all page content so mobile's
          static/in-flow layout (see .l-quest-hud media query) puts it at the
          bottom of the page instead of ahead of the header/hero. Desktop
          keeps it position:fixed regardless of DOM order. */}
      <div className="l-quest-hud">
        <div className="l-quest-header">
          <span className="l-quest-title">
            <Trophy size={18} style={{ color: '#E0A96D' }} />
            <span>Quest Log</span>
          </span>
          <span className="l-level-tag">{levelName}</span>
        </div>

        {/* XP Section */}
        <div className="l-xp-section">
          <div className="l-xp-info">
            <span>Level {level}</span>
            <span>{xp} / 250 XP</span>
          </div>
          <div className="l-xp-bar-bg">
            <div className="l-xp-bar-fill" style={{ width: `${Math.min(100, (xp / 250) * 100)}%` }}></div>
          </div>
        </div>

        {/* Checklist */}
        <div className="l-quest-list">
          {quests.map(q => (
            <div key={q.id} className={`l-quest-item ${q.done ? 'completed' : ''}`}>
              <div className="l-quest-check">
                {q.done ? '✓' : ''}
              </div>
              <span>{q.text}</span>
              {!q.done && <span className="l-quest-xp-reward">+{q.reward} XP</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 8. Glassmorphic Authentication Modal Overlay */}
      {showAuthModal && (
        <div className="l-modal-overlay">
          <div className="l-modal-container">
            <button className="l-modal-close-btn" onClick={() => setShowAuthModal(false)}>
              <X size={16} />
            </button>
            <AuthView onClose={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
