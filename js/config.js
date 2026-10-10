/**
 * Site configuration — edit this file to rebrand the site or update property data.
 *
 * Anything set to `null` is rendered as a clearly marked "To be confirmed"
 * placeholder. Do not fill these with estimates: only verified data belongs here.
 */

export const PROPERTY = {
  // Temporary name — no brand was supplied. Change it here; it updates everywhere.
  name: 'The Aurelia Residence',
  shortName: 'Aurelia',
  tagline: 'Designed around space, light and modern elegance.',

  // Verified specifications. `null` = placeholder shown as "To be confirmed".
  specs: {
    price: null,          // e.g. '£2,450,000'
    bedrooms: null,       // e.g. 4
    bathrooms: null,      // e.g. 3
    receptionRooms: null, // e.g. 2
    landArea: null,       // e.g. '0.4 acres (1,620 m²)'
    builtUpArea: null,    // e.g. '3,850 sq ft (358 m²)'
    parking: null,        // e.g. 'Integral double garage'
    tenure: null,         // e.g. 'Freehold'
    yearBuilt: null,      // e.g. 2024
    energyRating: null,   // e.g. 'B'
  },

  // Free-text overview. Leave `null` to show a placeholder paragraph.
  overview: null,

  // Features that are VISIBLE in the supplied film. They describe what is seen on
  // screen, not verified specifications, and are labelled that way on the page.
  // `image` is the still shown when the row is hovered.
  observedFeatures: [
    { title: 'Landscaped front garden', note: 'Stone pathway, lawns and planted borders', image: 'garden' },
    { title: 'Pivot front door', note: 'Full-height timber entrance with glazed sidelights', image: 'entrance' },
    { title: 'Open-plan living & dining', note: 'Floor-to-ceiling glazing to the garden', image: 'living' },
    { title: 'Marble kitchen island', note: 'Walnut cabinetry and integrated appliances', image: 'kitchen' },
    { title: 'Glass-balustrade staircase', note: 'Illuminated treads to the upper floor', image: 'staircase' },
    { title: 'Master suite', note: 'Full-height glazing and timber detailing', image: 'bedroom' },
    { title: 'Marble bathroom', note: 'Freestanding bath and twin vanity', image: 'bathroom' },
    { title: 'Private balcony', note: 'Glass balustrade overlooking the garden', image: 'balcony' },
  ],

  // Confirmed amenities (e.g. 'Underfloor heating'). Empty = placeholder.
  amenities: [],

  // Floor plans: [{ label: 'Ground floor', src: 'assets/images/plans/ground.svg' }]
  floorPlans: [],

  // Location. When `address` is set, a map embed is shown (uses `mapQuery` or the address).
  location: {
    address: null,  // e.g. '12 Example Lane, Town, AB1 2CD'
    mapQuery: null, // optional custom query for the map embed
    notes: null,    // e.g. 'Ten minutes from the village centre'
  },

  contact: {
    agent: null,    // e.g. 'Jane Smith, Sales Director'
    phone: null,    // e.g. '+44 20 0000 0000'
    email: null,    // e.g. 'viewings@example.com'
  },

  enquiry: {
    // POST endpoint that receives JSON enquiries (e.g. Formspree or your own API).
    // While `null`, the form validates input but tells the visitor it is not yet connected.
    endpoint: null,
  },

  // Optional real 3D model (GLB/GLTF). See assets/models/README.md.
  model: {
    url: null, // e.g. 'assets/models/residence.glb'
  },
};

/**
 * Media for the tour. The site picks the 720p file on small screens or when the
 * visitor has Save-Data enabled. Both are generated from realestate.mp4 by
 * tools/optimize-video.ps1 (keyframe every 6 frames for smooth scrubbing).
 */
export const MEDIA = {
  sources: [
    { src: 'assets/video/tour-1080.mp4', minWidth: 900 },
    { src: 'assets/video/tour-720.mp4', minWidth: 0 },
  ],
  // Last usable time in the encoded tour (the source cuts to a different house at 34.95 s).
  duration: 34.85,
  poster: 'assets/images/poster.jpg',
  // Final reveal: a still of the SAME bungalow from the opening shot.
  finalStill: 'facade',
};

/** Height of the scroll-scrubbed section, in viewport heights. */
export const TOUR_LENGTH_VH = { desktop: 1100, mobile: 900 };

/**
 * Scene map, verified against the footage frame by frame.
 *  - time:   [start, end] in seconds of the encoded tour video.
 *  - scroll: [start, end] as a fraction (0–1) of the tour section's scroll distance.
 *            Video time is interpolated linearly inside each scene's scroll range.
 *  - still:  frame shown in reduced-motion / fallback mode.
 *  - card / blurb: used by the "Room by room" carousel.
 *
 * Observed transitions: front door dissolve ≈ 9.1 s, kitchen → staircase dissolve
 * ≈ 18.2 s, bedroom → bathroom dissolve ≈ 27.3 s, bathroom → suite ≈ 30.6 s,
 * balcony until 34.9 s (then a different house — excluded).
 */
