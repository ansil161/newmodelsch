import { ROUTES } from './index';

/* ==========================================================================
   LIBRARY - every photograph, once
   ========================================================================== */

const LIBRARY = {
  // ------------------------------------------------ everyday school life
  laughingTree: { id: '1569173675610-42c361a86e37', alt: 'A group of boys in school uniform laughing together under a tree', ratio: 1.5, focus: '62% 42%' },
  waving: { id: '1524069290683-0457abfe42c3', alt: 'Students in uniform crowding in and waving at the camera', ratio: 1.5, focus: '50% 40%' },
  walkGrass: { id: '1718199885029-6ba9e8b8cf79', alt: 'Two students with school bags walking through tall grass', ratio: 1.791, focus: '72% 60%' },
  lookBack: { id: '1659985281435-d8d3ea55b55c', alt: 'A boy in uniform turning round in his seat during class', ratio: 1.5, focus: '50% 38%' },
  girlsUniform: { id: '1572847748080-bac263fae977', alt: 'Young girls in school uniform with ribbons in their hair', ratio: 1.5, focus: '42% 40%' },
  twoBoys: { id: '1524503033411-c9566986fc8f', alt: 'Two boys pulling faces for the camera', ratio: 1.5, focus: '45% 40%' },
  chess: { id: '1529699211952-734e80c4d42b', alt: 'Wooden chess pieces lined up mid-game at the chess club', ratio: 1.5 },
  benchReading: { id: '1472162072942-cd5147eb3902', alt: 'A boy laughing over a book on a bench outdoors', ratio: 1.5, focus: '35% 45%' },
  friendsLaughing: { id: '1491438590914-bc09fcaaf77a', alt: 'Friends laughing together in warm afternoon light', ratio: 1.5 },
  backpacks: { id: '1594608661623-aa0bd3a69d98', alt: 'Young children with backpacks and sun hats walking together', ratio: 1.111, focus: '50% 45%' },
  corridor: { id: '1721907043585-432f7cf522ab', alt: 'A student with a backpack walking down a bright, sunlit school corridor', ratio: 0.667, focus: '40% 35%' },
  peaceSigns: { id: '1488521787991-ed7bbaae773c', alt: 'Smiling children crowding the camera and making peace signs', ratio: 1.5, focus: '45% 40%' },
  sunsetFriends: { id: '1511632765486-a01980e01a18', alt: 'Friends with their arms around each other watching the sunset', ratio: 1.5, focus: '55% 55%' },
  huddle: { id: '1609234656388-0ff363383899', alt: 'A team huddled together with arms round each other before a match', ratio: 1.765 },

  // ------------------------------------------------ learning
  girlsDesk: { id: '1692269725911-87697c558be1', alt: 'Two girls in school uniform working side by side at a shared desk', ratio: 1.765, focus: '56% 44%' },
  boysTextbook: { id: '1692269725827-699e04a11cdf', alt: 'Two boys in school uniform bent over the same textbook', ratio: 1.667, focus: '42% 42%' },
  boysReading: { id: '1692269726060-9c604e06f63b', alt: 'Two boys reading at their desk, school bags on the bench beside them', ratio: 1.765, focus: '66% 40%' },
  attentive: { id: '1692269725836-fbd72e98883f', alt: 'Young students in uniform sitting at their desks, listening', ratio: 1.791, focus: '62% 55%' },
  lesson: { id: '1709290749293-c6152a187b14', alt: 'A teacher walking between the rows during a lesson while students write', ratio: 1.5, focus: '62% 58%' },
  classroomDaylit: { id: '1719159381916-062fa9f435a6', alt: 'A daylit classroom with students working at their desks', ratio: 1.5, focus: '55% 60%' },
  girlsClass: { id: '1573894998033-c0cef4ed722b', alt: 'Girls in school uniform listening closely during a lesson', ratio: 1.5, focus: '40% 40%' },
  handsUp: { id: '1577896851231-70ef18881754', alt: 'Children raising their hands to answer a question in class', ratio: 1.5 },
  classroomGroups: { id: '1509062522246-3755977927d7', alt: 'Students working in groups around their tables while a teacher looks on', ratio: 1.6 },
  blackboard: { id: '1522661067900-ab829854a57f', alt: 'A girl in uniform writing on the blackboard', ratio: 1.5, focus: '75% 50%' },
  kidsDesks: { id: '1588072432836-e10032774350', alt: 'Children concentrating on worksheets at their desks', ratio: 1.5, focus: '60% 50%' },
  boyWriting: { id: '1529390079861-591de354faf5', alt: 'A boy writing carefully in his exercise book', ratio: 1.5, focus: '60% 45%' },
  headDown: { id: '1598981457915-aea220950616', alt: 'A student bent over his work in a quiet classroom', ratio: 1.538 },
  homework: { id: '1560785496-3c9d27877182', alt: 'A boy working through his homework with a pencil', ratio: 1.333 },
  redBooks: { id: '1623303366639-0e330d7c3d9f', alt: 'Children in red shirts holding up the books they are reading', ratio: 1.5, focus: '78% 34%' },
  twoReaders: { id: '1544776193-352d25ca82cd', alt: 'Two girls reading together at a yellow table', ratio: 1.765, focus: '40% 45%' },
  headphones: { id: '1610484826967-09c5720778c7', alt: 'A student in headphones working on a tablet', ratio: 1.5 },
  laptopGroup: { id: '1522202176988-66273c2fd55f', alt: 'Senior students working on a project around a laptop', ratio: 1.5 },
  computers: { id: '1531482615713-2afd69097998', alt: 'Students coding together in the computer laboratory', ratio: 1.5 },
  calculus: { id: '1596495577886-d920f1fb7238', alt: 'A hand working through an equation on the whiteboard', ratio: 1.5 },
  equations: { id: '1509228468518-180dd4864904', alt: 'Working notes on a mathematics problem', ratio: 1.5 },
  robotCar: { id: '1561144257-e32e8efc6c4f', alt: 'A student-built robot car on display at the exhibition', ratio: 1.5 },
  breadboard: { id: '1517420704952-d9f39e95b43e', alt: 'A circuit built on a breadboard beside a multimeter', ratio: 1.5 },
  glassware: { id: '1532094349884-543bc11b234d', alt: 'Glassware laid out on a bench in the science laboratory', ratio: 1.5 },
  pipette: { id: '1532187863486-abf9dbad1b69', alt: 'A pipette filling a tray of samples during a practical', ratio: 1.5 },
  drafting: { id: '1581092160562-40aa08e78837', alt: 'A student sketching a design among tools on the workbench', ratio: 1.5 },
  blocks: { id: '1541692641319-981cc79ee10a', alt: 'A child stacking coloured building blocks', ratio: 1.5, focus: '55% 50%' },

  // ------------------------------------------------ campus
  brickBlock: { id: '1592280771190-3e2e4d571952', alt: 'The brick teaching block seen across the front lawn', ratio: 1.333, focus: '50% 55%' },
  mainBuilding: { id: '1562774053-701939374585', alt: 'The main building and its lawn on a clear morning', ratio: 1.519 },
  campusLawn: { id: '1591123120675-6f7f1aae0e5b', alt: 'A brick path across the lawn to the school buildings', ratio: 1.5 },
  libraryCurve: { id: '1568667256549-094345857637', alt: 'Curved shelves rising floor to ceiling in the library', ratio: 0.714 },
  libraryLights: { id: '1481627834876-b7833e8f5570', alt: 'Library shelves under a row of hanging lamps', ratio: 1.081 },
  libraryGlass: { id: '1564981797816-1043664bf78d', alt: 'The glass-walled reading room with tables by the windows', ratio: 1.333 },
  libraryAisle: { id: '1427504494785-3a9ca7044f45', alt: 'A student browsing between tall library shelves', ratio: 1.5 },
  bookPick: { id: '1513475382585-d06e58bcb0e0', alt: 'A hand taking a book down from the shelf', ratio: 1.5 },
  guitars: { id: '1511379938547-c1f69419868d', alt: 'Guitars and a keyboard set out in the music room', ratio: 1.5 },
  bus: { id: '1583508805133-8fd03a9916d4', alt: 'A yellow school bus on the open road', ratio: 1.5, focus: '62% 50%' },

  // ------------------------------------------------ sports
  sprint: { id: '1700914299961-d8f91559d85d', alt: 'Students sprinting down the running track', ratio: 1.5, focus: '42% 64%' },
  runners: { id: '1552674605-db6ffd4facb5', alt: 'Runners silhouetted against a blue morning sky', ratio: 1.5 },
  blocksStart: { id: '1461896836934-ffe607ba8211', alt: 'An athlete crouched in the starting blocks', ratio: 1.5 },
  girlsFootball: { id: '1525088068454-ff2c453e50e9', alt: 'Girls chasing the ball during a football match', ratio: 1.5, focus: '45% 55%' },
  footballGrass: { id: '1574629810360-7efbbe195018', alt: 'A football at a player’s feet on the pitch', ratio: 1.714 },
  footballKick: { id: '1560272564-c83b66b1ad12', alt: 'A player striking the ball towards goal', ratio: 0.774 },
  boots: { id: '1511886929837-354d827aae26', alt: 'A football and boots on the grass before a match', ratio: 0.8 },
  basketballGame: { id: '1519766304817-4f37bda74a26', alt: 'Players lining up for a free throw at a basketball game', ratio: 1.5 },
  hoop: { id: '1546519638-68e109498ffc', alt: 'A basketball dropping through the hoop', ratio: 1.538 },
  courtBall: { id: '1519861531473-9200262188bf', alt: 'A basketball resting on a wet outdoor court', ratio: 1.5 },
  badminton: { id: '1626224583764-f87db24ac4ea', alt: 'A badminton player leaping for a smash', ratio: 1.5 },
  volleyball: { id: '1547347298-4074fc3086f0', alt: 'Volleyball players celebrating a point at the net', ratio: 1.5 },
  cricketBall: { id: '1531415074968-036ba1b575da', alt: 'A red cricket ball on the grass', ratio: 1.5, focus: '70% 60%' },
  cricketGround: { id: '1540747913346-19e32dc3e97e', alt: 'A floodlit cricket ground at dusk', ratio: 1.739 },
  tennis: { id: '1554068865-24cecd4e34b8', alt: 'A tennis player serving on a clay court, seen from above', ratio: 1.5 },
  swimmer: { id: '1530549387789-4c1017266635', alt: 'A swimmer mid-stroke in the pool', ratio: 1.5 },
  yoga: { id: '1649008726820-d90aeb70c32e', alt: 'Students in uniform doing yoga together on the school ground', ratio: 1.5, focus: '55% 45%' },
  parachute: { id: '1606092195730-5d7b9af1efc5', alt: 'Children lifting a rainbow parachute together on the field', ratio: 1.5 },

  // ------------------------------------------------ arts and the stage
  performer: { id: '1493225457124-a3eb161ffa5f', alt: 'A performer with arms raised in coloured stage smoke', ratio: 1.5, focus: '50% 45%', tone: 'dark' },
  curtain: { id: '1503095396549-807759245b35', alt: 'Dancers silhouetted against the red stage curtain', ratio: 1.5, tone: 'dark' },
  violins: { id: '1465847899084-d164df4dedc6', alt: 'The string ensemble playing in performance', ratio: 1.5 },
  drums: { id: '1519892300165-cb5542fb47c7', alt: 'Drumsticks resting on a snare drum', ratio: 1.5 },
  microphone: { id: '1516280440614-37939bbacd81', alt: 'A microphone waiting under the stage lights', ratio: 1.5, tone: 'dark' },
  sheetMusic: { id: '1507838153414-b4b713384a76', alt: 'An open book of sheet music', ratio: 1.5 },
  dancer: { id: '1547153760-18fc86324498', alt: 'A dancer mid-movement under a single light', ratio: 0.667, focus: '50% 30%' },
  streetDancer: { id: '1535525153412-5a42439a210d', alt: 'A dancer spinning under evening lights', ratio: 1.5 },
  paints: { id: '1499892477393-f675706cbe6e', alt: 'Pots of paint and brushes on the art studio table', ratio: 1.5 },
  brushes: { id: '1513364776144-60967b0f800f', alt: 'Brushes loaded with bright paint', ratio: 1.5 },
  paintedStones: { id: '1596464716127-f2a82984de30', alt: 'Children painting stones with markers and watercolours', ratio: 1.5 },
  paintTable: { id: '1560421683-6856ea585c78', alt: 'A table covered in bright paint after an art session', ratio: 1.5 },
  paintedFace: { id: '1503454537195-1dcabb73ffb9', alt: 'A girl with paint on her cheeks looking up and smiling', ratio: 0.663, focus: '50% 35%' },

  // ------------------------------------------------ celebrations
  confetti: { id: '1492684223066-81342ee5ff30', alt: 'Confetti falling over a cheering crowd', ratio: 1.5, tone: 'dark' },
  stringLights: { id: '1517457373958-b7bdd4587205', alt: 'A crowd gathered under strings of lights at an evening celebration', ratio: 1.5 },
  holi: { id: '1603228254119-e6a4d095dc59', alt: 'Clouds of coloured powder over a crowd celebrating Holi', ratio: 1.5 },
  parkColours: { id: '1526976668912-1a811878dd37', alt: 'Friends sitting in the grass surrounded by colour', ratio: 1.5 },
  fireworks: { id: '1567593810070-7a3d471af022', alt: 'Fireworks bursting over a crowd watching in silhouette', ratio: 1.5, tone: 'dark' },
  ornaments: { id: '1543589077-47d81606c1bf', alt: 'Red ornaments hanging on the Christmas tree', ratio: 0.667 },
  pinkChristmas: { id: '1576919228236-a097c32a5cd4', alt: 'Christmas decorations laid out on a pink table', ratio: 1.5 },
  wreath: { id: '1512389142860-9c449e58a543', alt: 'Winter greenery and berries arranged for Christmas', ratio: 1.5 },
  audience: { id: '1540575467063-178a50c2df87', alt: 'The audience seated in the hall during a performance', ratio: 1.5, tone: 'dark' },
  screening: { id: '1558008258-3256797b43f3', alt: 'A packed hall watching the big screen', ratio: 1.765, tone: 'dark' },
  capsSunset: { id: '1541339907198-e08756dedf3f', alt: 'Leavers throwing their caps into a sunset sky', ratio: 1.5 },
  capsBuilding: { id: '1627556704290-2b1f5853ff78', alt: 'Graduates tossing caps in front of the main building', ratio: 1.5 },
  gownBack: { id: '1525921429624-479b6a26d84d', alt: 'A graduate in cap and gown, seen from behind among classmates', ratio: 1.5 },

  // ------------------------------------------------ community and trips
  flag: { id: '1532375810709-75b1da00537c', alt: 'The Indian flag flying against a clear sky', ratio: 1.519, focus: '40% 50%' },
  assembly: { id: '1573894997713-de07a124df43', alt: 'Girls in red uniform seated together at the morning assembly', ratio: 1.5, focus: '50% 45%' },
  seedling: { id: '1542601906990-b4d3fb778b09', alt: 'Cupped hands holding a young plant ready for planting', ratio: 1.739 },
  volunteer: { id: '1559027615-cd4628902d4a', alt: 'A volunteer in a bright shirt helping at a community event', ratio: 1.5 },
  donation: { id: '1532629345422-7515f3d16bb6', alt: 'Hands holding coins and a note that reads “make a change”', ratio: 1.5 },
  palace: { id: '1590766940554-634a7ed41450', alt: 'Mysuru Palace under a bright blue sky', ratio: 1.714 },
  hikers: { id: '1551632811-561732d1e306', alt: 'Hikers with rucksacks on a trail below snowy peaks', ratio: 1.5 },
  valley: { id: '1501555088652-021faa106b9b', alt: 'A walker with a yellow rucksack looking out over a green valley', ratio: 1.5 },
  lookout: { id: '1529156069898-49953e39b3ac', alt: 'Friends sitting arm in arm looking out over the view', ratio: 1.765 },
  map: { id: '1488646953014-85cb44e25828', alt: 'A trip map laid out with a notebook and a camera', ratio: 1.263 },
  tent: { id: '1504280390367-361c6d9f38f4', alt: 'The view through an open tent flap into the forest', ratio: 1.5 },
  stars: { id: '1519681393784-d120267933ba', alt: 'The Milky Way over the mountains on camp night', ratio: 1.5 },
  lake: { id: '1464822759023-fed622ff2c3b', alt: 'Mountains and forest above a lake', ratio: 1.5 },
  dock: { id: '1508672019048-805c876b67e2', alt: 'A wooden jetty on a still mountain lake', ratio: 1.579 },
  forestPlay: { id: '1502086223501-7ea6ecd79368', alt: 'Children playing with a ball in a sunlit forest clearing', ratio: 1.446 },
  beach: { id: '1507525428034-b723cf961d3e', alt: 'Waves rolling onto a beach at sunset', ratio: 1.5 },
};

