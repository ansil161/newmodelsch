import { useGsapScope } from '@/hooks/useGsapScope';
import { count, rise } from '@/lib/motion';

/* ==========================================================================
   STAT REVEAL
   --------------------------------------------------------------------------
   Figures, counted up on entry.

   THE NUMBER IN THE MARKUP IS THE REAL NUMBER.

   `count()` reads the element's own text content, parses the figure out of it
   and animates back up to it. That inversion - the finished value is authored,
   the animation only re-reaches it - is what makes the section correct when
   motion is off, when the tween is interrupted by a fast scroll, and when a
   search engine or a screen reader reads the page before any of it has run.
   The usual approach, animating from zero and writing the final value at the
   end, gets all three of those wrong.

   `aria-hidden` is not used and the value is not swapped out: a screen reader
   reaching a stat mid-count would read a meaningless intermediate figure, so
   the whole group is marked `aria-busy` while it runs and the final text is
   restored verbatim rather than reformatted.

   THE COLUMNS FOLLOW THE BOX, NOT THE SCREEN

   The same component sits across a full-width band and inside a one-third
   prose column, so a viewport breakpoint is the wrong question: a 1440px
   screen can hand it 430px. The `<dl>` is wrapped in a size container and
   `.stats--grid` picks its column count from that container's width, so a
   figure like '10,000+' is never set in a track narrower than itself.

   THREE LAYOUTS, AND THEY ARE NOT INTERCHANGEABLE

     row     a horizontal band of three or four. The proof strip.
     grid    a 2x2 or 2x3 block. Used where the figures sit beside a column of
             text rather than under a heading.
     stack   one per line, rule-separated. For a narrow column or a sidebar.
   ========================================================================== */

export interface StatItem {
  /** Written exactly as it should finish: '10,000+', '98%', '4.9', '1:18'. */
  value: string;
  label: string;
  detail?: string;
}

interface StatRevealProps {
  items: readonly StatItem[];
  layout?: 'row' | 'grid' | 'stack';
  /** Sets the figure at hero scale. For the one proof section per page. */
  large?: boolean;
  className?: string;
}

export function StatReveal({ items, layout = 'row', large = false, className = '' }: StatRevealProps) {
  const scope = useGsapScope<HTMLDListElement>((_, el) => {
    const groups = el.querySelectorAll<HTMLElement>('.stat');
    rise(groups, { trigger: el, y: 22, stagger: 0.08 });
    count(el.querySelectorAll<HTMLElement>('.stat__value'), { trigger: el, delay: 0.15 });
  }, [items]);

  return (
    <div className={`stats-frame ${className}`.trim()}>
      <dl ref={scope} className={`stats stats--${layout}${large ? ' stats--large' : ''}`}>
        {items.map((item) => (
          <div className="stat" key={item.label + item.value}>
            <dt className="sr-only">{item.label}</dt>
            <dd className="stat__body">
              <span className="stat-num stat__value">{item.value}</span>
              <span className="stat__label" aria-hidden="true">
                {item.label}
              </span>
              {item.detail ? <span className="stat__detail">{item.detail}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
