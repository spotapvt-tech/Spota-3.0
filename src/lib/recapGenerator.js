const imageCache = {};

function cacheImage(key, val) {
  if (Object.keys(imageCache).length >= 50) {
    for (const k in imageCache) {
      delete imageCache[k];
    }
  }
  imageCache[key] = val;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

function getWrappedTitleLines(ctx, title, maxWidth) {
  const cleanTitle = title ? String(title).trim() : 'Kasol Group Trip';
  let fontSize = 56;
  ctx.font = `bold ${fontSize}px 'Outfit', sans-serif`;
  let lines = wrapText(ctx, cleanTitle, maxWidth);
  
  const hasOverflow = (lineList) => lineList.some(l => ctx.measureText(l).width > maxWidth);

  if (lines.length > 2 || hasOverflow(lines)) {
    fontSize = 44;
    ctx.font = `bold ${fontSize}px 'Outfit', sans-serif`;
    lines = wrapText(ctx, cleanTitle, maxWidth);
  }
  
  if (lines.length > 2 || hasOverflow(lines)) {
    fontSize = 36;
    ctx.font = `bold ${fontSize}px 'Outfit', sans-serif`;
    lines = wrapText(ctx, cleanTitle, maxWidth);
  }
  
  if (lines.length > 2) {
    lines = lines.slice(0, 2);
    lines[1] = lines[1].substring(0, Math.max(0, lines[1].length - 3)) + '...';
  }

  // Force-truncate any individual word that still overflows 36px
  lines = lines.map(line => {
    let l = line;
    while (l.length > 0 && ctx.measureText(l).width > maxWidth) {
      l = l.slice(0, -1);
    }
    if (l.length < line.length) {
      l = l.substring(0, Math.max(0, l.length - 3)) + '...';
    }
    return l;
  });

  if (lines.length === 0) {
    lines = [''];
  }
  
  return { lines, fontSize };
}

export function drawTripRecapCanvas(canvas, { trip, tripSpots, members, votes }, loadedImages = {}) {
  const ctx = canvas.getContext('2d');
  const w = 1080;
  const h = 1920;

  // 1. Trigger asynchronous loading of cover image if not already cached
  const coverUrl = trip?.cover_image_url;
  if (coverUrl && imageCache[coverUrl] === undefined) {
    cacheImage(coverUrl, 'LOADING');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cacheImage(coverUrl, img);
      drawTripRecapCanvas(canvas, { trip, tripSpots, members, votes }, loadedImages);
    };
    img.onerror = () => {
      console.warn(`Failed to load cover image via CORS: ${coverUrl}`);
      cacheImage(coverUrl, 'FAILED');
      drawTripRecapCanvas(canvas, { trip, tripSpots, members, votes }, loadedImages);
    };
    img.src = coverUrl;
  }

  // Find top spot by votes
  const getSpotVotes = (sId) => {
    if (!votes) return 0;
    return votes.filter(v => v.spot_id === sId).length;
  };
  let topSpot = null;
  let maxVotes = -1;
  tripSpots.forEach(ts => {
    const vCount = getSpotVotes(ts.spot_id || ts.spots?.id);
    if (vCount > maxVotes && ts.spots) {
      maxVotes = vCount;
      topSpot = ts.spots;
    }
  });

  const topSpotUrl = topSpot?.image_url;
  if (topSpotUrl && imageCache[topSpotUrl] === undefined) {
    cacheImage(topSpotUrl, 'LOADING');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cacheImage(topSpotUrl, img);
      drawTripRecapCanvas(canvas, { trip, tripSpots, members, votes }, loadedImages);
    };
    img.onerror = () => {
      console.warn(`Failed to load top spot image via CORS: ${topSpotUrl}`);
      cacheImage(topSpotUrl, 'FAILED');
      drawTripRecapCanvas(canvas, { trip, tripSpots, members, votes }, loadedImages);
    };
    img.src = topSpotUrl;
  }

  // 2. Draw Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#121413'); // Matte dark
  bgGrad.addColorStop(0.5, '#1A231E'); // Deep forest accent
  bgGrad.addColorStop(1, '#0D0E0D');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // 3. Draw Glass Orb Highlights (Ambient light glows)
  // Sage Green Orb (Top Right)
  const sageGlow = ctx.createRadialGradient(850, 300, 50, 850, 300, 450);
  sageGlow.addColorStop(0, 'rgba(108, 140, 116, 0.22)');
  sageGlow.addColorStop(1, 'rgba(108, 140, 116, 0)');
  ctx.fillStyle = sageGlow;
  ctx.beginPath();
  ctx.arc(850, 300, 450, 0, Math.PI * 2);
  ctx.fill();

  // Terracotta Orb (Bottom Left)
  const terraGlow = ctx.createRadialGradient(200, 1500, 50, 200, 1500, 500);
  terraGlow.addColorStop(0, 'rgba(224, 122, 95, 0.18)');
  terraGlow.addColorStop(1, 'rgba(224, 122, 95, 0)');
  ctx.fillStyle = terraGlow;
  ctx.beginPath();
  ctx.arc(200, 1500, 500, 0, Math.PI * 2);
  ctx.fill();

  // 4. Draw Ambient Diagonal Grid Lines (Subtle premium styling)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.lineWidth = 1;
  for (let i = -h; i < w; i += 120) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + h, h);
    ctx.stroke();
  }

  // 5. Header Branding
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = "bold 44px 'Outfit', sans-serif";
  ctx.fillText('💎  S P O T A', w / 2, 180);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = "bold 20px 'Outfit', sans-serif";
  ctx.fillText('T R I P   W R A P P E D   R E C A P', w / 2, 235);

  // 6. Trip Summary Card (Large Box)
  ctx.save();
  const tx = 100, ty = 320, tw = 880, th = 260, tr = 32;
  ctx.beginPath();
  ctx.roundRect(tx, ty, tw, th, tr);
  ctx.clip();

  const coverImg = coverUrl ? imageCache[coverUrl] : null;
  if (coverImg && coverImg !== 'LOADING' && coverImg !== 'FAILED') {
    ctx.drawImage(coverImg, tx, ty, tw, th);
    // Draw dark overlay to make text readable
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(tx, ty, tw, th);
  } else {
    // Beautiful fallback gradient to avoid empty/ugly cards
    const cardGrad = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
    cardGrad.addColorStop(0, '#1A231E'); // deep forest
    cardGrad.addColorStop(1, '#121413');
    ctx.fillStyle = cardGrad;
    ctx.fillRect(tx, ty, tw, th);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(tx, ty, tw, th);
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Trip Summary Text details (Dynamic layouts with line wrapping)
  const titleText = trip.name || 'Kasol Group Trip';
  const maxTitleWidth = tw - 80;
  const { lines: titleLines, fontSize: titleFontSize } = getWrappedTitleLines(ctx, titleText, maxTitleWidth);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';

  let titleY, destY, datesY, avatarY;
  
  if (titleLines.length === 1) {
    titleY = 415;
    destY = 468;
    datesY = 506;
    avatarY = 546;
  } else {
    const lineGap = titleFontSize + 6;
    titleY = 385;
    destY = 385 + lineGap + 44;
    datesY = destY + 34;
    avatarY = datesY + 36;
  }

  ctx.font = `bold ${titleFontSize}px 'Outfit', sans-serif`;
  if (titleLines.length === 1) {
    ctx.fillText(titleLines[0], w / 2, titleY);
  } else {
    ctx.fillText(titleLines[0], w / 2, titleY);
    ctx.fillText(titleLines[1], w / 2, titleY + titleFontSize + 6);
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = "600 26px 'Outfit', sans-serif";
  const destText = trip.destination ? `📍 ${trip.destination}` : '📍 Flexible Destination';
  ctx.fillText(destText, w / 2, destY);

  ctx.fillStyle = 'var(--color-accent, #6C8C74)';
  ctx.font = "600 20px 'Outfit', sans-serif";
  const formatDates = (s, e) => {
    if (!s) return 'Flexible Dates';
    const sDate = new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (!e) return sDate;
    const eDate = new Date(e).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    return `${sDate} - ${eDate}`;
  };
  ctx.fillText(formatDates(trip.start_date, trip.end_date), w / 2, datesY);

  // Overlapping circular avatars row for members inside trip summary card
  if (members && members.length > 0) {
    const avatarRadius = 20;
    const avatarSpacing = 30;
    const totalAvatars = Math.min(members.length, 6);
    const startX = w / 2 - ((totalAvatars - 1) * avatarSpacing) / 2;

    const avatarColors = [
      '#6C8C74', // Sage Green
      '#E07A5F', // Terracotta
      '#DDA15E', // Sand
      '#83C5BE', // Teal
      '#9B5DE5', // Purple
      '#FF6B6B'  // Coral
    ];

    members.slice(0, 6).forEach((member, index) => {
      const username = member.profiles?.username || member.username || 'Explorer';
      const initials = username.substring(0, 2).toUpperCase();
      const col = avatarColors[index % avatarColors.length];

      ctx.save();
      ctx.fillStyle = col;
      ctx.strokeStyle = '#121413';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(startX + index * avatarSpacing, avatarY, avatarRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = "bold 14px 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, startX + index * avatarSpacing, avatarY + 1);
      ctx.restore();
    });

    if (members.length > 6) {
      const badgeX = startX + 6 * avatarSpacing;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.strokeStyle = '#121413';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(badgeX, avatarY, avatarRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = "bold 14px 'Outfit', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`+${members.length - 6}`, badgeX, avatarY + 1);
      ctx.restore();
    }
  }

  // 7. Analytics Stats Grid (4 Cards)
  const drawStatTile = (x, y, label, val, iconCode, isTopSpotTile = false) => {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, 420, 280, 24);
    ctx.clip();

    const spotImg = topSpotUrl ? imageCache[topSpotUrl] : null;
    if (isTopSpotTile && spotImg && spotImg !== 'LOADING' && spotImg !== 'FAILED') {
      ctx.drawImage(spotImg, x, y, 420, 280);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(x, y, 420, 280);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(x, y, 420, 280);
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Icon circle
    ctx.fillStyle = 'rgba(108, 140, 116, 0.15)';
    ctx.beginPath();
    ctx.arc(x + 70, y + 70, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = "32px 'Outfit', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(iconCode, x + 70, y + 80);

    // Label
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = "bold 20px 'Outfit', sans-serif";
    ctx.fillText(label.toUpperCase(), x + 40, y + 160);

    // Value
    ctx.fillStyle = '#FFFFFF';
    ctx.font = "bold 32px 'Outfit', sans-serif";
    ctx.fillText(val, x + 40, y + 225, 340);
    ctx.restore();
  };

  // Calculations
  const totalPinned = tripSpots.length;
  const visitedCount = tripSpots.filter(ts => ts.visited || ts.is_visited).length;
  
  let topSpotName = 'None';
  if (topSpot) {
    topSpotName = topSpot.title;
  }

  const contributorMap = {};
  tripSpots.forEach(ts => {
    if (ts.added_by) {
      contributorMap[ts.added_by] = (contributorMap[ts.added_by] || 0) + 1;
    }
  });
  let topContributorName = 'Explorer';
  let maxAdds = -1;
  Object.keys(contributorMap).forEach(userId => {
    if (contributorMap[userId] > maxAdds) {
      maxAdds = contributorMap[userId];
      const member = members.find(m => m.user_id === userId);
      if (member) {
        topContributorName = member.profiles?.username || member.username || 'Explorer';
      }
    }
  });

  // Draw Grid Tiles (Tile 3 is the top spot tile which loads an image background)
  drawStatTile(100, 640, 'Locations Pinned', `${totalPinned}`, '📍');
  drawStatTile(560, 640, 'Places Visited', `${visitedCount} / ${totalPinned}`, '✅');
  drawStatTile(100, 960, 'Top Voted Spot', topSpotName, '🔥', true);
  drawStatTile(560, 960, 'Top Contributor', topContributorName, '👑');

  // 8. Vibe Profile (Categories Visited)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(100, 1280, 880, 220, 24);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = "bold 20px 'Outfit', sans-serif";
  ctx.fillText('TRIP VIBE PALETTE', 140, 1340);

  // Draw Unique categories visited as inline emoji badges
  const uniqueCategories = [...new Set(tripSpots.map(ts => ts.spots?.category).filter(Boolean))];
  const catEmojis = {
    'cafe': '☕ Cafe',
    'viewpoint': '🌅 View',
    'street-art': '🎨 Art',
    'event': '🎫 Event',
    'trail': '🥾 Trail',
    'campsite': '⛺ Camp',
    'waterfall': '💦 Water',
    'mountain': '🏔️ Peak',
    'beach': '🏖️ Beach',
    'lake': '🌊 Lake',
    'forest': '🌲 Woods',
    'cave': '🕳️ Cave'
  };

  let drawX = 140;
  uniqueCategories.slice(0, 4).forEach((catId) => {
    const label = catEmojis[catId] || '💎 Spot';
    
    // Draw pill background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.font = "bold 22px 'Outfit', sans-serif";
    const textWidth = ctx.measureText(label).width + 30;
    ctx.beginPath();
    ctx.roundRect(drawX, 1370, textWidth, 60, 30);
    ctx.fill();

    // Draw emoji text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, drawX + 15, 1408);

    drawX += textWidth + 20;
  });

  if (uniqueCategories.length === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = "italic 22px 'Outfit', sans-serif";
    ctx.fillText('No spots visited yet to generate vibes.', 140, 1400);
  }

  // 9. Footer Branding QR code
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.beginPath();
  ctx.roundRect(100, 1560, 880, 220, 24);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = "bold 28px 'Outfit', sans-serif";
  if (trip.agency_name) {
    ctx.fillText(`PLANNED BY ${trip.agency_name.toUpperCase()}`, 140, 1640);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = "500 18px 'Outfit', sans-serif";
    ctx.fillText('CURATED COLLABORATIVELY ON SPOTA', 140, 1685);
    ctx.fillStyle = '#8e44ad';
    ctx.font = "bold 16px 'Outfit', sans-serif";
    ctx.fillText('💎 SPOTA VERIFIED PARTNER', 140, 1725);
  } else {
    ctx.fillText('PLAN YOUR NEXT GEM WITH FRIENDS', 140, 1650);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = "500 18px 'Outfit', sans-serif";
    ctx.fillText('DOWNLOAD SPOTA ON IOS & ANDROID', 140, 1690);
  }

  // Mock QR code grid at bottom right of footer card
  const qrX = 800;
  const qrY = 1600;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(qrX, qrY, 130, 130);
  
  ctx.fillStyle = '#121413';
  ctx.fillRect(qrX + 10, qrY + 10, 35, 35);
  ctx.fillRect(qrX + 85, qrY + 10, 35, 35);
  ctx.fillRect(qrX + 10, qrY + 85, 35, 35);
  ctx.fillRect(qrX + 50, qrY + 50, 30, 30);
  ctx.fillRect(qrX + 25, qrY + 60, 15, 15);
  ctx.fillRect(qrX + 65, qrY + 25, 15, 15);
}
