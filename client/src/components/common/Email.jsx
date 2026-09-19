/**
 * An email address with a break opportunity after the @, so a narrow phone
 * wraps it as "admissions@ / newmodelhighschool.edu.in" rather than mid-word
 * or off the edge of the screen. Anything without an @ renders untouched.
 */
export function Email({ children }) {
  const at = typeof children === 'string' ? children.indexOf('@') : -1;
  if (at < 0) return children;
  return (
    <>
      {children.slice(0, at + 1)}
      <wbr />
      {children.slice(at + 1)}
    </>
  );
}
