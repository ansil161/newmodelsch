
/**
 * Every icon on the site, hand-drawn on a 24×24 grid with a 1.5px stroke.
 * No icon library ships in the bundle — these are the only marks used.
 */
const PATHS = {
  arrowRight: (
    <>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 4v15" />
      <path d="m6 13 6 6 6-6" />
    </>
  ),
  circuit: (
    <>
      <rect x="8" y="8" width="8" height="8" rx="1.5" />
      <path d="M12 2v6M12 16v6M2 12h6M16 12h6M5.5 5.5 8 8M18.5 5.5 16 8M5.5 18.5 8 16M18.5 18.5 16 16" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  robot: (
    <>
      <rect x="4" y="8" width="16" height="11" rx="2.5" />
      <path d="M12 3v5" />
      <circle cx="12" cy="2.5" r="1.4" />
      <path d="M9 13h.01M15 13h.01" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M1.5 12v3M22.5 12v3" />
      <path d="M9.5 16.5h5" />
    </>
  ),
  atom: (
    <>
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.7 3 4 5.8 4 9s-1.3 6-4 9c-2.7-3-4-5.8-4-9s1.3-6 4-9Z" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21.5h4" />
      <path d="M12 2.5a6 6 0 0 0-3.6 10.8c.6.5.9 1.1 1 1.8l.1.9h5l.1-.9c.1-.7.4-1.3 1-1.8A6 6 0 0 0 12 2.5Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.5 4.5 5.5v6c0 4.7 3.1 8.6 7.5 10 4.4-1.4 7.5-5.3 7.5-10v-6L12 2.5Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  // Added for the sign-in form's show/hide password control.
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.6 6.1c.5-.1.9-.1 1.4-.1 6 0 9.5 6 9.5 6a17.6 17.6 0 0 1-2.6 3.4" />
      <path d="M6.6 7.6C4 9.3 2.5 12 2.5 12s3.5 6 9.5 6c1.6 0 3-.4 4.3-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </>
  ),
  // Added for the Safety & Wellbeing measures.
  camera: (
    <>
      <path d="M3.5 8.5a2 2 0 0 1 2-2h2.2l1.4-2h5.8l1.4 2h2.2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-9Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  bus: (
    <>
      <rect x="4.5" y="3" width="15" height="15.5" rx="2.5" />
      <path d="M4.5 12h15M4.5 7.5h15" />
      <path d="M8 15.3h.01M16 15.3h.01" strokeWidth="2.2" />
      <path d="M7 18.5v2M17 18.5v2" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  phone: (
    <path d="M6.2 3h3l1.5 4-2 1.4a12.5 12.5 0 0 0 6.9 6.9l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 4.2 5.2 2 2 0 0 1 6.2 3Z" />
  ),
  star: (
    <path d="m12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9L12 3.5Z" />
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17M8 2.5v5M16 2.5v5" />
    </>
  ),
  // Added for the multi-page blueprint: navigation, filtering and resources.
  arrowLeft: (
    <>
      <path d="M20 12H5" />
      <path d="m11 6-6 6 6 6" />
    </>
  ),
  arrowUpRight: (
    <>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </>
  ),
  chevronDown: <path d="m5 9 7 7 7-7" />,
  /* Solid, unlike the rest of the set: a stroked triangle reads as an
     outline at play-button size rather than as a play mark. */
  play: (
    <path
      d="M8.5 5.4v13.2a1 1 0 0 0 1.53.85l10.4-6.6a1 1 0 0 0 0-1.7L10.03 4.55A1 1 0 0 0 8.5 5.4Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.2 16.2 4.3 4.3" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4 17.5v1.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
    </>
  ),
  document: (
    <>
      <path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5L14 2.5Z" />
      <path d="M13.5 2.8V8h5" />
      <path d="M8.5 13h7M8.5 16.5h4.5" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3.5 6.5 8.5 6 8.5-6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.5s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10.5" r="2.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.3l3.4 2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.9a3.5 3.5 0 0 1 0 6.2" />
      <path d="M17.5 14.4A6.5 6.5 0 0 1 21.5 20" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5A2 2 0 0 1 6 2.5h13v16H6a2 2 0 0 0-2 2v-16Z" />
      <path d="M4 18.5a2 2 0 0 1 2-2h13v5H6a2 2 0 0 1-2-2v-1Z" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  // Added for the admission entry points: a first leaf, a stack of play
  // blocks, and a mortarboard.
  sprout: (
    <>
      <path d="M12 21v-8.5" />
      <path d="M12 12.5C12 8.4 9.2 5.5 4.5 5.5c0 4.1 2.8 7 7.5 7Z" />
      <path d="M12 15c0-3.6 2.5-6.2 6.5-6.2 0 3.6-2.5 6.2-6.5 6.2Z" />
      <path d="M8 21h8" />
    </>
  ),
  blocks: (
    <>
      <rect x="3.5" y="12.5" width="8" height="8" rx="1.2" />
      <rect x="12.5" y="12.5" width="8" height="8" rx="1.2" />
      <path d="M12 3.5 16.2 10H7.8L12 3.5Z" />
    </>
  ),
  cap: (
    <>
      <path d="M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Z" />
      <path d="M6.5 11v4.6c0 1.4 2.5 2.9 5.5 2.9s5.5-1.5 5.5-2.9V11" />
      <path d="M21.5 9v5.5" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.5c.7 4 1.8 5.1 5.8 5.8-4 .7-5.1 1.8-5.8 5.8-.7-4-1.8-5.1-5.8-5.8 4-.7 5.1-1.8 5.8-5.8Z" />
      <path d="M18 16c.3 1.8.8 2.3 2.6 2.6-1.8.3-2.3.8-2.6 2.6-.3-1.8-.8-2.3-2.6-2.6 1.8-.3 2.3-.8 2.6-2.6Z" />
    </>
  ),
  /* Solid, like `play`: a stroked sparkle thins to nothing at small sizes on
     a coloured ground; a filled one holds. */
  spark: (
    <>
      <path
        d="M10.7 5c.8 4.4 3.1 6.7 7.5 7.5-4.4.8-6.7 3.1-7.5 7.5-.8-4.4-3.1-6.7-7.5-7.5 4.4-.8 6.7-3.1 7.5-7.5Z"
        fill="currentColor"
        stroke="none"
      />
      <path
        d="M18.2 4c.3 1.6 1 2.3 2.6 2.6-1.6.3-2.3 1-2.6 2.6-.3-1.6-1-2.3-2.6-2.6 1.6-.3 2.3-1 2.6-2.6Z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10.3 9.5 5 2.5-5 2.5v-5Z" fill="currentColor" stroke="none" />
    </>
  ),
  facebook: (
    <path d="M14.5 8.5V6.8c0-.8.4-1.3 1.4-1.3h1.6V2.6h-2.7c-2.6 0-3.9 1.6-3.9 3.9v2h-2.4v3h2.4v9.9h3.6v-9.9h2.5l.4-3h-2.9Z" />
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7.4 10.2v7M7.4 7.1v.01" strokeLinecap="round" strokeWidth="2" />
      <path d="M11.4 17.2v-4a2.6 2.6 0 0 1 5.2 0v4" />
      <path d="M11.4 10.2v7" />
    </>
  ),
  // Added for the admin console.
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12.5 9 5 9-5" />
      <path d="m3 16.5 9 5 9-5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.5V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 17.5v1.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.2 1.2" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.2-1.2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 20v-4h-4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 20l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  activity: <path d="M3 12h4l2.5-6 5 12L17 12h4" />,
  message: (
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5v-9Z" />
  ),
  send: (
    <>
      <path d="M21 3 3 10.5l7.5 3L14 21l7-18Z" />
      <path d="m10.5 13.5 4-4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3" />
      <path d="M7 15h10" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3.5 4v4h4" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 2.8 19.5h18.4L12 4Z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.2v.01" strokeWidth="2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.8v.01" strokeWidth="2" />
    </>
  ),
  stop: (
    <>
      <circle cx="12" cy="12" r="9" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </>
  ),
  externalLink: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </>
  ),
  // Added for the prospectus: the studio, the field and the stage.
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.1 0 1.8-.7 1.8-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7h2.1a3.9 3.9 0 0 0 3.9-3.9c0-4.1-3.8-7.4-8.5-7.4Z" />
      <circle cx="7.6" cy="11.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9.8" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  ball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 8.2 3.4 2.4-1.3 4H9.9l-1.3-4L12 8.2Z" />
      <path d="M12 8.2V3M15.4 10.6l5-1.6M14.1 14.6l3.1 4.2M9.9 14.6l-3.1 4.2M8.6 10.6l-5-1.6" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5v4M8.5 21.5h7" />
    </>
  ),
  chevronRight: <path d="m9 5 7 7-7 7" />,
  filter: <path d="M4 5h16l-6 7.5V19l-4 1.5v-8L4 5Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  logout: (
    <>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="m15 16 4-4-4-4" />
      <path d="M19 12H9" />
    </>
  ),
};

export function Icon({ name, size = 24, ...rest }) {
  const glyph = PATHS[name];
  if (!glyph) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {glyph}
    </svg>
  );
}
