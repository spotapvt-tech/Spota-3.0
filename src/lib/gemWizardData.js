// Gem Wizard shared data — AI suggestions, tag maps, and vibe presets
// Extracted from AddGemView.jsx (v2.0 wizard refactor)

export const AI_SUGGESTIONS_MAP = {
  cafe: {
    warm: "A super cozy, indie-lit escape with rustic cane furniture, retro Bollywood vinyls, and a chill work-from-cafe setup. Perfect for sipping a hot cutting chai or a slow pour-over. ☕️🎶",
    bright: "A gorgeous, sun-drenched minimalist cafe with clean white walls and aesthetic monsteras. Super grid-worthy corners, amazing matcha, and absolute main character energy! 🍵✨",
    dark: "A low-lit, moody coffee lounge with dark wood vibes and a jazz playlist. Perfect for late-night deep talks or winding down with a smooth cold brew. ☕️🌙",
    neutral: "A hidden gem cafe with an incredible espresso bar, cozy corners, and a super welcoming local community feel. ☕️🍃"
  },
  'street-art': {
    bright: "A vibrant, larger-than-life wall mural exploding with color. Absolutely transforms the alleyway and demands a spot on your main feed! 🎨✨",
    dark: "Gritty, moody street graffiti tucked away in an industrial alley. It has that raw, underground indie vibe that feels like a secret portal. 🌆🎨",
    neutral: "A beautiful, unexpected piece of local street art that adds a splash of color and storytelling to the neighborhood walk. 🎨🖌️"
  },
  event: {
    warm: "A buzzing local popup flea market filled with hand-poured candles, thrift racks, and acoustic live sessions. The crowd vibe is immaculate. 🎫✨",
    neutral: "A cool indie event highlighting local makers, street food stalls, and creative energy. Grab your crew and explore! 🎪🍢"
  },
  viewpoint: {
    sunset: "An absolute front-row seat to the legendary coastal golden hour. Warm pink and golden gradients spreading over the endless sea skyline. Breathtaking. 🌅🧡",
    blue: "A high-altitude vantage point offering panoramic blue sky views. The horizon feels infinite and the breeze is pure peace. 🌊☁️",
    neutral: "An incredible lookout spot to watch the city lights or the natural horizon. The perfect place to hit pause and take in the view. 📍🏔️"
  },
  trail: {
    green: "A lush, green canopy pathway winding through the trees. Surrounded by birdsong and the fresh, grounding scent of rain on soil. 🌲🥾",
    neutral: "A rugged, scenic trekking trail offering a raw connection with the outdoors. Grounding, fresh, and beautiful at every turn. 🥾🍂"
  },
  waterfall: {
    blue: "A hidden pool of cascading mountain water, shimmering in deep turquoise and blue shades. The air is crisp, misty, and carries a gentle roar. 💦🌀",
    neutral: "A breathtaking waterfall hidden behind a wall of green foliage. The cool mist and steady rush of water make it a perfect place to recharge. 🌊⛰️"
  },
  campsite: {
    dark: "A secluded pitch under a breathtaking starry night sky, far away from city glow. Absolute peace with nothing but the crackle of a campfire. ⛺️🔥✨",
    green: "A peaceful forest camp site nestled in a quiet clearing. Waking up to fresh pine breeze and morning mist. 🌲🏕️",
    neutral: "A dream wilderness camping spot surrounded by nature's sounds. Remote, peaceful, and perfect for stargazing. ⛺️🌌"
  },
  mountain: {
    neutral: "Standing tall against the clouds, this summit spot offers crisp alpine air and majestic peaks that make you feel tiny. 🏔️❄️"
  },
  beach: {
    sunset: "A sandy escape where the waves meet the gold hour. Perfect for a sunset stroll, a sea breeze detox, or an evening bonfire. 🏖️🌊"
  },
  lake: {
    neutral: "A glassy, peaceful lake mirroring the sky. Ideal for a quiet kayak session or sitting by the banks with a notebook. 🌊🛶"
  },
  forest: {
    neutral: "A mystical, quiet woodland sanctuary. Grounding canopy shadows and old trees that make you forget the city noise. 🌲👣"
  },
  cave: {
    neutral: "A cool, underground adventure spot. The air is damp, the shadows are deep, and it feels like exploring a different world. 🕳️🦇"
  },
  default: "A magical hidden gem tucked away from the main trails. Incredible atmosphere, positive vibes, and a must-visit for any traveller looking for a unique spot! 💎✨"
};

