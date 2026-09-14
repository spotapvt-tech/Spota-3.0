import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { checkBadges } from '../lib/badgeEngine';
import { analyzeImageColor } from '../lib/imageUtils';
import { dropGem } from '../lib/gemService';
import { getSuggestedDescription } from '../lib/gemWizardData';
import { getCategoryById } from '../lib/categoryConfig';

import GemWizardProgress from '../components/GemWizardProgress';
import GemWizardCTA from '../components/GemWizardCTA';
import StepCapture from './steps/StepCapture';
import StepPin from './steps/StepPin';
import StepName from './steps/StepName';
import StepRate from './steps/StepRate';
import StepVibe from './steps/StepVibe';
import StepCelebrate from './steps/StepCelebrate';

import './AddGemView.css';

// Validation: what's needed to advance from each step
function stepValid(step, state) {
  const { photoFile, location, gemName, category, description } = state;
  if (step === 1) return !!photoFile;
  if (step === 2) return !!(location?.lat && location?.lng);
  if (step === 3) return !!(gemName?.trim() && category);
  if (step === 4) return true; // vibe ratings always valid
  if (step === 5) return !!(description?.trim());
  return true;
}

export default function AddGemView() {
  const { user } = useAuth();

  // Wizard navigation
  const [wizardStep, setWizardStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [droppedGem, setDroppedGem] = useState(null);

  // Step 1 — Capture
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFilter, setPhotoFilter] = useState('none');
  const [cameraBase64, setCameraBase64] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  // GPS extracted from image EXIF before canvas compression strips it
  const [photoGps, setPhotoGps] = useState(null); // {lat, lng} | null

  // Step 2 — Pin
  const [location, setLocation] = useState(null);

  // Step 3 — Name
  const [gemName, setGemName] = useState('');
  const [category, setCategory] = useState('cafe');

  // Step 4 — Rate
  const [vibeRatings, setVibeRatings] = useState({
    cozy: 3, insta_worthy: 3, lively: 3, zen: 3, workspace: 3
  });

  // Step 5 — Vibe
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  // Color profile from photo (used for AI suggestions)
  const [colorProfile, setColorProfile] = useState(null);

  // Analyse image color when photo selected → seeds AI descriptions
  useEffect(() => {
    if (!photoPreview) { setColorProfile(null); return; }
    const t = setTimeout(async () => {
      try {
        const profile = await analyzeImageColor(photoPreview);
        setColorProfile(profile);
        // Pre-seed description if empty
        if (!description) {
          setDescription(getSuggestedDescription(category, profile));
        }
      } catch (e) {
        console.warn('Image analysis failed:', e);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoPreview]);

  // Auto-fill title from GPS place name if name is empty
  useEffect(() => {
    if (location?.placeName && !gemName) {
      setGemName(location.placeName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.placeName]);

  const state = { photoFile, location, gemName, category, description };

  const handleNext = () => {
    if (stepValid(wizardStep, state)) setWizardStep(s => s + 1);
  };

  const handleBack = () => setWizardStep(s => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!stepValid(5, state)) return;
    setIsSubmitting(true);
    try {
      const result = await dropGem({
        imageFile: photoFile,
        cameraBase64,
        videoFile,
        location,
        title: gemName.trim(),
        category,
        description: description.trim(),
        tags: selectedTags,
        address: location?.address || '',
        vibeRatings,
        user,
      });

      if (result.offline) {
        setDroppedGem({ title: gemName, category, description, image_url: photoPreview });
      } else {
        setDroppedGem(result.spot || { title: gemName, category, description, image_url: photoPreview });
        // Trigger badge check
        setTimeout(() => { if (user) checkBadges(user); }, 600);
      }
      setWizardStep(6);
    } catch (err) {
      console.error('Drop gem error:', err);
      alert(`Could not drop gem: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareCard = () => {
    if (!droppedGem) return;
    const canvas = document.createElement('canvas');
    canvas.width = 800; canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 1200);
    gradient.addColorStop(0, '#2C3531'); gradient.addColorStop(1, '#111714');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 800, 1200);

    ctx.fillStyle = '#FFFFFF'; ctx.font = "bold 32px 'Outfit', sans-serif";
    ctx.textAlign = 'center'; ctx.fillText('💎 S P O T A', 400, 80);

    const drawDetails = () => {
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left';
      ctx.font = "bold 38px 'Outfit', sans-serif";
      ctx.fillText(droppedGem.title || 'New Gem', 120, 685, 560);

      const catInfo = getCategoryById(droppedGem.category);
      const catText = `${catInfo.emoji} ${catInfo.label}`.toUpperCase();
      ctx.fillStyle = catInfo.color;
      const pillW = ctx.measureText(catText).width + 24;
      ctx.beginPath(); ctx.roundRect(120, 715, pillW, 32, 16); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.font = "bold 13px 'Outfit', sans-serif";
      ctx.fillText(catText, 132, 736);

      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = "italic 20px 'Outfit', sans-serif";
      const words = `"${droppedGem.description || ''}"`.split(' ');
      let line = ''; let lY = 790;
      for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > 520 && line) { ctx.fillText(line, 120, lY); line = word + ' '; lY += 28; }
        else line = test;
      }
      ctx.fillText(line, 120, lY);

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `spota_${(droppedGem.title || 'gem').toLowerCase().replace(/\s+/g,'_')}_card.png`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
      }, 'image/png');
    };

    if (droppedGem.image_url) {
      const img = new Image(); img.crossOrigin = 'anonymous'; img.src = droppedGem.image_url;
      img.onload = () => {
        ctx.save();
        const rx=80,ry=150,rw=640,rh=440,rr=24;
        ctx.beginPath(); ctx.moveTo(rx+rr,ry); ctx.arcTo(rx+rw,ry,rx+rw,ry+rh,rr);
        ctx.arcTo(rx+rw,ry+rh,rx,ry+rh,rr); ctx.arcTo(rx,ry+rh,rx,ry,rr); ctx.arcTo(rx,ry,rx+rw,ry,rr);
        ctx.closePath(); ctx.clip(); ctx.drawImage(img,rx,ry,rw,rh); ctx.restore();
        drawDetails();
      };
      img.onerror = () => { ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(80,150,640,440); drawDetails(); };
    } else {
      ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fillRect(80,150,640,440); drawDetails();
    }
  };

  const handleDropAnother = () => {
    setWizardStep(1);
    setPhotoFile(null); setPhotoPreview(null); setPhotoFilter('none'); setCameraBase64(null);
    setVideoFile(null); setVideoPreview(null);
    setPhotoGps(null);
    setLocation(null);
    setGemName(''); setCategory('cafe');
    setVibeRatings({ cozy:3, insta_worthy:3, lively:3, zen:3, workspace:3 });
    setDescription(''); setSelectedTags([]);
    setColorProfile(null); setDroppedGem(null);
  };

  const stepProps = {
    // Step 1
    photoFile, setPhotoFile, photoPreview, setPhotoPreview,
    photoFilter, setPhotoFilter, cameraBase64, setCameraBase64,
    videoFile, setVideoFile, videoPreview, setVideoPreview,
    onExifGps: setPhotoGps,  // EXIF GPS extracted before canvas compression
    // Step 2
    location, setLocation, photoGps,
    // Step 3
    gemName, setGemName, category, setCategory, colorProfile, description, setDescription,
    // Step 4
    vibeRatings, setVibeRatings,
    // Step 5
    selectedTags, setSelectedTags,
  };

  return (
    <div className="add-gem-wizard-shell">
      {wizardStep <= 5 && (
        <GemWizardProgress currentStep={wizardStep} totalSteps={5} />
      )}

      <div className="wizard-step-content">
        {wizardStep === 1 && <StepCapture {...stepProps} />}
        {wizardStep === 2 && <StepPin {...stepProps} />}
        {wizardStep === 3 && <StepName {...stepProps} />}
        {wizardStep === 4 && <StepRate {...stepProps} />}
        {wizardStep === 5 && <StepVibe {...stepProps} />}
        {wizardStep === 6 && (
          <StepCelebrate
            gem={droppedGem}
            onShareCard={handleShareCard}
            onDropAnother={handleDropAnother}
          />
        )}
      </div>

      {wizardStep <= 5 && (
        <GemWizardCTA
          step={wizardStep}
          onBack={handleBack}
          onNext={handleNext}
          canAdvance={stepValid(wizardStep, state)}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
