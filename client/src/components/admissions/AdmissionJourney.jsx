import { useEffect, useRef, useState } from 'react';
import { ADMISSION_JOURNEY, JOURNEY_FILM } from '@/constants/admissions';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Hand } from '@/components/editorial';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import './admission-journey.css';

/* ==========================================================================
   02 - THE SIX STEPS
   --------------------------------------------------------------------------
   An editorial spread on warm ivory.

     the copy (52%)        eyebrow, the serif headline, a narrow paragraph,
                           then ONE landscape film in a cut-paper frame, with
                           two thin pen arcs and a handwritten note round it
     the timeline (48%)    one continuous hairline, six nodes on it; each step
                           is a number, a line icon, a serif title, two lines
                           of copy, how long it takes, and where to go next

   THE TIMELINE IS A PROGRESS INDICATOR, NOT A FLOURISH.

   The step nearest the reading line is marked as current, the rail behind it
   fills as the reader moves to the next one, and that state is kept even for
   a reader who has asked for reduced motion - only the movement is dropped.

   MOTION, AND WHO OWNS WHICH TRANSFORM

     [data-aj-rise]              entrance: y, opacity
     .aj-draw [data-stroke]      entrance: the pen strokes draw in
     .aj__frame                  entrance: scale, opacity
     .aj__media                  hover: GSAP scale to 1.02
     .aj-step__rail              entrance: drawn top to bottom, segment by segment
     .aj-step__fill              scroll: scrubbed between one node and the next
     .aj-step__dot               entrance: scale, opacity
     .aj-step__node              state (CSS): active / done / hover
     .aj-step__num, __icon, __body   entrance: x, opacity
   ========================================================================== */

/* The cut-paper frame, in the frame's own 0-1 box. The top edge climbs very
   slightly from left to right, the two left corners are heavy and the two
   right ones light - a rectangle that was trimmed by hand, not a pill. */
const FRAME_PATH =
  'M0,0.22 C0,0.11 0.035,0.05 0.1,0.045 L0.945,0.002 C0.978,0 1,0.028 1,0.085 L1,0.875 C1,0.945 0.968,1 0.92,1 L0.125,1 C0.052,1 0,0.94 0,0.82 Z';

/* The reading line: a step becomes current when its node crosses it. */
const LINE = 'center 58%';

