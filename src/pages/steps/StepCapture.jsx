import { useRef } from 'react';
import { Camera, UploadCloud, X, Video } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { compressImage } from '../../lib/imageUtils';
import { extractExifGps } from '../../lib/exifUtils';
import './StepCapture.css';

const FILTERS = [
  { id: 'none',   label: '✦ Original',  css: 'none' },
  { id: 'warm',   label: '🌅 Warm',     css: 'sepia(0.35) saturate(1.4) brightness(1.05)' },
  { id: 'moody',  label: '🌙 Moody',    css: 'brightness(0.82) contrast(1.15) saturate(0.8)' },
  { id: 'bright', label: '✨ Bright',   css: 'brightness(1.18) saturate(1.3)' },
  { id: 'nature', label: '🌿 Natural',  css: 'hue-rotate(10deg) saturate(1.2)' },
];

export default function StepCapture({
  photoPreview, setPhotoPreview,
  photoFile, setPhotoFile,
  photoFilter, setPhotoFilter,
  cameraBase64, setCameraBase64,
  videoFile, setVideoFile,
  videoPreview, setVideoPreview,
  onExifGps,   // (coords: {lat,lng} | null) => void — called after EXIF parse
}) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const videoRef = useRef(null);

  const filterCss = FILTERS.find(f => f.id === photoFilter)?.css || 'none';

  const handleFileSelect = async (file) => {
    if (!file) return;

    // ① Extract GPS FIRST from the original file — canvas compression strips EXIF
    extractExifGps(file).then(coords => {
      onExifGps?.(coords); // null if no GPS found; caller resets photoGps accordingly
    });

    // ② Compress (canvas strips EXIF — intentional for privacy)
    const compressed = await compressImage(file);
    setPhotoFile(compressed);
    const url = URL.createObjectURL(compressed);
    setPhotoPreview(url);
    setCameraBase64(null);
  };

  const triggerCamera = () => {
    if (Capacitor.isNativePlatform()) {
      takeNativePhoto(CameraSource.Camera);
    } else {
      cameraRef.current?.click();
    }
  };

  const triggerGallery = () => {
    if (Capacitor.isNativePlatform()) {
      takeNativePhoto(CameraSource.Photos);
    } else {
      galleryRef.current?.click();
    }
  };

  const takeNativePhoto = async (source) => {
    try {
      const perms = await CapCamera.requestPermissions({
        permissions: source === CameraSource.Camera ? ['camera'] : ['photos']
      });
      const key = source === CameraSource.Camera ? 'camera' : 'photos';
      if (perms[key] === 'denied') {
        alert('Permission denied. Please enable in device settings.');
        return;
      }
      const photo = await CapCamera.getPhoto({
        quality: 60, width: 800, height: 800,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source
      });
      if (photo?.base64String) {
        const clean = photo.base64String.replace(/[\s\r\n]+/g, '');
        setCameraBase64(clean);
        const fmt = photo.format || 'jpeg';
        const mime = `image/${fmt === 'jpg' ? 'jpeg' : fmt}`;
        const dataUrl = `data:${mime};base64,${clean}`;
        // Convert to blob for file state
        const byteChars = atob(clean);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        blob.name = `camera-${Date.now()}.${fmt}`;
        setPhotoFile(blob);
        setPhotoPreview(dataUrl);
      }
    } catch (err) {
      const msg = err?.message || String(err);
      if (!msg.includes('cancelled') && msg !== 'User cancelled photos app') {
        alert(`Camera error: ${msg}`);
      }
    }
  };

  const removePhoto = () => {
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setCameraBase64(null);
    setPhotoFilter('none');
    onExifGps?.(null); // reset any previously extracted GPS
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert('Video must be under 20MB.');
      return;
    }
    if (videoPreview?.startsWith('blob:')) URL.revokeObjectURL(videoPreview);
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const removeVideo = () => {
    if (videoPreview?.startsWith('blob:')) URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview(null);
  };

  return (
    <div className="step-capture wizard-step">
      <div className="step-header">
        <h2>Capture the Vibe 📸</h2>
        <p>Lead with a photo — it's the heart of your gem.</p>
      </div>

      {/* Photo area */}
      {!photoPreview ? (
        <div className="capture-zone">
          <button type="button" className="capture-btn primary" onClick={triggerCamera}>
            <Camera size={28} />
            <span>Take Photo</span>
          </button>
          <button type="button" className="capture-btn secondary" onClick={triggerGallery}>
            <UploadCloud size={22} />
            <span>Upload from Gallery</span>
          </button>
          <input type="file" accept="image/*" capture="environment" ref={cameraRef}
            onChange={(e) => handleFileSelect(e.target.files?.[0])} style={{ display: 'none' }} />
          <input type="file" accept="image/*" ref={galleryRef}
            onChange={(e) => handleFileSelect(e.target.files?.[0])} style={{ display: 'none' }} />
        </div>
      ) : (
        <div className="capture-preview-wrap">
          <img
            src={photoPreview}
            alt="Preview"
            className="capture-preview-img"
            style={{ filter: filterCss }}
          />
          <button type="button" className="capture-remove-btn" onClick={removePhoto} aria-label="Remove">
            <X size={18} />
          </button>
          <div className="capture-retake-row">
            <button type="button" className="capture-retake-btn" onClick={triggerCamera}>
              <Camera size={14} /> Retake
            </button>
          </div>
        </div>
      )}

      {/* Filter chips */}
      {photoPreview && (
        <div className="capture-filters">
          <span className="capture-filters-label">Quick Filter</span>
          <div className="capture-filter-chips">
            {FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                className={`filter-chip ${photoFilter === f.id ? 'active' : ''}`}
                onClick={() => setPhotoFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Video clip — optional */}
      <div className="capture-video-section">
        <span className="capture-video-label">🎥 Optional video clip (≤20s)</span>
        {!videoPreview ? (
          <button type="button" className="capture-btn tertiary" onClick={() => videoRef.current?.click()}>
            <Video size={18} /> Add Video Vibe
          </button>
        ) : (
          <div className="capture-preview-wrap">
            <video src={videoPreview} controls className="capture-preview-img" />
            <button type="button" className="capture-remove-btn" onClick={removeVideo} aria-label="Remove video">
              <X size={16} />
            </button>
          </div>
        )}
        <input type="file" accept="video/*" ref={videoRef} onChange={handleVideoSelect} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
