import { notFound } from 'next/navigation';

// Unmatched addresses under a locale land here so they get the localised
// `[locale]/not-found.tsx` instead of Next's bare default 404.
export default function CatchAllPage() {
  notFound();
}
