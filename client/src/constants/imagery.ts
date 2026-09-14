/* ==========================================================================
   IMAGERY - the one place a photograph is named
   --------------------------------------------------------------------------
   Every image on this site resolves through this file. No component builds a
   URL, and no content module holds one. When the school's own shoot is
   delivered, this file is the entire migration: change `resolve()` to point at
   the school's CDN and swap each entry's `id` for its filename. Nothing else
   in the codebase changes - not a layout, not an animation, not a page.

   THE SHAPE OF AN ENTRY

     id     the asset key. Today an Unsplash photo id; tomorrow a filename.
            A root-relative path ('/images/gallery/2025-26/01.jpg') or a full
            URL is served as written, so the school's own files can replace
            an entry one at a time without touching `resolve()`.
     alt    what the photograph shows. Written for a person using a screen
            reader, so it describes the scene rather than restating the
            heading beside it.
     focus  where the subject sits in the frame, as an object-position value.
            This is load-bearing: this site crops photography into arches,
            circles and blobs, and a portrait cropped to a circle on its
            default centre will lose the face. Set it per photograph.
     tone   `light` or `dark`, meaning the tonality of the frame rather than
            its subject. Sections that lay type over a photograph read this to
            decide which scrim to use.

   THE GROUPS

   Named for the job, not for the page - `campus` is the campus wherever the
   campus appears. A photograph used in two places is one entry referenced
   twice, so replacing it replaces it everywhere.
   ========================================================================== */

export interface Photo {
  id: string;
  alt: string;
  focus?: string;
  tone?: 'light' | 'dark';
}

/**
 * Turn an entry into a URL at the width the slot actually needs.
 *
 * Width is required rather than defaulted, because the single most common way
 * a site like this gets slow is a 2400px frame served into a 320px thumbnail.
 * Call it with the rendered width, not the source width.
 */
export const resolve = (photo: Photo, width: number) =>
  isFile(photo.id)
    ? photo.id
    : `https://images.unsplash.com/photo-${photo.id}?auto=format&fit=crop&w=${width}&q=80`;

/**
 * A `srcset` for a slot, so the browser picks against the real device rather
 * than against our guess. Pass the widths the layout can actually produce.
 * Empty for a local file, which has one size and nothing to pick between.
 */
export const resolveSet = (photo: Photo, widths: number[]) =>
  isFile(photo.id) ? '' : widths.map((w) => `${resolve(photo, w)} ${w}w`).join(', ');

/** A path or URL rather than an Unsplash id. */
function isFile(id: string) {
  return id.startsWith('/') || /^https?:\/\//.test(id);
}

/* ==========================================================================
   heroImage - the opening frame of the site
   --------------------------------------------------------------------------
   One constraint the rest of the library does not share: the homepage
   headline sits to its left, so the subject must be right of centre with an
   uncluttered left edge. Replace it with a frame composed the same way.
   ========================================================================== */

export const heroImage: Photo = {
  id: '1573894998033-c0cef4ed722b',
  alt: 'A student working at their desk with the rest of the class behind them',
  focus: '62% 40%',
  tone: 'dark',
};

/** The secondary frames in the hero composition - the small floating crops. */
export const heroInsets: Photo[] = [
  {
    id: '1571260899304-425eee4c7efc',
    alt: 'Students talking together between lessons',
    focus: '50% 35%',
  },
  {
    id: '1552674605-db6ffd4facb5',
    alt: 'Athletes training on the school field',
    focus: '50% 40%',
  },
];

/* ==========================================================================
   heritageImages - the archive
   --------------------------------------------------------------------------
   In chronological order, and the order is meaningful: the timeline reads
   them left to right as it travels from 1962 to today.
   ========================================================================== */

