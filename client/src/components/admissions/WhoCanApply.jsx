import { useEffect, useRef, useState } from 'react';
import { ADMISSIONS_INTRO, ELIGIBILITY, WHO_CAN_APPLY_FILM } from '@/constants/admissions';
import { admissionImages, everydayImages, resolve, resolveSet } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import { gsap } from '@/lib/gsap';
import { reduced } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Hand } from '@/components/editorial';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { cx } from '@/utils';
import './who-can-apply.css';

/* ==========================================================================
   01 - WHO CAN APPLY
   --------------------------------------------------------------------------
   An asymmetric spread, then the ledger.

     copy (42%)            label, serif heading, the entry-point line, the
                           eligibility paragraph, one quiet CTA
     the film (58%)        ONE muted looping video, pushed slightly past the
                           grid, with four small photographs laid around it
                           like prints - top left, top right, lower left,
                           lower right - a thin arc, and a handwritten note
     the ledger            the five entry points from ELIGIBILITY, full width,
                           one ruled row each, every row a link to the form

   The eligibility words are the school's, unchanged. Nothing here states a
   rule the admissions constants do not.

   THE FILM IS AMBIENT, AND IT BEHAVES LIKE IT.

   It is not fetched until the section is within 400px of the viewport, it
   only plays while it is on screen, it never plays for a reader who has
   asked for reduced motion (the poster stands in), and a small round control
   lets anyone stop it. The reader's choice wins over all of the above.

   MOTION, AND WHO OWNS WHICH TRANSFORM

     .wca__heading, [data-wca-fade]   entrance
     .wca__video                      entrance: scale, opacity, radius
     .wca__drift                      scroll parallax (the video's wrapper)
     .wca-float                       scroll parallax, desktop only
     .wca-float__in                   entrance: y, scale, rotation settle
     .wca-float__bob                  the idle float, after the entrance
     .wca-row                         entrance: x, opacity
     row children                     hover (CSS)

   Under reduced motion none of it is built and the section is simply there.
   ========================================================================== */

/* Four small prints around the film. Decorative accents, but real photographs
   of real things, so each keeps its own description. */
const FLOATS = [
  { photo: everydayImages.deskGirls, ratio: '4 / 3', speed: -34 },
  { photo: everydayImages.friends, ratio: '1 / 1', speed: 22 },
  { photo: everydayImages.lesson, ratio: '4 / 5', speed: -18 },
  { photo: admissionImages[1], ratio: '16 / 11', speed: 28 },
];

/* One line icon per entry point, in ELIGIBILITY's order. */
const ICONS = ['sprout', 'blocks', 'book', 'compass', 'cap'];

/* The two classes where most places are - the ledger marks them, quietly. */
const isMainEntry = (seats, note) =>
  /entry point/i.test(seats) || /main entry/i.test(note);

