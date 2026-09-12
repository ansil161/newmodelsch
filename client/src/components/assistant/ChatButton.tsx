import { Icon } from '@/components/common/Icon';
import { cx } from '@/utils';
import { MODES } from './modes';
import type { TriggerProps } from './types';

/**
 * The dock's one button: talk to the school. White and navy, in the site's
 * own materials.
 */
export function ChatButton({ active, controls, onClick, ref }: TriggerProps) {
  const { openLabel, closeLabel } = MODES.chat;

  return (
    <span className="fa-float fa-float--chat">
      <button
        ref={ref}
        type="button"
        className={cx('fa-btn fa-chat', active && 'is-active')}
        aria-label={active ? closeLabel : openLabel}
        aria-expanded={active}
        aria-controls={controls}
        aria-haspopup="dialog"
        onClick={onClick}
      >
        <span className="fa-btn__face" aria-hidden="true">
          <Icon name="message" size={19} strokeWidth={1.7} />
        </span>
        <span className="fa-btn__close" aria-hidden="true">
          <Icon name="close" size={17} strokeWidth={1.8} />
        </span>
      </button>
    </span>
  );
}