export const RECOMMENDED_TAGS_MAP = {
  cafe: ['matcha', 'wifi', 'workspace', 'brunch', 'aesthetic', 'cozy', 'vinyl', 'pastries', 'cutting_chai', 'bun_maska', 'aesthetic_lighting', 'indie_music', 'retro'],
  viewpoint: ['sunset', 'sunrise', 'citylights', 'panorama', 'goldenhour', 'scenic', 'peaceful', 'marine_drive', 'skyline', 'bandstand', 'sunset_spot'],
  'street-art': ['murals', 'graffiti', 'indie', 'neon', 'aesthetic', 'colorful', 'hiddenalley', 'insta_worthy', 'bandra_murals', 'delhi_streetart', 'wall_art', 'mural_walk'],
  event: ['livemusic', 'popupshop', 'vibes', 'social', 'nightlife', 'indie', 'market', 'festival', 'flea_market', 'dilli_haat', 'thrift_finds', 'indie_gigs'],
  trail: ['trek', 'hiking', 'forestbath', 'nature', 'summit', 'scenic', 'adventure'],
  campsite: ['stargazing', 'campfire', 'secluded', 'wilderness', 'outdoor', 'hammock', 'peaceful'],
  waterfall: ['misty', 'refreshing', 'hike', 'nature', 'swimming', 'hidden', 'photogenic'],
  mountain: ['summit', 'snow', 'climbing', 'views', 'cold', 'alpine', 'adventure'],
  beach: ['sunset', 'sandy', 'waves', 'surfing', 'sunbathing', 'bonfire', 'coastal'],
  lake: ['paddleboarding', 'kayaking', 'peaceful', 'reflection', 'swimming', 'cabinvibes'],
  forest: ['pine', 'greenery', 'foraging', 'birds', 'shade', 'mystical', 'quiet'],
  cave: ['underground', 'exploring', 'stalactites', 'cool_air', 'dark', 'adventure'],
  default: ['aesthetic', 'hiddengem', 'localspot', 'peaceful', 'photogenic']
};

export const VIBE_PRESETS = {
  work_cafe: {
    label: 'Work Cafe',
    emoji: '💻',
    ratings: { cozy: 4, insta_worthy: 3, lively: 2, zen: 4, workspace: 5 }
  },
  social_hub: {
    label: 'Social Hub',
    emoji: '🤝',
    ratings: { cozy: 3, insta_worthy: 4, lively: 5, zen: 2, workspace: 2 }
  },
  insta_spot: {
    label: 'Insta Spot',
    emoji: '📸',
    ratings: { cozy: 3, insta_worthy: 5, lively: 4, zen: 2, workspace: 2 }
  },
  zen_escape: {
    label: 'Zen Escape',
    emoji: '🧘',
    ratings: { cozy: 5, insta_worthy: 4, lively: 1, zen: 5, workspace: 3 }
  }
};

// Emoji options for each vibe dimension (index 0–4 maps to score 1–5)
export const VIBE_EMOJI_MAP = {
  cozy:        ['🥶', '😐', '😊', '🥰', '🧸'],
  insta_worthy:['🥱', '😐', '📐', '✨', '🤩'],
  lively:      ['🤫', '😶', '😌', '🤝', '⚡'],
  zen:         ['📢', '😤', '😌', '🍃', '🧘'],
  workspace:   ['🚫', '😕', '☕', '💻', '🎒']
};

export const VIBE_LABELS = {
  cozy: ['Cold / Drafty 🥶', 'Chilly 🌬️', 'Decent', 'Comfy 😊', 'Super Warm & Snuggly 🧸'],
  insta_worthy: ['Basic / Bland 🥱', 'Average', 'Nice Angle 📐', 'Aesthetic ✨', 'Visual Masterpiece 📸'],
  lively: ['Ghost Town 🤫', 'Quiet / Chill', 'Social / Cool 🤝', 'Buzzing', 'Electric Energy 🔥'],
  zen: ['Loud / Chaotic 📢', 'Noisy', 'Relaxed', 'Peaceful 🍃', 'Dead Silent Sanctuary 🧘'],
  workspace: ['No Power/Wifi 🔌', 'Hard Seats', 'Decent Coffee ☕', 'Great Desk 💻', 'Nomad Heaven 🎒']
};

export function getSuggestedDescription(category, profile) {
  if (!profile) return AI_SUGGESTIONS_MAP.default;
  const cat = category || 'default';
  const dominant = profile.dominant || 'neutral';
  const brightness = profile.brightness || 'neutral';

  let desc = null;
  if (AI_SUGGESTIONS_MAP[cat]) {
    desc = AI_SUGGESTIONS_MAP[cat][dominant]
      || AI_SUGGESTIONS_MAP[cat][brightness]
      || AI_SUGGESTIONS_MAP[cat].neutral
      || null;
  }
  return desc || AI_SUGGESTIONS_MAP.default;
}