export function AdEligibility() {
  const { scrollTo } = useSmoothScroll();

  const scope = useGsapScope((ctx, root) => {
    if (reduced()) return;

    /* 1 - the intro */
    const intro = root.querySelector('.wca__copy');
    gsap.from('.wca__heading', {
      opacity: 0,
      y: 30,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: intro, start: 'top 82%', once: true },
    });
    gsap.from(root.querySelectorAll('[data-wca-fade]'), {
      opacity: 0,
      y: 20,
      duration: 0.8,
      ease: 'power3.out',
      delay: 0.15,
      stagger: 0.08,
      scrollTrigger: { trigger: intro, start: 'top 82%', once: true },
    });

    /* 2 - the film: a settle, then a very small drift with the page */
    const stage = root.querySelector('.wca__stage');
    const film = root.querySelector('.wca__video');
    if (film) {
      /* The radius is tweened as one value into the one the stylesheet
         resolves to, then handed back to the stylesheet - so it keeps
         following the clamp() when the window is resized afterwards. */
      const radius = getComputedStyle(film).borderTopLeftRadius;
      gsap.fromTo(
        film,
        { opacity: 0, scale: 0.94, borderRadius: '72px' },
        {
          opacity: 1,
          scale: 1,
          borderRadius: radius,
          duration: 1.1,
          ease: 'power3.out',
          clearProps: 'borderRadius',
          scrollTrigger: { trigger: stage, start: 'top 80%', once: true },
        },
      );
    }
    gsap.fromTo(
      '.wca__drift',
      { yPercent: 2.5 },
      {
        yPercent: -2.5,
        ease: 'none',
        scrollTrigger: { trigger: stage, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );

    /* 3 - the prints arrive one after another, then barely breathe */
    const inners = gsap.utils.toArray('.wca-float__in', root);
    gsap.from(inners, {
      opacity: 0,
      y: 20,
      scale: 0.92,
      rotation: (i) => (i % 2 ? -4 : 4),
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.15,
      delay: 0.25,
      scrollTrigger: { trigger: stage, start: 'top 78%', once: true },
      onComplete: () => {
        ctx.add(() => {
          gsap.to(gsap.utils.toArray('.wca-float__bob', root), {
            y: '+=4',
            duration: 2.5,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
            stagger: { each: 0.6 },
          });
        });
      },
    });

    /* Parallax on the prints is for a wide screen, where they float around
       the film. On a phone they are a row under it and should stay put. */
    const mm = gsap.matchMedia(root);
    mm.add('(min-width: 900px)', () => {
      gsap.utils.toArray('.wca-float', root).forEach((print) => {
        gsap.to(print, {
          y: Number(print.dataset.speed ?? 0),
          ease: 'none',
          scrollTrigger: { trigger: stage, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        });
      });
    });

    /* 4 - the ledger */
    gsap.from(root.querySelectorAll('.wca-row'), {
      opacity: 0,
      x: -20,
      duration: 0.7,
      ease: 'power3.out',
      stagger: 0.1,
      scrollTrigger: { trigger: root.querySelector('.wca__list'), start: 'top 84%', once: true },
    });

    return () => mm.revert();
  }, []);

  const jump = (target) => (event) => {
    event.preventDefault();
    scrollTo(target, -80);
  };

  return (
    <section ref={scope} className="wca" id="admissions-intro" aria-labelledby="wca-title">
      <div className="wrap">
        <div className="wca__intro">
          <header className="wca__copy">
            <p className="wca__label" data-wca-fade>
              01 <i /> Admissions {ADMISSIONS_INTRO.session}
            </p>

            <h2 className="wca__heading" id="wca-title">
              Who can <em>apply</em>
            </h2>

            <p className="wca__sub" data-wca-fade>
              Find the right entry point for your child.
            </p>

            <p className="wca__lead" data-wca-fade>
              Every child has a different starting point. Nursery and Class 9 are where most places
              are; every other class depends on vacancies, and your coordinator tells you the
              position for your class before you apply, not after.
            </p>

            <div data-wca-fade>
              <a className="wca__cta" href="#process" onClick={jump('#process')}>
                Explore admission guide
                <span className="wca__cta-arrow" aria-hidden="true">
                  <Icon name="arrowRight" size={14} />
                </span>
              </a>
            </div>
          </header>

          <div className="wca__stage">
            <svg className="wca__arc" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M6 70 C1 34 26 2 62 3 C92 4 104 34 97 62" />
            </svg>
            <span className="wca__dot" aria-hidden="true" />

            <p className="wca__note" aria-hidden="true">
              two main doors
              <Hand kind="arrow" tone="ink" className="wca__note-arrow" />
            </p>

            <div className="wca__drift">
              <EntryFilm />
            </div>

            <div className="wca__floats">
              {FLOATS.map((float, i) => (
                <div
                  className={`wca-float wca-float--${i + 1}`}
                  data-speed={float.speed}
                  key={float.photo.id}
                >
                  <div className="wca-float__in">
                    <div className="wca-float__bob">
                      <div className="wca-float__print" style={{ aspectRatio: float.ratio }}>
                        <img
                          src={resolve(float.photo, 360)}
                          srcSet={resolveSet(float.photo, [240, 360, 540])}
                          sizes="(min-width: 900px) 14vw, 32vw"
                          alt={float.photo.alt}
                          width={360}
                          height={360}
                          loading="lazy"
                          decoding="async"
                          style={float.photo.focus ? { objectPosition: float.photo.focus } : undefined}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="wca__ledger">
          <p className="wca__list-label">
            <span>Entry points for {ADMISSIONS_INTRO.session}</span>
            <span>{String(ELIGIBILITY.length).padStart(2, '0')} stages</span>
          </p>

          <ol className="wca__list">
            {ELIGIBILITY.map((row, i) => {
              const main = isMainEntry(row.seats, row.note);
              return (
                <li key={row.entry}>
                  <a
                    className={cx('wca-row', main && 'is-main')}
                    href="#enquiry"
                    onClick={jump('#enquiry')}
                    aria-label={`${row.entry}: ${row.age}. ${row.seats}. ${row.note} Start an enquiry.`}
                  >
                    <span className="wca-row__num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="wca-row__icon" aria-hidden="true">
                      <Icon name={ICONS[i] ?? 'book'} size={20} />
                    </span>
                    <span className="wca-row__stage">
                      <span className="wca-row__name">{row.entry}</span>
                      <span className="wca-row__age">{row.age}</span>
                    </span>
                    <span className="wca-row__desc">{row.note}</span>
                    <span className="wca-row__tag">{row.seats}</span>
                    <span className="wca-row__arrow" aria-hidden="true">
                      <Icon name="arrowRight" size={16} />
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>

          <p className="wca__foot">
            <Icon name="clock" size={15} />
            <span>
              Application status: {ADMISSIONS_INTRO.status}
              <i aria-hidden="true" />
              {ADMISSIONS_INTRO.statusDetail}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   The film
   -------------------------------------------------------------------------- */

function EntryFilm() {
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
    <div className="wca__video" ref={frame}>
      {failed ? (
        <img
          className="wca__media"
          src={WHO_CAN_APPLY_FILM.poster}
          alt={WHO_CAN_APPLY_FILM.description}
          width={WHO_CAN_APPLY_FILM.width}
          height={WHO_CAN_APPLY_FILM.height}
        />
      ) : (
        <>
          <video
            ref={video}
            className="wca__media"
            src={near ? WHO_CAN_APPLY_FILM.src : undefined}
            poster={WHO_CAN_APPLY_FILM.poster}
            width={WHO_CAN_APPLY_FILM.width}
            height={WHO_CAN_APPLY_FILM.height}
            muted
            loop
            playsInline
            preload="none"
            aria-label={WHO_CAN_APPLY_FILM.description}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => {
              setFailed(true);
              setPlaying(false);
            }}
          />
          <button
            type="button"
            className="wca__toggle"
            onClick={toggle}
            aria-label={playing ? 'Pause the background video' : 'Play the background video'}
          >
            {playing ? (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5.5 3.5v9M10.5 3.5v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5.5 3.6v8.8a.6.6 0 0 0 .9.5l6.9-4.4a.6.6 0 0 0 0-1L6.4 3.1a.6.6 0 0 0-.9.5Z" fill="currentColor" />
              </svg>
            )}
          </button>
        </>
      )}
    </div>
  );
}
