import { FACULTY_DEPARTMENTS, FACULTY_STATS } from '@/constants';
import { everydayImages } from '@/constants/imagery';
import { gsap } from '@/lib/gsap';
import { useGsapScope } from '@/hooks/useGsapScope';
import { count, reduced, rise, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { Figure } from '@/components/editorial';
import './faculty-figures.css';

/* ==========================================================================
   FACULTY FIGURES - the staff room in four numbers
   --------------------------------------------------------------------------
   Four cards in one row, each on its own ground with a small drawing of what
   its number means. The last is photograph-led and carries the figure the
   other three explain - 94% of the staff come back each year:

     94%     cloth, over a teacher walking the rows. A 50-tick meter.
     101     white. The staff split by department, strengths from the data
             (24 + 16 + 19 + 12 + 9 + 21 = 101), so the bar is the number.
     11 yrs  the logo ink. A ruler with the average marked on it.
     1:18    paper. One brass dot, eighteen open ones.

   Motion: the panels rise, the photograph is printed from the right, the
   figures count from zero, and each drawing fills in after its panel. All of
   it is the vocabulary in `@/lib/motion`; the drawings use plain transforms
   and are skipped under reduced motion, so the resting state is complete.
   ========================================================================== */

const [STAFF, EXPERIENCE, RATIO, RETAINED] = FACULTY_STATS;

/* '94%' -> 94 and '%'; '11 yrs' -> 11 and 'yrs'. A ratio is not counted. */
const split = (value) => {
  if (value.includes(':')) return { num: value, unit: '', countable: false };
  const m = value.match(/^([\d,.]+)\s*(.*)$/);
  return m ? { num: m[1], unit: m[2], countable: true } : { num: value, unit: '', countable: false };
};

const DEPARTMENTS = FACULTY_DEPARTMENTS.map((dept) => ({
  name: dept.name,
  n: parseInt(dept.strength, 10) || 0,
}));

const METER_TICKS = 50;
const retainedPct = parseFloat(RETAINED.value) || 0;
const years = parseFloat(EXPERIENCE.value) || 0;
const RULER_MAX = 20;

function Value({ value, className = '' }) {
  const { num, unit, countable } = split(value);
  const [a, b] = num.split(':');
  return (
    <p className={`fstat__value ${className}`.trim()}>
      {b !== undefined ? (
        <span className="fstat__num">
          {a}
          <span className="fstat__colon">:</span>
          {b}
        </span>
      ) : (
        <span className="fstat__num" data-count={countable || undefined}>
          {num}
        </span>
      )}
      {unit ? <span className="fstat__unit">{unit}</span> : null}
    </p>
  );
}

function Kicker({ index, icon, children }) {
  return (
    <p className="fstat__kicker" aria-hidden="true">
      <span className="fstat__icon">
        <Icon name={icon} size={16} />
      </span>
      <span className="fstat__index">{index}</span>
      <span className="fstat__tag">{children}</span>
    </p>
  );
}

export function FacultyFigures() {
  const scope = useGsapScope((_, el) => {
    rise(el.querySelectorAll('.fstat'), { trigger: el, y: 28, stagger: 0.09 });
    unmask(el.querySelectorAll('.fstat__photo'), { trigger: el, from: 'right', delay: 0.05 });
    count(el.querySelectorAll('[data-count]'), {
      trigger: el,
      start: 'top 82%',
      delay: 0.35,
      stagger: 0.12,
      fromZero: true,
    });

    if (reduced()) return;
    const at = { trigger: el, start: 'top 82%', once: true };

    gsap.from(el.querySelectorAll('.meter__tick.is-on'), {
      scaleY: 0.2,
      opacity: 0.2,
      transformOrigin: 'bottom center',
      duration: 0.5,
      ease: 'power2.out',
      delay: 0.55,
      stagger: 0.022,
      scrollTrigger: at,
    });
    gsap.from(el.querySelectorAll('.depts__seg'), {
      scaleX: 0,
      transformOrigin: 'left center',
      duration: 0.9,
      ease: 'power3.out',
      delay: 0.6,
      stagger: 0.07,
      scrollTrigger: at,
    });
    gsap.from(el.querySelectorAll('.ruler__fill'), {
      scaleX: 0,
      transformOrigin: 'left center',
      duration: 1.6,
      ease: 'power2.out',
      delay: 0.65,
      scrollTrigger: at,
    });
    gsap.from(el.querySelectorAll('.mentor__dot'), {
      scale: 0,
      duration: 0.45,
      ease: 'back.out(2)',
      delay: 0.7,
      stagger: 0.025,
      scrollTrigger: at,
    });
  }, []);

  return (
    <div ref={scope} className="fstats" role="group" aria-label="The teaching staff in figures">
      {/* ---------------------------------------------- 101 - the staff room */}
      <div className="fstat fstat--staff">
        <Kicker index="01" icon="users">
          The staff room
        </Kicker>

        <div className="fstat__lockup">
          <Value value={STAFF.value} className="fstat__value--mid" />
          <p className="fstat__label">{STAFF.label}</p>
        </div>

        <div className="depts" aria-hidden="true">
          <span className="depts__bar">
            {DEPARTMENTS.map((d) => (
              <span key={d.name} className="depts__seg" style={{ flexGrow: d.n }} />
            ))}
          </span>
          <span className="depts__caption">Across {DEPARTMENTS.length} departments</span>
        </div>
      </div>

      {/* ---------------------------------------------- 11 yrs - experience */}
      <div className="fstat fstat--years">
        <Kicker index="02" icon="history">
          In the room
        </Kicker>

        <div className="fstat__lockup">
          <Value value={EXPERIENCE.value} className="fstat__value--mid" />
          <p className="fstat__label">{EXPERIENCE.label}</p>
        </div>

        <div className="ruler" aria-hidden="true">
          <span className="ruler__track">
            <span className="ruler__fill" style={{ width: `${(years / RULER_MAX) * 100}%` }} />
            <span className="ruler__mark" style={{ left: `${(years / RULER_MAX) * 100}%` }} />
          </span>
          <span className="ruler__scale">
            <span>0</span>
            <span>10</span>
            <span>20 yrs</span>
          </span>
        </div>
      </div>

      {/* ---------------------------------------------- 1:18 - mentorship */}
      <div className="fstat fstat--ratio">
        <Kicker index="03" icon="cap">
          Mentorship
        </Kicker>

        <div className="fstat__lockup">
          <Value value={RATIO.value} className="fstat__value--mid" />
          <p className="fstat__label">{RATIO.label}</p>
        </div>

        <div className="mentor" aria-hidden="true">
          <span className="mentor__dot mentor__dot--lead" />
          <span className="mentor__group">
            {Array.from({ length: 18 }, (_, i) => (
              <span key={i} className="mentor__dot" />
            ))}
          </span>
          <span className="mentor__caption">One named adult who calls home</span>
        </div>
      </div>

      {/* ---------------------------------------------- 94% - the anchor */}
      <div className="fstat fstat--anchor">
        <Figure
          photo={everydayImages.lesson}
          width={1100}
          sizes="(max-width: 959px) 92vw, 46vw"
          shape="frame"
          ratio="free"
          className="fstat__photo"
          decorative
        />
        <span className="fstat__veil" aria-hidden="true" />

        <div className="fstat__inner">
          <Kicker index="04" icon="shield">
            Continuity
          </Kicker>

          <div className="fstat__lockup">
            <Value value={RETAINED.value} className="fstat__value--mid" />
            <p className="fstat__label">{RETAINED.label}</p>
          </div>

          <div className="meter" aria-hidden="true">
            <span className="meter__ticks">
              {Array.from({ length: METER_TICKS }, (_, i) => (
                <span
                  key={i}
                  className={`meter__tick${i < Math.round((retainedPct / 100) * METER_TICKS) ? ' is-on' : ''}`}
                />
              ))}
            </span>
            <span className="meter__caption">{Math.round(retainedPct)} of every 100 return</span>
          </div>
        </div>
      </div>
    </div>
  );
}
