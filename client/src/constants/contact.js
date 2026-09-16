import { img } from './media';

/* ==========================================================================
   CONTACT & VISIT
   --------------------------------------------------------------------------
   A lightweight standalone page. It exists because some parents need a
   conversation before they will consider applying, so it should read as an
   invitation rather than as a technical footer.
   ========================================================================== */

export const CONTACT_INTRO = {
  eyebrow: 'Come and see us',
  title: 'The gate is open on a working morning.',
  lead: 'Call, write, or simply arrive on a Tuesday. The most useful thing you can do before choosing a school is stand in its corridor while the lessons are running.',
  image: img('1592280771190-3e2e4d571952', 1600),
  imageAlt: 'The school entrance and courtyard',
};

export const CONTACT_CHANNELS = [
  {
    id: 'admissions',
    icon: 'phone',
    label: 'Admissions office',
    value: '+91 40 2345 6789',
    href: 'tel:+914023456789',
    detail: 'Monday to Saturday, 8:30 am - 4:30 pm',
  },
  {
    id: 'email',
    icon: 'globe',
    label: 'Admissions email',
    value: 'admissions@newmodelhighschool.edu.in',
    href: 'mailto:admissions@newmodelhighschool.edu.in',
    detail: 'Answered within one working day',
  },
  {
    id: 'principal',
    icon: 'star',
    label: 'Principal’s office',
    value: 'principal@newmodelhighschool.edu.in',
    href: 'mailto:principal@newmodelhighschool.edu.in',
    detail: 'For matters that need the head directly',
  },
  {
    id: 'transport',
    icon: 'shield',
    label: 'Transport desk',
    value: '+91 40 2345 6795',
    href: 'tel:+914023456795',
    detail: 'Routes, pickup points and bus queries',
  },
];

/**
 * `day` and `hours` are what a reader sees. `days` (0 = Sunday), `opens` and
 * `closes` are the same hours as data, in the school's own time zone, for the
 * footer's open-now indicator. Public holidays are not known to the site.
 */
export const OFFICE_HOURS = [
  { day: 'Monday - Friday', hours: '8:30 am - 4:30 pm', days: [1, 2, 3, 4, 5], opens: '08:30', closes: '16:30' },
  { day: 'Saturday', hours: '8:30 am - 1:00 pm', days: [6], opens: '08:30', closes: '13:00' },
  { day: 'Sunday & public holidays', hours: 'Closed', days: [0] },
];

export const SCHOOL_TIME_ZONE = 'Asia/Kolkata';

export const DIRECTIONS = {
  address: 'Doodh Bowli Road, Kabutar Khana, Bahadurpura, Hyderabad, Telangana',
  mapsHref: 'https://maps.google.com/?q=Doodh+Bowli+Road,+Kabutar+Khana,+Bahadurpura,+Hyderabad',
  routes: [
    {
      id: 'road',
      title: 'By road',
      detail:
        'Off Doodh Bowli Road at Kabutar Khana, in Bahadurpura. Visitor parking is inside the second gate; the first gate is student drop-off only between 7:40 and 8:15 am.',
    },
    {
      id: 'metro',
      title: 'By metro',
      detail:
        'MGBS on the Green Line is the nearest station while the Old City corridor is still under construction - a short auto ride from there through Doodh Bowli.',
    },
    {
      id: 'bus',
      title: 'By city bus',
      detail:
        'City buses running towards Bahadurpura and Nehru Zoological Park stop within a few minutes’ walk of Kabutar Khana.',
    },
  ],
};

export const ENQUIRY_SUBJECTS = [
  'Admissions',
  'Campus visit',
  'Transport',
  'Documentation',
  'Current parent query',
  'Something else',
];
