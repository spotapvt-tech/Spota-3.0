// Image utilities — color analysis and compression
// Extracted from AddGemView.jsx (v2.0 wizard refactor)

export const analyzeImageColor = (imageSrc) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 10;
        canvas.height = 10;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve({ brightness: 'neutral', dominant: 'neutral' }); return; }
        ctx.drawImage(img, 0, 0, 10, 10);
        const imgData = ctx.getImageData(0, 0, 10, 10).data;

        let totalR = 0, totalG = 0, totalB = 0, pixelCount = 0;
        for (let i = 0; i < imgData.length; i += 4) {
          totalR += imgData[i]; totalG += imgData[i+1]; totalB += imgData[i+2]; pixelCount++;
        }
        const avgR = totalR / pixelCount;
        const avgG = totalG / pixelCount;
        const avgB = totalB / pixelCount;
        const brightness = (avgR * 299 + avgG * 587 + avgB * 114) / 1000;

        let dominant = 'neutral';
        if (avgG > avgR + 10 && avgG > avgB + 10) dominant = 'green';
        else if (avgB > avgR + 10 && avgB > avgG + 10) dominant = 'blue';
        else if (avgR > avgG + 10 && avgR > avgB + 10) {
          dominant = (avgR > 170 && avgG < 140) ? 'sunset' : 'warm';
        }

        let brightnessType = 'neutral';
        if (brightness < 70) brightnessType = 'dark';
        else if (brightness > 190) brightnessType = 'bright';

        resolve({ brightness: brightnessType, dominant });
      } catch (err) {
        console.warn('Canvas image analysis failed:', err);
        resolve({ brightness: 'neutral', dominant: 'neutral' });
      }
    };
    img.onerror = () => resolve({ brightness: 'neutral', dominant: 'neutral' });
    img.src = imageSrc;
  });
};

export const compressImage = (file) => {
  return new Promise((resolve) => {
    if (file.size < 300 * 1024) { resolve(file); return; }

    const timeoutId = setTimeout(() => {
      console.warn('Image compression timed out, resolving with original file');
      resolve(file);
    }, 3000);

    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = objectUrl;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX = 800;
          let w = img.width, h = img.height;
          if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
          else { if (h > MAX) { w *= MAX / h; h = MAX; } }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);

          canvas.toBlob((blob) => {
            try {
              clearTimeout(timeoutId);
              URL.revokeObjectURL(objectUrl);
              if (!blob) { resolve(file); return; }
              const baseName = (file.name || `image-${Date.now()}`).replace(/\.[^/.]+$/, '');
              const fileName = baseName + '.jpg';
              let out;
              try { out = new File([blob], fileName, { type: 'image/jpeg' }); }
              catch { out = blob; out.name = fileName; }
              resolve(out);
            } catch (e) { clearTimeout(timeoutId); resolve(file); }
          }, 'image/jpeg', 0.6);
        } catch (e) { clearTimeout(timeoutId); URL.revokeObjectURL(objectUrl); resolve(file); }
      };
      img.onerror = () => { clearTimeout(timeoutId); URL.revokeObjectURL(objectUrl); resolve(file); };
    } catch (e) { clearTimeout(timeoutId); resolve(file); }
  });
};

export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    } catch (err) { reject(err); }
  });
};