export const heritageImages: Photo[] = [
  {
    id: '1573894997713-de07a124df43',
    alt: 'The founding classroom, photographed in the school first year',
    focus: '50% 45%',
  },
  {
    id: '1627556704290-2b1f5853ff78',
    alt: 'Students receiving academic honours at an assembly',
    focus: '50% 35%',
  },
  {
    id: '1592280771190-3e2e4d571952',
    alt: 'The purpose-built campus building shortly after completion',
    focus: '50% 55%',
  },
  {
    id: '1516321318423-f06f85e504b3',
    alt: 'Students working at the first computer laboratory',
    focus: '50% 40%',
  },
  {
    id: '1580582932707-520aed937b7b',
    alt: 'A classroom with the desks set for a lesson',
    focus: '50% 50%',
  },
  {
    id: '1562774053-701939374585',
    alt: 'A daylit classroom on the rebuilt campus',
    focus: '50% 45%',
  },
  {
    id: '1561144257-e32e8efc6c4f',
    alt: 'Students building a robot in the innovation lab',
    focus: '50% 45%',
  },
  {
    id: '1571260899304-425eee4c7efc',
    alt: 'Students on the New Model High School campus today',
    focus: '50% 35%',
  },
];

/* ==========================================================================
   campusImages - the place
   ========================================================================== */

export const campusImages: Photo[] = [
  {
    id: '1580582932707-520aed937b7b',
    alt: 'A smart classroom set up for a lesson',
    focus: '50% 50%',
  },
  {
    id: '1532094349884-543bc11b234d',
    alt: 'Glassware laid out on a bench in the science laboratory',
    focus: '50% 45%',
  },
  {
    id: '1581092160562-40aa08e78837',
    alt: 'A robotic arm on the bench in the innovation laboratory',
    focus: '50% 45%',
  },
  {
    id: '1568667256549-094345857637',
    alt: 'The library reading hall, shelves running the length of the room',
    focus: '50% 50%',
  },
  {
    id: '1546519638-68e109498ffc',
    alt: 'The indoor sports arena with the courts marked out',
    focus: '50% 55%',
  },
  {
    id: '1499892477393-f675706cbe6e',
    alt: 'Work in progress on the benches of the art studio',
    focus: '50% 45%',
  },
  {
    id: '1511379938547-c1f69419868d',
    alt: 'Instruments set out in the music wing',
    focus: '50% 45%',
  },
  {
    id: '1592280771190-3e2e4d571952',
    alt: 'The school building seen from the front courtyard',
    focus: '50% 55%',
  },
  {
    id: '1562774053-701939374585',
    alt: 'The main campus courtyard between lessons',
    focus: '50% 45%',
    tone: 'dark',
  },
];

/* ==========================================================================
   studentImages - children, doing things
   --------------------------------------------------------------------------
   The working set for anything that needs a person rather than a place. Kept
   in rough age order, youngest first, because several sections walk the
   thirteen years in sequence and need to draw in that order.
   ========================================================================== */

export const studentImages: Photo[] = [
  {
    id: '1573894997713-de07a124df43',
    alt: 'Young students at their desks in a classroom',
    focus: '50% 45%',
  },
  {
    id: '1659985281435-d8d3ea55b55c',
    alt: 'A child working on early letters with a teacher',
    focus: '52% 38%',
  },
  {
    id: '1572847748080-bac263fae977',
    alt: 'A primary-age student in school uniform reading aloud',
    focus: '50% 35%',
  },
  {
    id: '1571260899304-425eee4c7efc',
    alt: 'Middle-school students with books between lessons',
    focus: '50% 35%',
  },
  {
    id: '1523580494863-6f3031224c94',
    alt: 'Students arriving at the school gate in the morning',
    focus: '50% 45%',
  },
  {
    id: '1541339907198-e08756dedf3f',
    alt: 'School leavers celebrating at the end of Class 10',
    focus: '50% 40%',
  },
  {
    id: '1481627834876-b7833e8f5570',
    alt: 'A student reading in the library',
    focus: '50% 40%',
  },
];

/* ==========================================================================
   facultyImages - portraits
   --------------------------------------------------------------------------
   Every one of these is cropped to a circle or an arch somewhere on the site,
   so every one carries a `focus` placing the face in the upper third. This is
   the group most likely to break when real photography lands: check the crop
   on each replacement rather than trusting the default.
   ========================================================================== */

