import type { MouseEvent } from 'react';
import { VALUES } from '@/constants';
import { academicImages, resolve, resolveSet, sportsImages, studentImages } from '@/constants/imagery';
import type { Photo } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { lines, reduced, rise } from '@/lib/motion';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import type { ValuePillar } from '@/types';
import './charter.css';

/* ==========================================================================
   05 - THE CHARTER
   --------------------------------------------------------------------------
   Six things the school says it will not trade, set as a continuous
   editorial list: one ruled row per principle, all six on the page.

     [01] [Label]              the argument           [ photograph ]
                                                      [            ]
     Title, set at the foot    READ MORE ->           [            ]

   The row is three columns tied to the photograph's height. The chips and
   the argument hang from the top edge of the picture, the title and the link
   stand on its bottom edge, and a hairline separates one row from the next.
   No boxes, no shadows, no pin.

   WHAT MOVES

     the page scrolls     each row is carried up into place by the scroll
                          itself: its rule draws from the left, then the
                          three columns rise in reading order - words,
                          argument, photograph - and settle by the time the
                          row is a third of the way up the screen. Scrubbed,
                          so the reader owns the speed and can reverse it.
     a row takes focus    the row crossing the middle of the screen is the
                          active one - or the one under the pointer, which
                          always wins. Its title rolls: the ink line slides up
                          out of its mask and the accent line follows it in.
                          The link's arrow is exchanged the same way and its
                          rule is drawn.

   Nothing carries information. The practices and the figure behind each
   principle sit behind a real button, and every word is reachable with
   motion off or JavaScript still loading.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Content
   --------------------------------------------------------------------------
   The words are VALUES, unchanged - the charter is a record and this section
   does not get to rewrite it. Only the photograph and the one-word label are
   chosen here, paired to the principle rather than mapped by index.
   -------------------------------------------------------------------------- */

const PHOTOS: Photo[] = [
  studentImages[1], // 01 known         - a child working with a teacher
  academicImages[0], // 02 rigour        - a problem worked through with seniors
  academicImages[2], // 03 curiosity     - a robot being assembled
  sportsImages[3], // 04 character       - a team, after the fixture
  academicImages[3], // 05 honesty       - the working, on the page
  studentImages[5], // 06 belonging      - Class 10, on the way out
];

const LABELS: Record<string, string> = {
  known: 'Pastoral care',
  rigour: 'Standards',
  curiosity: 'Making',
  character: 'Character',
  honesty: 'Reporting',
  belonging: 'Community',
};

interface CharterEntry extends ValuePillar {
  photo: Photo;
  label: string;
}

const ENTRIES: CharterEntry[] = VALUES.map((value, i) => ({
  ...value,
  photo: PHOTOS[i % PHOTOS.length],
  label: LABELS[value.id] ?? 'Principle',
}));

/* The line a row has to cross to take focus. */
const FOCUS = '56%';

/* ==========================================================================
   The section
   ========================================================================== */