export function AdProcess() {
  const { scrollTo } = useSmoothScroll();

  const scope = useGsapScope((_, root) => {
    const steps = gsap.utils.toArray('.aj-step', root);
    const nodes = steps.map((step) => step.querySelector('.aj-step__node'));
    const list = root.querySelector('.aj-steps');

    /* 1 - which step is current. Built for every reader. */
    const setActive = (index) => {
      steps.forEach((step, i) => {
        step.classList.toggle('is-active', i === index);
        step.classList.toggle('is-done', i < index);
      });
    };
    setActive(0);

    nodes.forEach((node, i) => {
      if (!node) return;
      const next = nodes[i + 1];
      ScrollTrigger.create({
        trigger: node,
        start: LINE,
        endTrigger: next ?? list,
        end: next ? LINE : 'bottom top',
        onToggle: (self) => {
          if (self.isActive) setActive(i);
        },
      });
    });

    if (reduced()) return;

    /* 2 - the copy, the frame and the pen */
    gsap
      .timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: { trigger: root, start: 'top 72%', once: true },
      })
      .from('[data-aj-rise]', { opacity: 0, y: 22, duration: 0.8, stagger: 0.08, clearProps: 'opacity,transform' })
      .from('.aj__frame', { opacity: 0, scale: 0.97, duration: 1.1, clearProps: 'opacity,transform' }, 0.25)
      .fromTo(
        root.querySelectorAll('.aj-draw [data-stroke]'),
        { strokeDasharray: 1, strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut', stagger: 0.14 },
        0.6,
      )
      .from('.aj__note', { opacity: 0, x: -10, duration: 0.8, clearProps: 'opacity,transform' }, 0.9);

    /* 3 - the timeline: the rail draws down, each node arriving as the line
       reaches it, the text a beat behind. */
    const SEGMENT = 0.22;
    gsap
      .timeline({ scrollTrigger: { trigger: list, start: 'top 78%', once: true } })
      .from('.aj-step__rail', {
        scaleY: 0,
        transformOrigin: 'top center',
        duration: SEGMENT,
        ease: 'none',
        stagger: SEGMENT,
        clearProps: 'transform',
      }, SEGMENT * 0.5)
      .from('.aj-step__dot', {
        opacity: 0,
        scale: 0.4,
        duration: 0.5,
        ease: 'power2.out',
        stagger: SEGMENT,
        clearProps: 'opacity,transform',
      }, 0)
      .from(['.aj-step__num', '.aj-step__icon', '.aj-step__body'], {
        opacity: 0,
        x: 14,
        duration: 0.7,
        ease: 'power3.out',
        stagger: { each: SEGMENT / 3 },
        clearProps: 'opacity,transform',
      }, 0.08);

    /* 4 - the rail fills as the reader moves from one node to the next */
    steps.slice(0, -1).forEach((step, i) => {
      gsap.fromTo(
        step.querySelector('.aj-step__fill'),
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: nodes[i],
            start: LINE,
            endTrigger: nodes[i + 1],
            end: LINE,
            scrub: 0.4,
          },
        },
      );
    });

    /* 5 - the film leans in, barely, under a pointer */
    const film = root.querySelector('.aj__film');
    const media = root.querySelector('.aj__media');
    if (!film || !media || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const lean = (to) =>
      gsap.to(media, { scale: to, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
    const enter = () => lean(1.02);
    const leave = () => lean(1);
    film.addEventListener('mouseenter', enter);
    film.addEventListener('mouseleave', leave);

    return () => {
      film.removeEventListener('mouseenter', enter);
      film.removeEventListener('mouseleave', leave);
      gsap.killTweensOf(media);
      gsap.set(media, { clearProps: 'transform' });
    };
  }, []);

  const jump = (target) => (event) => {
    event.preventDefault();
    scrollTo(target, -80);
  };

  return (
    <section ref={scope} className="aj" id="process" aria-labelledby="aj-title">
      <svg className="aj__defs" width="0" height="0" aria-hidden="true" focusable="false">
        <clipPath id="aj-frame-clip" clipPathUnits="objectBoundingBox">
          <path d={FRAME_PATH} />
        </clipPath>
      </svg>

      <span className="aj__shape aj__shape--1" aria-hidden="true" />
      <span className="aj__shape aj__shape--2" aria-hidden="true" />
      <span className="aj__shape aj__shape--3" aria-hidden="true" />

      <div className="wrap">
        <div className="aj__grid">
          <div className="aj__copy">
            <p className="aj__eyebrow" data-aj-rise>
              <i aria-hidden="true" />
              The journey
            </p>

            <h2 className="aj__title" id="aj-title" data-aj-rise>
              <span className="aj__line">Six steps, about six</span>{' '}
              <span className="aj__line">weeks, and no step</span>{' '}
              <strong className="aj__line">
                happens{' '}
                <span className="aj__underline">
                  off this page.
                  <Hand kind="swash" tone="sun" className="aj__swash aj-draw" />
                </span>
              </strong>
            </h2>

            <p className="aj__lead" data-aj-rise>
              From the first enquiry to a written offer, every step is here - who acts, how long it
              takes, and what comes next. A named admissions coordinator walks each one with you.
            </p>

            <div className="aj__stage">
              <svg className="aj__arc aj__arc--top aj-draw" viewBox="0 0 160 110" aria-hidden="true">
                <path pathLength={1} data-stroke="" d="M6 16C52 2 118 4 152 58" />
              </svg>
              <svg className="aj__arc aj__arc--low aj-draw" viewBox="0 0 120 160" aria-hidden="true">
                <path pathLength={1} data-stroke="" d="M40 4C8 34 2 92 34 128c14 16 34 26 58 28" />
              </svg>
              <span className="aj__ring" aria-hidden="true" />

              <div className="aj__frame">
                <JourneyFilm />
              </div>

              <p className="aj__note" aria-hidden="true">
                Take a look at our campus
                <br />
                and see the difference
                <br />
                for yourself
                <Hand kind="arrow" tone="ink" className="aj__note-arrow aj-draw" />
              </p>
            </div>
          </div>

          <ol className="aj-steps" aria-label="The six admission steps">
            {ADMISSION_JOURNEY.map((step) => (
              <li className="aj-step" key={step.id}>
                <span className="aj-step__num" aria-hidden="true">
                  {step.step}
                </span>

                <span className="aj-step__rail" aria-hidden="true">
                  <span className="aj-step__fill" />
                </span>
                <span className="aj-step__node" aria-hidden="true">
                  <span className="aj-step__dot" />
                </span>

                <span className="aj-step__icon" aria-hidden="true">
                  <Icon name={step.icon} size={19} />
                </span>

                <div className="aj-step__body">
                  <h3 className="aj-step__title">{step.title}</h3>
                  <p className="aj-step__desc">{step.description}</p>
                  <p className="aj-step__meta">
                    <span className="aj-step__time">
                      <Icon name="clock" size={13} />
                      {step.duration}
                    </span>
                    <a className="aj-step__action" href={step.href} onClick={jump(step.href)}>
                      {step.action}
                      <Icon name="arrowUpRight" size={13} />
                    </a>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   The film
   --------------------------------------------------------------------------
   Ambient, and it behaves like it: nothing is fetched until the section is
   within 400px, it only plays while it is on screen, a reader who has asked
   for reduced motion gets the poster, and the round control in the middle
   stops or starts it. The reader's own choice wins over all of that.
   -------------------------------------------------------------------------- */

function JourneyFilm() {
  const frame = useRef(null);
  const video = useRef(null);
  const reduceMotion = useReducedMotion();

  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  /* null until the reader presses the control; then their choice wins. */
  const [choice, setChoice] = useState(null);
  const wantsPlay = choice ? choice === 'play' : !reduceMotion;

  /* Fetch nothing until the section is close. */
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* The <source> children only exist once the section is near, and a video
     element does not notice new sources until it is told to look again. */
  useEffect(() => {
    if (near) video.current?.load();
  }, [near]);

  /* Play only while it can be seen, and only if it should. */
  useEffect(() => {
    const el = frame.current;
    const v = video.current;
    if (!el || !v || !near || failed) return;
    v.muted = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && wantsPlay) {
          v.play().catch(() => setPlaying(false));
        } else {
          v.pause();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, wantsPlay, failed]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (playing) {
      setChoice('pause');
      v.pause();
    } else {
      setChoice('play');
      v.play().catch(() => setPlaying(false));
    }
  };

  return (
    <div className="aj__film" ref={frame}>
      {failed ? (
        <img
          className="aj__media"
          src={JOURNEY_FILM.poster}
          alt={JOURNEY_FILM.description}
          width={JOURNEY_FILM.width}
          height={JOURNEY_FILM.height}
        />
      ) : (
        <video
          ref={video}
          className="aj__media"
          poster={JOURNEY_FILM.poster}
          width={JOURNEY_FILM.width}
          height={JOURNEY_FILM.height}
          autoPlay={!reduceMotion}
          muted
          loop
          playsInline
          preload="none"
          aria-label={JOURNEY_FILM.description}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        >
          {near && (
            <>
              <source src={JOURNEY_FILM.webm} type="video/webm" />
              <source
                src={JOURNEY_FILM.mp4}
                type="video/mp4"
                onError={() => {
                  setFailed(true);
                  setPlaying(false);
                }}
              />
            </>
          )}
        </video>
      )}

      <span className="aj__veil" aria-hidden="true" />

      <div className="aj__cue">
        {!failed && (
          <button
            type="button"
            className="aj__toggle"
            onClick={toggle}
            aria-label={playing ? 'Pause the campus video' : 'Play the campus video'}
          >
            {playing ? (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5.5 3.5v9M10.5 3.5v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5.5 3.6v8.8a.6.6 0 0 0 .9.5l6.9-4.4a.6.6 0 0 0 0-1L6.4 3.1a.6.6 0 0 0-.9.5Z" fill="currentColor" />
              </svg>
            )}
          </button>
        )}
        <span className="aj__cue-label" aria-hidden="true">
          Explore our campus
        </span>
      </div>
    </div>
  );
}