const L = LIBRARY;

/* ==========================================================================
   CATEGORIES
   ========================================================================== */

export const GALLERY_CATEGORIES = [
  {
    id: 'student-life',
    label: 'Student Life',
    title: 'The in-between hours',
    lead: 'Friendships, jokes and the walk between lessons - the part of school nobody timetables.',
    note: 'the part we remember',
    photos: [L.laughingTree, L.waving, L.walkGrass, L.lookBack, L.twoBoys, L.benchReading, L.girlsUniform, L.chess, L.friendsLaughing],
  },
  {
    id: 'celebrations',
    label: 'Celebrations',
    title: 'The loudest days of the year',
    lead: 'Festivals, fests and farewells, when the whole school gathers in one place.',
    note: 'bring the noise',
    photos: [L.performer, L.holi, L.confetti, L.capsSunset, L.stringLights, L.fireworks, L.paintedFace, L.ornaments],
  },
  {
    id: 'sports',
    label: 'Sports',
    title: 'Chalk lines and early mornings',
    lead: 'Houses, fixtures and training sessions - and the team talk before every one of them.',
    note: 'on your marks',
    photos: [L.sprint, L.girlsFootball, L.huddle, L.basketballGame, L.badminton, L.cricketGround, L.runners, L.volleyball],
  },
  {
    id: 'learning',
    label: 'Learning',
    title: 'Heads down, hands up',
    lead: 'Classrooms, laboratories and libraries, photographed on ordinary days.',
    note: 'the everyday work',
    photos: [L.girlsDesk, L.lesson, L.pipette, L.robotCar, L.blackboard, L.handsUp, L.boysReading, L.libraryAisle],
  },
  {
    id: 'arts',
    label: 'Arts',
    title: 'Made by many hands',
    lead: 'The studio, the music room and the stage, from first sketch to curtain call.',
    note: 'paint still drying',
    photos: [L.curtain, L.violins, L.paintedStones, L.dancer, L.paints, L.drums, L.paintTable, L.guitars],
  },
  {
    id: 'campus',
    label: 'Campus',
    title: 'The places that hold it all',
    lead: 'Corridors, lawns and reading rooms - the backdrop to every photograph here.',
    note: 'four acres of it',
    photos: [L.mainBuilding, L.libraryCurve, L.brickBlock, L.classroomDaylit, L.corridor, L.libraryGlass, L.campusLawn, L.libraryLights],
  },
  {
    id: 'community',
    label: 'Community',
    title: 'Beyond our own gate',
    lead: 'Assemblies, service drives and the days the school works for the city around it.',
    note: 'together, always',
    photos: [L.assembly, L.seedling, L.peaceSigns, L.yoga, L.volunteer, L.flag, L.parachute, L.audience],
  },
];

