import { STORY } from '@/constants';
import { Icon } from '@/components/common/Icon';
import { useGsapScope } from '@/hooks/useGsapScope';
import { count, rise } from '@/lib/motion';
import './ledger.css';

/* ==========================================================================
   THE LEDGER
   --------------------------------------------------------------------------
   The four figures (founded, campus, alumni, years) as tinted cards, set in
   the cover's `aside` slot beside the lead. The numbers and their one-line
   details come from `STORY.marks` and nowhere else.

   The cards rise in and the figures count up; under reduced motion both are
   skipped and the finished numbers are simply there.
   ========================================================================== */

/* One glyph per figure, in `STORY.marks` order. */
const ICONS = ['history', 'pin', 'users', 'shield'];

export function AboutLedger() {
  const scope = useGsapScope((_, el) => {
    const values = el.querySelectorAll('.ledger__value');
    // `count` reads the finished figure from the text. The ledger is on
    // screen at mount, so a first pass that is torn down mid-count (StrictMode,
    // HMR) would leave '0' behind for the next pass to read - put the authored
    // figure back first.
    values.forEach((value) => {
      value.textContent = value.dataset.value;
    });

    rise(el.querySelectorAll('.ledger__card'), { trigger: el, y: 24, stagger: 0.08, delay: 0.9 });
    count(values, { trigger: el, start: 'top bottom', delay: 1.05, stagger: 0.08 });
  }, []);

  return (
    <div ref={scope} className="ledger">
      <ul className="ledger__grid" aria-label="The school in four figures">
        {STORY.marks.map((mark, i) => (
          <li className="ledger__card" key={mark.label}>
            <span className="ledger__icon" aria-hidden="true">
              <Icon name={ICONS[i]} size={18} />
            </span>
            <p className="ledger__figure">
              <span className="ledger__value stat-num" data-value={mark.value}>
                {mark.value}
              </span>
              <span className="ledger__label">{mark.label}</span>
            </p>
            {mark.detail ? <p className="ledger__detail">{mark.detail}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
