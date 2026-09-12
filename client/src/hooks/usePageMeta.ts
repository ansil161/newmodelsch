import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';

interface PageMeta {
  title: string;
  description: string;
}

/**
 * Sets the document title and meta description per route.
 *
 * A client-rendered multi-page site otherwise ships one title for seven pages,
 * which breaks the browser history menu, bookmarks and any link a parent
 * shares. The previous values are restored on unmount so a route that forgets
 * to call this does not inherit the last page's title.
 */
export function usePageMeta({ title, description }: PageMeta) {
  useIsomorphicLayoutEffect(() => {
    const previousTitle = document.title;
    const tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = tag?.content;

    document.title = title;
    if (tag) tag.content = description;

    return () => {
      document.title = previousTitle;
      if (tag && previousDescription !== undefined) tag.content = previousDescription;
    };
  }, [title, description]);
}