export const SCENES = [
  {
    id: 'arrival', label: 'Arrival', kicker: 'The Arrival',
    title: 'A Different Way to Live.',
    subtitle: 'Discover a residence designed around space, light and modern elegance.',
    time: [0, 7.6], scroll: [0, 0.18], still: 'arrival',
    card: 'facade', blurb: 'A stone path through landscaped lawns leads to the front door.',
  },
  {
    id: 'entrance', label: 'Entrance', kicker: 'The Entrance',
    title: 'Every Detail Has a Purpose.',
    subtitle: 'An inviting arrival, defined by architectural simplicity.',
    time: [7.6, 11.6], scroll: [0.18, 0.3], still: 'foyer',
    card: 'entrance', blurb: 'A full-height timber pivot door opens onto a calm, light-filled foyer.',
  },
  {
    id: 'living', label: 'Living Room', kicker: 'The Living Space',
    title: 'Space to Live Beautifully.',
    subtitle: 'A seamless relationship between living, dining and natural light.',
    time: [11.6, 16.0], scroll: [0.3, 0.42], still: 'living',
    card: 'living', blurb: 'Living and dining flow together beside floor-to-ceiling glazing.',
  },
  {
    id: 'kitchen', label: 'Kitchen', kicker: 'The Kitchen',
    title: 'Designed for Everyday Luxury.',
    subtitle: 'Thoughtful materials meet contemporary functionality.',
    time: [16.0, 18.3], scroll: [0.42, 0.51], still: 'kitchen',
    card: 'kitchen', blurb: 'A marble island anchors walnut cabinetry and integrated appliances.',
  },
  {
    id: 'staircase', label: 'Staircase', kicker: 'The Staircase',
    title: 'A New Perspective.',
    subtitle: 'Follow the architecture to the private spaces above.',
    time: [18.3, 23.0], scroll: [0.51, 0.63], still: 'staircase',
    card: 'staircase', blurb: 'Illuminated treads and glass balustrades rise to the floor above.',
  },
  {
    id: 'suite', label: 'Master Suite', kicker: 'The Master Suite',
    title: 'Your Own Private Retreat.',
    subtitle: 'Comfort, natural light and refined detailing.',
    time: [23.0, 30.6], scroll: [0.63, 0.78], still: 'bedroom',
    card: 'bedroom', blurb: 'A serene bedroom and a marble bathroom with a freestanding bath.',
  },
  {
    id: 'balcony', label: 'Balcony', kicker: 'The Balcony',
    title: 'Room to Breathe.',
    subtitle: 'A quieter connection with the outdoors.',
    time: [30.6, 34.85], scroll: [0.78, 0.9], still: 'balcony',
    card: 'balcony', blurb: 'A glass-fronted balcony looking out across the garden.',
  },
  {
    id: 'reveal', label: 'Final Reveal', kicker: 'The Final Reveal',
    title: 'Experience It in Person.',
    subtitle: 'Your next chapter begins here.',
    cta: 'Schedule a Private Viewing',
    time: [34.85, 34.85], scroll: [0.9, 1], still: 'facade', finalStill: true,
  },
];

/** Gallery carousel: stills taken from the supplied film only. */
export const GALLERY = [
  { file: 'facade', caption: 'Front elevation', room: 'Exterior' },
  { file: 'garden', caption: 'Garden approach', room: 'Exterior' },
  { file: 'entrance', caption: 'Entrance', room: 'Arrival' },
  { file: 'foyer', caption: 'Foyer', room: 'Arrival' },
  { file: 'living', caption: 'Living room', room: 'Ground floor' },
  { file: 'dining', caption: 'Dining', room: 'Ground floor' },
  { file: 'kitchen', caption: 'Kitchen', room: 'Ground floor' },
  { file: 'staircase', caption: 'Staircase', room: 'Circulation' },
  { file: 'landing', caption: 'Upper landing', room: 'First floor' },
  { file: 'bedroom', caption: 'Master bedroom', room: 'First floor' },
  { file: 'bathroom', caption: 'Bathroom', room: 'First floor' },
  { file: 'suite-view', caption: 'Suite outlook', room: 'First floor' },
  { file: 'balcony', caption: 'Balcony view', room: 'First floor' },
];

/** Builds a responsive image source set for a still. */
export const still = (name, size = '') => `assets/images/scenes/${name}${size ? `-${size}` : ''}.webp`;
export const srcset = (name) => `${still(name, 'sm')} 800w, ${still(name, 'md')} 1280w, ${still(name)} 1920w`;