export const facultyImages: Photo[] = [
  { id: '1508214751196-bcfd4ca60f91', alt: 'Portrait of the principal', focus: '50% 28%' },
  { id: '1560250097-0b93528c311a', alt: 'Portrait of the vice principal', focus: '50% 26%' },
  { id: '1573497019940-1c28c88b4f3e', alt: 'Portrait of the head of student wellbeing', focus: '50% 28%' },
  { id: '1507003211169-0a1dd7228f2d', alt: 'Portrait of the head of primary and early years', focus: '50% 26%' },
  { id: '1607746882042-944635dfe10e', alt: 'Portrait of the head of science', focus: '50% 26%' },
  { id: '1472099645785-5658abf4ff4e', alt: 'Portrait of an alumnus', focus: '50% 26%' },
  { id: '1494790108377-be9c29b29330', alt: 'Portrait of a student house captain', focus: '50% 26%' },
  { id: '1500648767791-00dcc994a43e', alt: 'Portrait of a senior student', focus: '50% 26%' },
  { id: '1544005313-94ddf0286df2', alt: 'Portrait of an alumna', focus: '50% 26%' },
];

/* ==========================================================================
   sportsImages / artsImages - the two strands with their own photography
   ========================================================================== */

export const sportsImages: Photo[] = [
  { id: '1552674605-db6ffd4facb5', alt: 'Athletes training on the school field', focus: '50% 40%' },
  { id: '1461896836934-ffe607ba8211', alt: 'A runner on the track at a school meet', focus: '50% 40%' },
  { id: '1546519638-68e109498ffc', alt: 'The indoor arena during a basketball session', focus: '50% 50%' },
  { id: '1519861531473-9200262188bf', alt: 'A team celebrating after a fixture', focus: '50% 35%' },
];

export const artsImages: Photo[] = [
  { id: '1513364776144-60967b0f800f', alt: 'Brushes and paint on the bench in the art studio', focus: '50% 50%' },
  { id: '1499892477393-f675706cbe6e', alt: 'A student working at an easel', focus: '50% 45%' },
  { id: '1511379938547-c1f69419868d', alt: 'A rehearsal in the music wing', focus: '50% 45%' },
  { id: '1493225457124-a3eb161ffa5f', alt: 'The annual day production on stage', focus: '50% 45%', tone: 'dark' },
];

/* ==========================================================================
   academicImages - lessons, laboratories, the record
   ========================================================================== */

export const academicImages: Photo[] = [
  { id: '1524178232363-1fb2b075b655', alt: 'A teacher working through a problem with senior students', focus: '50% 40%' },
  { id: '1532094349884-543bc11b234d', alt: 'A chemistry practical in progress', focus: '50% 45%' },
  { id: '1581092160562-40aa08e78837', alt: 'Students assembling a robot in the laboratory', focus: '50% 45%' },
  { id: '1509228468518-180dd4864904', alt: 'Working notes on a mathematics problem', focus: '50% 50%' },
  { id: '1517420704952-d9f39e95b43e', alt: 'Students competing at a robotics championship', focus: '50% 45%' },
  { id: '1568667256549-094345857637', alt: 'The library reading hall during a study period', focus: '50% 50%' },
  { id: '1517457373958-b7bdd4587205', alt: 'A project on display at a school exhibition', focus: '50% 45%' },
  { id: '1516321318423-f06f85e504b3', alt: 'Students at work in the computing laboratory', focus: '50% 45%' },
];

/* ==========================================================================
   admissionImages - the gate, the office, the visit
   ========================================================================== */

export const admissionImages: Photo[] = [
  {
    id: '1523580494863-6f3031224c94',
    alt: 'Students arriving at the school gate in the morning',
    focus: '50% 45%',
    tone: 'dark',
  },
  { id: '1592280771190-3e2e4d571952', alt: 'The school entrance and front courtyard', focus: '50% 55%' },
  { id: '1580582932707-520aed937b7b', alt: 'A classroom with the desks set for a lesson', focus: '50% 50%' },
  { id: '1571260899304-425eee4c7efc', alt: 'The campus on an ordinary weekday morning', focus: '50% 35%' },
];

/* ==========================================================================
   galleryImages - the horizontal wall
   --------------------------------------------------------------------------
   Deliberately mixed in shape and subject. The wall reads as a wall precisely
   because the frames are not the same size, so the order here alternates
   between wide frames and tall ones rather than grouping by subject.
   ========================================================================== */

