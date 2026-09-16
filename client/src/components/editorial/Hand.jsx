

/* Each entry: the viewBox, and the strokes in the order a hand makes them.
   Order matters - the drawing tween staggers through them, so a shaft is
   drawn before the head that finishes it. */
const MARKS = {
  /* The lasso. Starts under the headline side, runs out under the photograph,
     turns back on itself and leaves - the gesture on the reference. */
  loop: {
    box: '0 0 600 230',
    strokes: [
      'M6 152c78 36 236 48 366 12 92-26 164-74 150-118-12-38-86-34-104 12-20 52 36 110 126 104 26-2 44-10 52-18',
    ],
  },

  /* A long path that wanders rather than loops - for the spread about a
     journey, where the line is the thing the photographs sit along. */
  path: {
    box: '0 0 640 260',
    strokes: [
      'M4 214c64 22 150 30 222 4 70-26 96-86 170-104 70-18 120 26 174 10 30-9 50-30 64-52',
    ],
  },

  /* The underline beneath a handwritten word: one confident pass and a
     shorter second one, because nobody underlines only once. */
  swash: {
    box: '0 0 240 34',
    strokes: ['M4 20c40-8 98-12 158-10 26 1 50 4 74 8', 'M46 30c42-5 96-6 150-2'],
  },

  /* Three ticks of emphasis radiating off a corner. */
  sparks: {
    box: '0 0 64 64',
    strokes: ['M26 46c-6-3-12-6-19-8', 'M33 37c-2-8-3-16-2-25', 'M42 42c5-6 10-11 16-15'],
  },

  /* A gentle curved arrow with a two-flick head. Leaves to the right; `flip`
     sends it left. */
  arrow: {
    box: '0 0 92 58',
    strokes: ['M4 12c22-8 50-4 70 22', 'M59 31l16 5 1-16'],
  },

  'arrow-down': {
    box: '0 0 56 84',
    strokes: ['M10 4c20 12 30 34 26 68', 'M24 60l12 14 9-16'],
  },

  /* A loose ring, overshooting at the join the way a pen does. Drawn round a
     detail in a photograph, not round a word - the headlines have their own. */
  ring: {
    box: '0 0 220 150',
    strokes: [
      'M128 10C68 2 14 28 8 72c-6 42 48 70 110 68 60-2 98-32 96-70-2-36-46-58-104-60-18 0-34 2-48 8',
    ],
  },

  /* A four-point sparkle, drawn in one pass. */
  star: {
    box: '0 0 44 44',
    strokes: [
      'M22 4c1 7 3 12 7 15 4 3 9 3 13 3-5 1-10 3-13 6-3 4-5 9-6 13-1-5-3-10-6-13-4-3-8-4-13-5 5-1 10-2 13-5 3-4 4-8 5-14Z',
    ],
  },

  /* The pale blue wash behind a collage: one body of colour and two dry
     strokes off its edge, so it reads as a brush laid down rather than as a
     shape with a fill. */
  brush: {
    box: '0 0 420 320',
    fills: [
      'M46 138c16-66 104-104 196-96 92 8 164 62 150 138-14 74-110 116-206 104C88 274 28 210 46 138Z',
    ],
    strokes: ['M58 262c70-24 176-32 300-10', 'M96 50c56-12 138-16 232 6'],
  },
};

export function Hand({ kind, tone = 'sun', flip = false, className = '', style }) {
  const mark = MARKS[kind];
  return (
    <svg
      className={`hand-mark hand-mark--${kind} hand-mark--${tone}${flip ? ' is-flipped' : ''} ${className}`.trim()}
      viewBox={mark.box}
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {mark.fills?.map((d) => <path key={d} d={d} data-fill="" />)}
      {mark.strokes.map((d) => (
        <path key={d} d={d} pathLength={1} data-stroke="" />
      ))}
    </svg>
  );
}
