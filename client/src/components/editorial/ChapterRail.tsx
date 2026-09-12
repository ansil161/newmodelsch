import { useState } from 'react';
import { useGsapScope } from '@/hooks/useGsapScope';
import { ScrollTrigger } from '@/lib/gsap';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';

/* ==========================================================================
   CHAPTER RAIL - the running index
   --------------------------------------------------------------------------
   A fixed list in the left margin telling the reader which chapter they are
   in and how many are left. It is the thing that turns a long page from
   "scrolling" into "reading a document".

   THREE THINGS IT GETS RIGHT THAT A SCROLLSPY USUALLY GETS WRONG

   1. IT IS A REAL NAVIGATION LANDMARK.
      An <nav> of anchors, so a keyboard user can tab into it and jump, and a
      screen reader announces it as navigation with the current chapter marked
      `aria-current`. A scrollspy built out of <div>s and click handlers is a
      table of contents that only exists for people using a mouse.

   2. IT ONLY EXISTS WHERE THERE IS A MARGIN TO PUT IT IN.
      Below 1200px there is no spare column, and a rail overlaid on the text
      is worse than no rail. It is removed from the DOM, not just hidden - a
      hidden nav is still in the tab order and still read aloud.

   3. THE ACTIVE CHAPTER IS DECIDED ONE WAY.
      Every section reports through the same trigger geometry, so two chapters
      can never both be current after a fast scroll. The rule is: a chapter is
      current from when its top passes a third of the way up the viewport
      until the next chapter's top does.
   ========================================================================== */

export interface RailItem {
  /** The element id this chapter's section carries. */
  id: string;
  index: string;
  label: string;
}

interface ChapterRailProps {
  items: RailItem[];
  /** Sits above the list - the page's own name. */
  title?: string;
}

export function ChapterRail({ items, title }: ChapterRailProps) {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const { scrollTo } = useSmoothScroll();

  const scope = useGsapScope<HTMLElement>(() => {
    // Looked up on the document, not passed as '#id' text: selector text
    // inside this scoped context resolves within the rail itself, finds
    // nothing, and leaves every chapter spanning the whole page - so all of
    // them are active at once and the last one always wins.
    const triggers = items.map((item, i) =>
      ScrollTrigger.create({
        trigger: document.getElementById(item.id),
        start: 'top 33%',
        end: 'bottom 33%',
        onToggle: (self) => {
          if (self.isActive) setActive(i);
        },
      }),
    );

    // The rail appears once the reader is past the opening screen and leaves
    // before the last chapter ends, so it never sits over the closing call to
    // action or over the footer - both of which have no chapter to be in.
    //
    // The window is measured from the first and last chapters themselves
    // rather than from the page wrapper: the wrapper's bottom is below the
    // final CTA, which left the rail hovering over the footer.
    const first = document.getElementById(items[0]?.id ?? '');
    const last = document.getElementById(items[items.length - 1]?.id ?? '');

    const shown =
      first && last
        ? ScrollTrigger.create({
            trigger: first,
            start: 'top 60%',
            endTrigger: last,
            end: 'bottom 40%',
            onToggle: (self) => setVisible(self.isActive),
          })
        : null;

    return () => {
      triggers.forEach((t) => t.kill());
      shown?.kill();
    };
  }, [items]);

  return (
    <nav
      ref={scope}
      className={`rail${visible ? ' is-visible' : ''}`}
      aria-label="Chapters on this page"
    >
      {title ? <p className="rail__title meta">{title}</p> : null}
      <ol className="rail__list">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`rail__link${i === active ? ' is-current' : ''}`}
              aria-current={i === active ? 'true' : undefined}
              onClick={(e) => {
                e.preventDefault();
                scrollTo(`#${item.id}`, -80);
              }}
            >
              <span className="rail__index">{item.index}</span>
              <span className="rail__label">{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