export const galleryImages: Photo[] = [
  { id: '1523580494863-6f3031224c94', alt: 'Morning assembly in the courtyard', focus: '50% 45%' },
  { id: '1519861531473-9200262188bf', alt: 'A team with the state championship trophy', focus: '50% 35%' },
  { id: '1532094349884-543bc11b234d', alt: 'A chemistry practical in progress', focus: '50% 45%' },
  { id: '1493225457124-a3eb161ffa5f', alt: 'The annual day production on stage', focus: '50% 45%' },
  { id: '1461896836934-ffe607ba8211', alt: 'The final of the inter-house track event', focus: '50% 40%' },
  { id: '1517420704952-d9f39e95b43e', alt: 'The robotics squad at the national finals', focus: '50% 45%' },
  { id: '1481627834876-b7833e8f5570', alt: 'Reading hour in the library', focus: '50% 40%' },
  { id: '1517457373958-b7bdd4587205', alt: 'Founders week on the school field', focus: '50% 45%' },
  { id: '1513364776144-60967b0f800f', alt: 'Work drying in the art studio', focus: '50% 50%' },
  { id: '1571260899304-425eee4c7efc', alt: 'Students between lessons on the main corridor', focus: '50% 35%' },
];

/* ==========================================================================
   safetyImages - the Safety & Wellbeing scene on Student Life
   --------------------------------------------------------------------------
   Keyed by the measure each frame is evidence for, so a card can never be
   paired with the wrong photograph by position. The feature frame is cropped
   to a tall rounded panel and the six card frames to a narrow curved slice,
   so every `focus` here is set to keep its subject inside that slice.
   ========================================================================== */

export const safetyImages: { feature: Photo; measures: Record<string, Photo> } = {
  feature: {
    id: '1721907043585-432f7cf522ab',
    alt: 'A student with a backpack, seen from behind, looking down a bright, sunlit school corridor',
    focus: '40% 35%',
  },
  measures: {
    access: {
      id: '1775112077888-8fa36e9bbc51',
      alt: 'A security gatehouse with boom barriers and metal gates at a tree-lined entrance',
      focus: '75% 50%',
    },
    cctv: {
      id: '1702952058716-1496a3c1e7f5',
      alt: 'A long, sunlit corridor with a glass wall, lounge chairs and tall tables',
      focus: '45% 55%',
    },
    medical: {
      id: '1576085898384-b3cdb88736e9',
      alt: 'A quiet medical room with a padded examination bed beside a window',
      focus: '40% 65%',
    },
    transport: {
      id: '1583508805133-8fd03a9916d4',
      alt: 'A yellow school bus, seen from behind, on an open road on a clear day',
      focus: '62% 50%',
    },
    staff: {
      id: '1783120947325-56ae2d32b98e',
      alt: 'Close-up of a member of staff wearing a lanyard with an ID badge',
      focus: '45% 55%',
    },
    wellbeing: {
      id: '1754037783933-c25ff9f68f87',
      alt: 'A calm corner with a soft armchair, a small side table, a rug and plants by the window',
      focus: '55% 60%',
    },
  },
};

/* ==========================================================================
   everydayImages - the invitation spreads
   --------------------------------------------------------------------------
   Candid frames of ordinary school days - classrooms, the ground, the walk
   in - for the four collage spreads that close Home, About, Academics and
   Student Life (see `InviteSection`).

   Keyed by what each photograph shows rather than by position, because a
   collage places every frame by name, and a spread that asks for `yoga`
   should never quietly receive a laboratory because a list was reordered.

   Most of the classroom frames are one photographer's series in one school.
   That is deliberate: side by side they read as a single school's own shoot,
   which is exactly what the school's real photography will be when it lands.
   Every `focus` keeps the faces inside the crops these spreads use - a tall
   arch for the lead, small landscape prints around it.
   ========================================================================== */

