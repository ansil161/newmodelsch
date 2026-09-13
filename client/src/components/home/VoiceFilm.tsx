import { useEffect, useId, useRef, useState } from 'react';
import type { Photo } from '@/constants/imagery';
import { resolve } from '@/constants/imagery';
import type { VoiceFilm as Film } from '@/types';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import { Icon } from '@/components/common/Icon';

/* ==========================================================================
   THE FILM
   --------------------------------------------------------------------------
   One student's clip, over the page.

   It is a native <dialog> opened with showModal(), which is the same choice
   the console makes and for the same reasons: the browser gives us the top
   layer, the focus trap, the Escape key and an inert page behind, and a div
   with a high z-index gets none of those right on its own. The top layer also
   means the section's own `overflow: clip` cannot crop it.

   NOTHING PLAYS UNTIL IT IS ASKED TO. The element is only mounted once a
   reader has pressed play, so `autoPlay` here is the continuation of a press
   rather than a page that started talking - and `preload="none"` means the
   file is not fetched by the twenty readers who never press it.

   The clips are served straight out of `public/videos/voices/`, the same
   arrangement as the reel on Student Life: the school drops the file in and it
   plays with no code change. Until then the src 404s, which is said out loud
   rather than left as a dead black rectangle.
   ========================================================================== */

interface VoiceFilmProps {
  name: string;
  role: string;
  poster: Photo;
  film: Film;
  onClose: () => void;
}

export function VoiceFilm({ name, role, poster, film, onClose }: VoiceFilmProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [failed, setFailed] = useState(false);
  const { stop, start } = useSmoothScroll();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    stop();
    return () => {
      start();
      if (dialog.open) dialog.close();
    };
  }, [stop, start]);

  return (
    <dialog
      ref={ref}
      className="vxf"
      aria-labelledby={titleId}
      data-lenis-prevent=""
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the dialog element itself is a click on its backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="vxf__frame">
        <header className="vxf__head">
          <p className="vxf__who">
            <b id={titleId}>{name}</b>
            <span className="meta">{role}</span>
          </p>
          <button type="button" className="vxf__close" onClick={onClose} aria-label="Close the film">
            <Icon name="close" size={18} />
          </button>
        </header>

        {failed ? (
          <p className="vxf__error" role="status">
            This clip is not on the server yet. Drop the file at <code>public{film.src}</code> and
            it plays with no other change.
          </p>
        ) : (
          <video
            className="vxf__video"
            src={film.src}
            poster={resolve(poster, 1200)}
            controls
            autoPlay
            playsInline
            preload="none"
            onError={() => setFailed(true)}
          >
            {film.captions ? (
              <track kind="captions" src={film.captions} srcLang="en" label="English" default />
            ) : null}
          </video>
        )}

        <p className="vxf__foot meta">{`Runtime ${film.runtime}`}</p>
      </div>
    </dialog>
  );
}
