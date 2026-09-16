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

export const OFFICE_HOURS = [
  { day: 'Monday - Friday', hours: '8:30 am - 4:30 pm' },
  { day: 'Saturday', hours: '8:30 am - 1:00 pm' },
  { day: 'Sunday & public holidays', hours: 'Closed' },
];

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