export const everydayImages = {
  deskGirls: {
    id: '1692269725911-87697c558be1',
    alt: 'Two girls in school uniform working side by side at a shared desk',
    focus: '56% 44%',
  },
  deskBoys: {
    id: '1692269725827-699e04a11cdf',
    alt: 'Two boys in school uniform bent over the same textbook at their desk',
    focus: '42% 42%',
  },
  deskBooks: {
    id: '1692269726060-9c604e06f63b',
    alt: 'Two boys reading at their desk, school bags on the bench beside them',
    focus: '66% 40%',
  },
  attentive: {
    id: '1692269725836-fbd72e98883f',
    alt: 'Young students in uniform sitting at their desks, listening',
    focus: '62% 55%',
  },
  lesson: {
    id: '1709290749293-c6152a187b14',
    alt: 'A teacher walking between the rows during a lesson while students write',
    focus: '62% 58%',
  },
  friends: {
    id: '1569173675610-42c361a86e37',
    alt: 'A group of boys in school uniform laughing together under a tree',
    focus: '62% 42%',
  },
  waving: {
    id: '1524069290683-0457abfe42c3',
    alt: 'Students in uniform crowding in and waving at the camera',
    focus: '50% 40%',
  },
  yoga: {
    id: '1649008726820-d90aeb70c32e',
    alt: 'Students in uniform doing yoga together on the school ground',
    focus: '55% 45%',
  },
  football: {
    id: '1525088068454-ff2c453e50e9',
    alt: 'Girls chasing the ball during a football match on the school pitch',
    focus: '45% 55%',
  },
  track: {
    id: '1700914299961-d8f91559d85d',
    alt: 'Students sprinting down the running track',
    focus: '42% 64%',
  },
  reading: {
    id: '1623303366639-0e330d7c3d9f',
    alt: 'A boy smiling over his textbook while classmates read behind him',
    focus: '78% 34%',
  },
  walk: {
    id: '1718199885029-6ba9e8b8cf79',
    alt: 'Two students with school bags walking through tall grass',
    focus: '72% 60%',
  },
  classroom: {
    id: '1719159381916-062fa9f435a6',
    alt: 'A daylit classroom with students working at their desks',
    focus: '55% 60%',
  },
} satisfies Record<string, Photo>;

/* ==========================================================================
   voiceImages - the poster frames for the student films
   --------------------------------------------------------------------------
   One per student who speaks on the Student Life page, keyed by the film's
   own id so a reordered list can never hand Kavya's clip Aarav's face.

   TWO CONSTRAINTS THE REST OF THE LIBRARY DOES NOT HAVE.

   They are cropped to a tall 9:16 panel, so `focus` places the face in the
   upper third rather than at the frame's centre - a portrait centred in a
   vertical slat is a photograph of a torso.

   They are all `tone: 'dark'`, because the reel lays a name, a role and a
   runtime over the bottom of each one. A light poster under white type is
   unreadable, and the section reads the tone rather than guessing.

   When the school's own clips are shot, the poster is a still pulled from the
   film itself. Replacing the `id` here is the whole change.
   ========================================================================== */

export const voiceImages = {
  aarav: {
    id: '1500648767791-00dcc994a43e',
    alt: 'Aarav, a Class 10 student, looking into the camera',
    focus: '50% 26%',
    tone: 'dark',
  },
  kavya: {
    id: '1494790108377-be9c29b29330',
    alt: 'Kavya, a Class 9 student and house captain, mid-sentence',
    focus: '50% 24%',
    tone: 'dark',
  },
  zoya: {
    id: '1517841905240-472988babdf9',
    alt: 'Zoya, a Class 7 student, sitting in the school library',
    focus: '52% 24%',
    tone: 'dark',
  },
  rohan: {
    id: '1519085360753-af0119f7cbe7',
    alt: 'Rohan, a Class 10 student, on the athletics track after training',
    focus: '48% 22%',
    tone: 'dark',
  },
} satisfies Record<string, Photo>;

/**
 * Everything, in one object, for the two or three places that want to pick a
 * frame by group name rather than importing the list.
 */
export const IMAGERY = {
  hero: heroImage,
  heroInsets,
  heritage: heritageImages,
  campus: campusImages,
  students: studentImages,
  faculty: facultyImages,
  sports: sportsImages,
  arts: artsImages,
  academic: academicImages,
  admission: admissionImages,
  gallery: galleryImages,
  everyday: everydayImages,
  voices: voiceImages,
} as const;