export const categoryLabel = (id) =>
  GALLERY_CATEGORIES.find((c) => c.id === id)?.label ?? id;

/* ==========================================================================
   ACADEMIC YEARS AND THEIR EVENTS
   --------------------------------------------------------------------------
   Events are listed in the order they happened. A cover is also the first
   photograph of its event, so the event opens where its card left off.
   ========================================================================== */

const event = (e) => ({
  ...e,
  photos: [e.cover, ...e.photos.filter((p) => p.id !== e.cover.id)],
});

export const GALLERY_YEARS = [
  {
    id: '2025-26',
    title: '2025–26',
    subtitle: 'A year in motion',
    span: 'June 2025 - March 2026',
    intro:
      'A new science block, the biggest Cultural Fest the school has staged, and a Class 10 that left with a standing ovation. The year, event by event.',
    cover: L.waving,
    events: [
      event({
        id: 'independence-day', title: 'Independence Day', date: '15 August 2025', venue: 'Main ground', category: 'community',
        description: 'The flag, the anthem and a whole school standing in rows.',
        story: 'The morning began with the flag hoisting on the main ground and ended with house performances in the hall. Every class, from Nursery up, took a place in the assembly.',
        cover: L.flag, photos: [L.assembly, L.yoga, L.girlsUniform, L.peaceSigns, L.laughingTree, L.audience],
      }),
      event({
        id: 'cultural-fest', title: 'Cultural Fest', date: '24 September 2025', venue: 'School auditorium and courtyard', category: 'celebrations',
        description: 'A celebration of culture, creativity, and community.',
        story: 'Two stages, eleven performances and a courtyard of stalls run by students. Classical dance opened the evening, the string ensemble closed it, and in between every house put something of its own on stage.',
        cover: L.performer, photos: [L.curtain, L.confetti, L.stringLights, L.microphone, L.drums, L.dancer, L.violins, L.audience, L.paintedFace, L.waving, L.streetDancer],
      }),
      event({
        id: 'science-exhibition', title: 'Science Exhibition', date: '7 November 2025', venue: 'Science block', category: 'learning',
        description: 'Forty projects, one question each, and a lot of explaining to parents.',
        story: 'Classes 6 to 10 turned the new science block into an exhibition hall. Robots, circuits, water filters and one very patient model volcano.',
        cover: L.robotCar, photos: [L.breadboard, L.glassware, L.pipette, L.drafting, L.computers, L.headphones, L.laptopGroup, L.calculus],
      }),
      event({
        id: 'sports-day', title: 'Sports Day', date: '12 December 2025', venue: 'Athletics ground', category: 'sports',
        description: 'Four houses, one track and the loudest afternoon of the term.',
        story: 'Heats in the morning, finals after lunch and the relay last of all. Blue house took the shield by four points.',
        cover: L.sprint, photos: [L.runners, L.blocksStart, L.girlsFootball, L.huddle, L.parachute, L.volleyball, L.cricketBall, L.badminton],
      }),
      event({
        id: 'christmas-celebration', title: 'Christmas Celebration', date: '19 December 2025', venue: 'School hall', category: 'celebrations',
        description: 'Carols, a crooked paper star and the last assembly before the break.',
        story: 'The primary classes decorated the hall, the choir led the carols and the staff performed a play that will not be repeated.',
        cover: L.ornaments, photos: [L.pinkChristmas, L.wreath, L.peaceSigns, L.benchReading, L.audience, L.microphone],
      }),
      event({
        id: 'arts-festival', title: 'Arts Festival', date: '20 January 2026', venue: 'Art studio and music wing', category: 'arts',
        description: 'A week of open studios, recitals and paint in unexpected places.',
        story: 'Every class exhibited work made during the term. The music wing ran recitals at lunch, and the painted stones from Class 3 now line the garden path.',
        cover: L.paintedStones, photos: [L.paints, L.brushes, L.paintTable, L.guitars, L.sheetMusic, L.paintedFace, L.dancer, L.violins],
      }),
      event({
        id: 'mysuru-heritage-trip', title: 'Mysuru Heritage Trip', date: '9 February 2026', venue: 'Mysuru, Karnataka', category: 'student-life',
        description: 'Three days, one palace and a bus that sang the whole way.',
        story: 'Class 9 travelled to Mysuru for the palace, the museums and a morning walk in the hills. The notebooks came back full.',
        cover: L.palace, photos: [L.bus, L.backpacks, L.lookout, L.hikers, L.valley, L.walkGrass, L.map, L.dock],
      }),
      event({
        id: 'class-10-farewell', title: 'Class 10 Farewell', date: '14 March 2026', venue: 'Main lawn', category: 'celebrations',
        description: 'The last photograph of a class that started here in Nursery.',
        story: 'Speeches, a slideshow that ran long, and caps in the air at sunset. Forty-six students, most of whom had been here for eleven years.',
        cover: L.capsSunset, photos: [L.capsBuilding, L.gownBack, L.sunsetFriends, L.friendsLaughing, L.laughingTree, L.huddle],
      }),
    ],
  },
  {
    id: '2024-25',
    title: '2024–25',
    subtitle: 'Stories we shared',
    span: 'June 2024 - March 2025',
    intro:
      'The year the library reopened, the first nature camp ran, and Holi came back to the courtyard. Six events, told in photographs.',
    cover: L.curtain,
    events: [
      event({
        id: 'green-campus-drive', title: 'Green Campus Drive', date: '5 June 2024', venue: 'School grounds', category: 'community',
        description: 'Two hundred saplings planted on World Environment Day.',
        story: 'Every class adopted a corner of the grounds. The saplings along the boundary wall are now taller than Class 1.',
        cover: L.seedling, photos: [L.volunteer, L.donation, L.peaceSigns, L.walkGrass, L.yoga],
      }),
      event({
        id: 'library-week', title: 'Library Week', date: '22 August 2024', venue: 'The library', category: 'learning',
        description: 'A reopened reading room and a week of stories.',
        story: 'The refurbished library opened with author readings, a book swap and a reading marathon that Class 5 refused to end.',
        cover: L.libraryAisle, photos: [L.libraryCurve, L.libraryLights, L.bookPick, L.libraryGlass, L.twoReaders, L.benchReading, L.redBooks],
      }),
      event({
        id: 'inter-house-athletics', title: 'Inter-House Athletics', date: '6 December 2024', venue: 'Athletics ground and courts', category: 'sports',
        description: 'Track, court and pool across two full days.',
        story: 'The meet added swimming and basketball this year. Eleven school records fell, three of them in the relay.',
        cover: L.blocksStart, photos: [L.sprint, L.basketballGame, L.hoop, L.courtBall, L.tennis, L.swimmer, L.boots, L.footballKick, L.footballGrass, L.cricketGround],
      }),
      event({
        id: 'nature-camp', title: 'Class 8 Nature Camp', date: '16 January 2025', venue: 'Western Ghats', category: 'student-life',
        description: 'Tents, trails and a night sky nobody had seen before.',
        story: 'Three nights under canvas with trail walks by day and astronomy by night. Nobody lost a shoe, which is a first.',
        cover: L.tent, photos: [L.stars, L.lake, L.forestPlay, L.hikers, L.lookout, L.beach],
      }),
      event({
        id: 'annual-day', title: 'Annual Day', date: '8 February 2025', venue: 'School auditorium', category: 'arts',
        description: 'Every student on stage, at least once.',
        story: 'The production ran for three hours and involved every one of the school’s classes, from the Nursery chorus to the Class 10 play.',
        cover: L.curtain, photos: [L.performer, L.screening, L.audience, L.violins, L.microphone, L.drums, L.dancer, L.confetti],
      }),
      event({
        id: 'holi', title: 'Holi, Festival of Colours', date: '13 March 2025', venue: 'Courtyard', category: 'celebrations',
        description: 'Clean uniforms in the morning. Not by noon.',
        story: 'Natural colours, music in the courtyard and a staff team that turned out to throw very accurately.',
        cover: L.holi, photos: [L.parkColours, L.paintedFace, L.peaceSigns, L.waving, L.laughingTree],
      }),
    ],
  },
  {
    id: '2023-24',
    title: '2023–24',
    subtitle: 'Finding our voice',
    span: 'June 2023 - March 2024',
    intro:
      'Clubs multiplied, the first innovators fair filled two floors, and the football league went to penalties. Five events from the year.',
    cover: L.robotCar,
    events: [
      event({
        id: 'clubs-fair', title: 'Clubs Fair', date: '8 August 2023', venue: 'Corridors and classrooms', category: 'student-life',
        description: 'Twenty-two clubs, each with one afternoon to win members.',
        story: 'Chess, debate, astronomy and robotics set up stalls along the corridors. The chess club signed up forty new members.',
        cover: L.chess, photos: [L.kidsDesks, L.twoBoys, L.boyWriting, L.blackboard, L.headDown],
      }),
      event({
        id: 'music-and-dance-evening', title: 'Music & Dance Evening', date: '26 September 2023', venue: 'School auditorium', category: 'arts',
        description: 'Strings, drums and a dance that got an encore.',
        story: 'The music wing and the dance club shared one stage for the first time. It is now an annual fixture.',
        cover: L.violins, photos: [L.guitars, L.sheetMusic, L.drums, L.dancer, L.streetDancer, L.microphone],
      }),
      event({
        id: 'young-innovators-fair', title: 'Young Innovators Fair', date: '18 November 2023', venue: 'Science laboratories', category: 'learning',
        description: 'Circuits, code and the first robot that actually worked.',
        story: 'Student teams presented to a panel of engineers from the city. The winning project, a moisture sensor for the school garden, is still running.',
        cover: L.breadboard, photos: [L.robotCar, L.calculus, L.equations, L.glassware, L.pipette, L.blocks, L.computers],
      }),
      event({
        id: 'football-league-finals', title: 'Football League Finals', date: '14 December 2023', venue: 'School pitch', category: 'sports',
        description: 'Level after full time, settled from the spot.',
        story: 'Both finals went the distance. The girls’ final was decided by a single penalty in sudden death.',
        cover: L.girlsFootball, photos: [L.footballGrass, L.footballKick, L.boots, L.huddle, L.runners],
      }),
      event({
        id: 'republic-day', title: 'Republic Day Assembly', date: '26 January 2024', venue: 'Main ground', category: 'community',
        description: 'A reading of the Preamble in every language spoken at home.',
        story: 'Students read the Preamble in eleven languages. The yoga display that followed involved the entire middle school.',
        cover: L.assembly, photos: [L.flag, L.yoga, L.girlsUniform, L.lookBack],
      }),
    ],
  },
  {
    id: '2022-23',
    title: '2022–23',
    subtitle: 'Back together',
    span: 'June 2022 - March 2023',
    intro:
      'The first full year back on campus. Classrooms filled, the ground reopened, and a class said goodbye properly. Four events from a year of returns.',
    cover: L.classroomDaylit,
    events: [
      event({
        id: 'first-day-back', title: 'The First Day Back', date: '13 June 2022', venue: 'Every classroom', category: 'learning',
        description: 'Full classrooms again, and nobody on mute.',
        story: 'After two years of screens, every class started the year in its own room. Teachers spent the first period simply learning faces.',
        cover: L.classroomDaylit, photos: [L.backpacks, L.corridor, L.girlsDesk, L.boysTextbook, L.lesson, L.handsUp, L.classroomGroups, L.attentive],
      }),
      event({
        id: 'annual-sports-meet', title: 'Annual Sports Meet', date: '9 December 2022', venue: 'Athletics ground', category: 'sports',
        description: 'The ground reopened for its first full meet in three years.',
        story: 'Parents were back in the stands. The cricket final was played under lights for the first time.',
        cover: L.cricketGround, photos: [L.sprint, L.cricketBall, L.volleyball, L.badminton, L.basketballGame, L.swimmer, L.parachute],
      }),
      event({
        id: 'annual-day-2023', title: 'Annual Day', date: '11 February 2023', venue: 'School auditorium', category: 'arts',
        description: 'A full house, a full cast, and a full-length play.',
        story: 'The first Annual Day with an audience since 2020. The hall was at capacity half an hour before curtain.',
        cover: L.audience, photos: [L.curtain, L.performer, L.screening, L.confetti, L.stringLights],
      }),
      event({
        id: 'farewell-2023', title: 'Farewell, Class of 2023', date: '10 March 2023', venue: 'Main lawn', category: 'celebrations',
        description: 'A goodbye they were not sure they would get.',
        story: 'The class whose middle school happened on screens left in person, on the lawn, in front of everyone.',
        cover: L.capsBuilding, photos: [L.gownBack, L.sunsetFriends, L.friendsLaughing, L.waving],
      }),
    ],
  },
];

