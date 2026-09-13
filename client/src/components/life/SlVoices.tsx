import { useState } from 'react';
import { STUDENT_FILMS, STUDENT_VOICES } from '@/constants';
import { resolve } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger, gsap } from '@/lib/gsap';
import { drift, reduced, rise, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Figure, Mark, SectionHead } from '@/components/editorial';
import './voices.css';

/* ==========================================================================
   04 - IN THEIR OWN WORDS
   --------------------------------------------------------------------------
   Four students on film, as four vertical panels in one row. The panel under
   the pointer opens; the other three stay as slats with the student's name
   set up their edge. Pressing one plays it.

   WHY A REEL AND NOT A GRID OF PLAYERS

   Four thumbnails in a row is four decisions asked at once, and a parent who
   has to choose which stranger to watch usually watches none of them. One
   panel open at a time makes the section a single object with a default: the
   reader arrives already looking at Aarav, and moving sideways is a smaller
   act than starting something.

   It is also the only composition on this page that is horizontal without
   being a strip. The wall above it scrolls sideways; this does not move at
   all - the panels change width in place. Two horizontal sections that share
   a direction but not a mechanic read as two sections. Two that share both
   read as one thing repeated.

   THE QUOTE IS THE SECTION. THE FILM IS THE EVIDENCE.

   Every student's line is in the DOM for all four panels, always, and the
   collapsed ones are clipped visually rather than removed. So a screen reader
   gets four testimonials, find-in-page finds all four, and a reader who never
   presses play still leaves having been told four specific things by four
   named children. The clips are what makes those lines checkable.

   NOTHING AUTOPLAYS, AND NOTHING PRELOADS.

   Same contract as the school film on About: `preload="none"`, real controls,
   and the file is served straight out of `public/videos/voices/` so the
   school drops the clips in without a code change. Until they do, the src
   404s - which is handled out loud rather than left as a dead black frame.

   THE MOTION, IN THREE PARTS

   1. THE PRINT (once, on arrival). The four panels unmask from the bottom in
      sequence, at the site's standard stagger. They arrive as four equal
      slats, because that is what they are before the reader has chosen.

   2. THE OPEN (once, 0.9s later). The first panel steps forward. This is the
      section's one composed beat and the reason the panels arrive equal: the
      row shows the reader what it does before asking them to do it. It is a
      class flip, not a tween - the width change is a CSS transition on
      `flex-grow`, so the same 900ms curve serves the entrance and every
      pointer move afterwards, and the two can interrupt each other cleanly.

   3. THE DEPTH (scrubbed, tiny). Each poster travels a few pixels against its
      own panel, alternating amounts down the row. The images are 112% tall
      and offset up, so there is real material to move and no edge is ever
      exposed.

   With reduced motion the row is simply open on the first panel from the
   first frame - no print, no step forward, no parallax. Not a faster version;
   the finished one.
   ========================================================================== */