export function AboutCharter() {
  const { scrollTo } = useSmoothScroll();

  const scope = useGsapScope<HTMLElement>((_ctx, root) => {
    const title = root.querySelector<HTMLElement>('.charter__title');
    if (title) lines(title, { trigger: root });
    rise(root.querySelectorAll<HTMLElement>('[data-intro]'), {
      trigger: root,
      y: 16,
      delay: 0.2,
    });

    const rows = gsap.utils.toArray<HTMLElement>('.ch-row', root);

    /* Focus. A state, not motion, so it is built whether or not motion is
       allowed - reduced motion stops things travelling, it does not take the
       active row away. */
    rows.forEach((row) => {
      ScrollTrigger.create({
        trigger: row,
        start: `top ${FOCUS}`,
        end: `bottom ${FOCUS}`,
        toggleClass: { targets: row, className: 'is-current' },
      });
    });

    if (reduced()) return;

    /* The scroll. One scrubbed timeline per row, so the six are carried up in
       sequence by the page rather than each firing on its own clock. Travel
       is short on a phone, where a row is already most of the screen. */
    const mm = gsap.matchMedia(root);
    mm.add({ wide: '(min-width: 700px)', narrow: '(max-width: 699px)' }, (self) => {
      const travel = self.conditions?.wide ? 64 : 36;

      rows.forEach((row) => {
        const rule = row.querySelector<HTMLElement>('.ch-row__rule');
        /* On a phone the lead column is `display: contents` - it has no box to
           move - so its two parts are carried in their stacked order. */
        const cols = self.conditions?.wide
          ? row.querySelectorAll<HTMLElement>('[data-col]')
          : row.querySelectorAll<HTMLElement>(
              '.ch-row__chips, .ch-row__media, .ch-row__title, .ch-row__text',
            );

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: row,
            start: 'top bottom',
            end: 'top 62%',
            scrub: 0.5,
          },
        });

        if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0);
        tl.fromTo(
          cols,
          { y: travel, opacity: 0.15 },
          { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: 'power1.out' },
          0.05,
        );
      });
    });

    return () => mm.revert();
  }, []);

  const toPrincipal = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    scrollTo('#principal', -24);
  };

  return (
    <section ref={scope} className="section charter" id="values" aria-labelledby="charter-title">
      <div className="wrap">
        <header className="charter__head">
          <div className="charter__head-copy">
            <p className="charter__eyebrow" data-intro>
              The charter
            </p>
            <h2 className="charter__title" id="charter-title">
              Six things we will not trade.
            </h2>
            <p className="charter__lead" data-intro>
              Written in 1962 and never amended - each with the two practices that hold it up.
            </p>
          </div>

          <div data-intro>
            <a className="charter__cta btn btn-primary" href="#principal" onClick={toPrincipal}>
              <span className="btn__label">
                The principal&rsquo;s letter
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M2.5 8h10.5M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
            </a>
          </div>
        </header>

        <ol className="charter__list">
          {ENTRIES.map((entry) => (
            <CharterRow entry={entry} key={entry.id} />
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ==========================================================================
   One row
   --------------------------------------------------------------------------
   Three `[data-col]` wrappers, written in reading order. GSAP owns their
   transform and opacity; the roll, the arrow and the rule underneath the link
   live on elements inside them, so no two animations write one property.
   ========================================================================== */

function CharterRow({ entry }: { entry: CharterEntry }) {
  const panelId = `charter-panel-${entry.id}`;

  return (
    <li className="ch-row" id={`charter-${entry.id}`}>
      <span className="ch-row__rule" aria-hidden="true" />

      <div className="ch-row__lead" data-col>
        <div className="ch-row__chips">
          <span className="ch-row__chip ch-row__chip--index">{entry.index}</span>
          <span className="ch-row__chip">{entry.label}</span>
        </div>

        <h3 className="ch-row__title">
          <span className="ch-roll">
            <span className="ch-roll__line">{entry.title}</span>
            <span className="ch-roll__line ch-roll__line--next" aria-hidden="true">
              {entry.title}
            </span>
          </span>
        </h3>
      </div>

      <div className="ch-row__text" data-col>
        <p className="ch-row__body">{entry.description}</p>

        <div
          className="ch-row__panel"
          id={panelId}
          onTransitionEnd={(event) => {
            // The row changed height; every trigger below it has moved.
            if (event.propertyName === 'grid-template-rows') ScrollTrigger.refresh();
          }}
        >
          <div className="ch-row__panel-inner">
            <ul className="ch-row__proof">
              {entry.proof.map((point) => (
                <li key={point.slice(0, 24)}>{point}</li>
              ))}
            </ul>
            <p className="ch-row__mark">
              <b>{entry.mark.value}</b>
              <span>{entry.mark.label}</span>
            </p>
          </div>
        </div>
      </div>

      <figure className="ch-row__media" data-col>
        <div className="ch-row__frame">
          <img
            className="ch-row__img"
            src={resolve(entry.photo, 960)}
            srcSet={resolveSet(entry.photo, [480, 720, 960, 1280])}
            sizes="(max-width: 699px) calc(100vw - 40px), (max-width: 1023px) 40vw, 30vw"
            alt={entry.photo.alt}
            width={960}
            height={540}
            loading="lazy"
            decoding="async"
            style={entry.photo.focus ? { objectPosition: entry.photo.focus } : undefined}
          />
        </div>
      </figure>
    </li>
  );
}
