import { SCHOOL } from '@/constants';
import { usePageMeta } from '@/hooks/usePageMeta';
import { CoChannels, CoDirections, CoHello, CoVisit, EnquiryShort } from '@/components/contact';

/**
 * PAGE 06 - Contact & Visit. Action: "How can I visit or contact the school?"
 *
 * A lightweight standalone page, and the only one that exists for people who
 * are not ready to apply yet. It reads as an invitation - which is why the
 * welcome comes before the phone numbers, and why the map is a link rather
 * than an embedded panel demanding attention.
 *
 * It is deliberately the least designed page on the site. Somebody who lands
 * here wants a number, an address and a time; every editorial device between
 * them and those three things is a device working against the page. So there
 * is no cover photograph, and the phone number is visible in
 * the first screen on every viewport.
 */
export function ContactPage() {
  usePageMeta({
    title: 'Contact & Visit - New Model High School',
    description: `Contact New Model High School, Hyderabad: admissions office, email, directions to the Bahadurpura campus on Doodh Bowli Road, and how to book a campus visit. Call ${SCHOOL.phone}.`,
  });

  return (
    <>
      <CoHello />
      <CoChannels />
      <CoDirections />
      <EnquiryShort />
      <CoVisit />
    </>
  );
}