/* ==========================================================================
   DERIVED - counts, lookups and links
   ========================================================================== */

export const yearPhotoCount = (year) =>
  year.events.reduce((sum, e) => sum + e.photos.length, 0);

export const GALLERY_TOTALS = {
  years: GALLERY_YEARS.length,
  events: GALLERY_YEARS.reduce((sum, y) => sum + y.events.length, 0),
  photos: GALLERY_YEARS.reduce((sum, y) => sum + yearPhotoCount(y), 0),
};

export const findYear = (yearId) => GALLERY_YEARS.find((y) => y.id === yearId);

export const findEvent = (yearId, eventId) =>
  findYear(yearId)?.events.find((e) => e.id === eventId);

export const yearHref = (year) => `${ROUTES.gallery}/${year.id}`;
export const eventHref = (year, ev) =>
  `${ROUTES.gallery}/${year.id}/${ev.id}`;

/** '7 photographs', '1 photograph'. */
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ==========================================================================
   THE HOMEPAGE'S CURATED SETS
   ========================================================================== */

export const HERO_PHOTOS = {
  main: L.waving,
  supporting: [L.sprint, L.performer, L.girlsDesk],
};

/** The editorial wall, in slot order: feature, then the five around it. */
export const GLIMPSE_PHOTOS = [
  { ...L.laughingTree, label: 'Student Life' },
  { ...L.girlsClass, label: 'Learning' },
  { ...L.paintedStones, label: 'Arts' },
  { ...L.girlsFootball, label: 'Sports' },
  { ...L.lookBack, label: 'Classroom' },
  { ...L.capsSunset, label: 'Celebrations' },
];

export const MOMENT_PHOTOS = [
  { ...L.walkGrass, caption: 'Between classes' },
  { ...L.sprint, caption: 'On the field' },
  { ...L.boysTextbook, caption: 'Learning together' },
  { ...L.holi, caption: 'A shared celebration' },
  { ...L.backpacks, caption: 'After the final bell' },
  { ...L.paintTable, caption: 'Made by many hands' },
  { ...L.twoReaders, caption: 'Reading hour' },
  { ...L.huddle, caption: 'The team talk' },
  { ...L.corridor, caption: 'First day nerves' },
  { ...L.headDown, caption: 'Quiet concentration' },
  { ...L.curtain, caption: 'Waiting in the wings' },
  { ...L.friendsLaughing, caption: 'The joke nobody explains' },
];

/** The stories the featured section can switch between. The first leads. */
export const FEATURED_STORIES = [
  ['2025-26', 'cultural-fest'],
  ['2024-25', 'annual-day'],
  ['2025-26', 'sports-day'],
  ['2025-26', 'class-10-farewell'],
]
  .map(([y, e]) => {
    const year = findYear(y);
    const ev = findEvent(y, e);
    return year && ev ? { year, event: ev } : null;
  })
  .filter((s) => s !== null);