export function SlVoices() {
  /** Which panel is open. Hover, focus and press all set it. */
  const [active, setActive] = useState(0);
  /**
   * Whether any panel is open at all. Starts closed so the row can arrive as
   * four equal slats and then step forward - except under reduced motion,
   * where the finished state is the only state.
   *
   * There is no server render to disagree with, so deciding this on the first
   * client render is safe and avoids the open-then-close flash that setting
   * it from the effect would cause.
   */
  const [open, setOpen] = useState(() => reduced());
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const scope = useGsapScope<HTMLElement>((_, el) => {
    const cards = el.querySelectorAll<HTMLElement>('.reel__card');

    unmask(cards, { trigger: el, from: 'bottom', stagger: 0.1 });
    rise(el.querySelectorAll<HTMLElement>('.reel__foot > *'), {
      trigger: el,
      delay: 0.95,
      y: 16,
    });

    // Alternating amounts, so the row breathes instead of sliding as one
    // sheet. Both values are small enough that the movement is felt before it
    // is seen, which is the test for every parallax on this site.
    cards.forEach((card, i) => {
      drift(card.querySelector('.reel__shot img'), i % 2 ? 30 : 52, { trigger: el });
    });

    if (reduced()) return;

    // Held until the panels have finished printing. A row that opens while it
    // is still arriving reads as two animations fighting; held back, it reads
    // as one gesture with a beat in it.
    ScrollTrigger.create({
      trigger: el,
      start: 'top 82%',
      once: true,
      onEnter: () => {
        gsap.delayedCall(0.9, () => setOpen(true));
      },
    });
  }, []);

  /** Hover, focus, or the first press. Never while something is playing. */
  const look = (i: number) => {
    if (playing) return;
    setOpen(true);
    setActive(i);
  };

  const play = (i: number) => {
    setActive(i);
    setOpen(true);
    setFailed(false);
    setPlaying(true);
  };

  const stop = () => {
    setPlaying(false);
    setFailed(false);
  };

  const total = String(STUDENT_FILMS.length).padStart(2, '0');

  return (
    <section ref={scope} className="section reel on-navy" id="voices">
      <div className="wrap">
        <SectionHead
          sticker={`04 · ${STUDENT_VOICES.eyebrow}`}
          stickerTone="paper"
          stickerTilt={2.4}
          title={
            <>
              Do not take our word for it. Take <Mark kind="underline">theirs.</Mark>
            </>
          }
          lead={STUDENT_VOICES.lead}
          className="reel__head"
        />

        <ul className="reel__cast" data-open={open ? 'true' : 'false'}>
          {STUDENT_FILMS.map((film, i) => {
            const on = i === active;
            const live = on && playing && !failed;

            return (
              <li
                key={film.id}
                className={`reel__card${on ? ' is-on' : ''}${live ? ' is-live' : ''}`}
                onMouseEnter={() => look(i)}
              >
                {live ? (
                  <>
                    <video
                      className="reel__video"
                      src={film.src}
                      poster={resolve(film.poster, 900)}
                      controls
                      autoPlay
                      playsInline
                      preload="none"
                      onError={() => {
                        setFailed(true);
                        setPlaying(false);
                      }}
                    >
                      {film.captions ? (
                        <track
                          kind="captions"
                          src={film.captions}
                          srcLang="en"
                          label="English"
                          default
                        />
                      ) : null}
                    </video>

                    <button type="button" className="reel__stop" onClick={stop}>
                      <Icon name="arrowLeft" size={15} />
                      <span>Back to the reel</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Figure
                      photo={film.poster}
                      width={900}
                      widths={[420, 640, 900, 1280]}
                      sizes="(max-width: 899px) 92vw, (max-width: 1199px) 46vw, 34vw"
                      shape="square"
                      ratio="free"
                      className="reel__shot"
                      decorative
                    />
                    <span className="reel__scrim" aria-hidden="true" />

                    {/* Reads bottom-to-top up the closed edge. Hidden from
                        assistive tech because the same name is announced by
                        the button label a line below it. */}
                    <span className="reel__spine" aria-hidden="true">
                      <b>{film.name}</b>
                      <i>{film.role}</i>
                    </span>

                    {/* In the panel's own corner rather than above the
                        quote: it belongs to the reel, not to the sentence,
                        and it is the one piece of furniture a slat can carry
                        without crowding the name up its edge. */}
                    <p className="reel__index meta" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')} / {total}
                    </p>

                    <div className="reel__body">
                      <blockquote className="reel__pull">
                        <p>{film.pull}</p>
                      </blockquote>

                      <p className="reel__who">
                        <b>{film.name}</b>
                        <span className="meta">{film.role}</span>
                      </p>

                      <button
                        type="button"
                        className="reel__play"
                        onFocus={() => look(i)}
                        onClick={() => play(i)}
                        data-cursor="Play"
                      >
                        <span className="reel__ring" aria-hidden="true">
                          <Icon name="play" size={16} />
                        </span>
                        <span className="reel__cue">
                          {on && failed ? 'Try again' : `Play · ${film.runtime}`}
                        </span>
                        <span className="sr-only">
                          {`Play ${film.name}, ${film.role}, ${film.runtime}`}
                        </span>
                      </button>

                      {on && failed ? (
                        <p className="reel__error" role="status">
                          This clip is not on the server yet. Drop the file at{' '}
                          <code>public{film.src}</code> and it plays with no other change.
                        </p>
                      ) : null}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        <div className="reel__foot">
          <p className="meta">{STUDENT_VOICES.footnote}</p>
        </div>
      </div>
    </section>
  );
}
