
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Indian mobile / landline, tolerant of +91, spaces and dashes. */
const PHONE = /^(\+?91[-\s]?)?[0-9][0-9\s-]{7,14}$/;

const required = (value, label) =>
  value.trim().length === 0 ? `${label} is required.` : undefined;

/**
 * Validates one step of the admissions form. Returns only the errors for the
 * fields that step owns, so an untouched later step never blocks progress.
 */
export function validateStep(step, data) {
  const errors = {};

  if (step === 0) {
    if (!data.grade) errors.grade = 'Select the class you are applying for.';
  }

  if (step === 1) {
    errors.parentName = required(data.parentName, 'Parent name');
    if (!PHONE.test(data.parentPhone.trim())) {
      errors.parentPhone = 'Enter a valid contact number.';
    }
    if (!EMAIL.test(data.parentEmail.trim())) {
      errors.parentEmail = 'Enter a valid email address.';
    }
  }

  if (step === 2) {
    errors.studentName = required(data.studentName, 'Student name');
    errors.studentDob = required(data.studentDob, 'Date of birth');
  }

  if (step === 3) {
    errors.visitDate = required(data.visitDate, 'A preferred visit date');
  }

  // Strip the `undefined` slots the helpers return for valid fields.
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => Boolean(message)),
  );
}

/**
 * Validates the short contact-page enquiry. Deliberately lighter than the
 * admissions form: this is the 'I just have a question' route, and every extra
 * required field is a parent who closes the tab instead.
 */
export function validateEnquiry(data) {
  const errors = {};

  errors.name = required(data.name, 'Your name');
  if (!EMAIL.test(data.email.trim())) errors.email = 'Enter a valid email address.';
  // Phone is optional — an email address is enough to reply.
  if (data.phone.trim() && !PHONE.test(data.phone.trim())) {
    errors.phone = 'Enter a valid contact number, or leave it blank.';
  }
  if (!data.subject) errors.subject = 'Choose what this is about.';
  if (data.message.trim().length < 10) {
    errors.message = 'Tell us a little more - ten characters or so.';
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => Boolean(message)),
  );
}

/**
 * Validates the sign-in form. Presence and shape only: a password is checked
 * against nothing but "is there one", because this form does not set
 * passwords and a rule here would only lock out a password the school issued.
 */
export function validateLogin(data) {
  const errors = {};
  const email = data.email.trim();

  if (!email) errors.email = 'Enter your email address.';
  else if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';
  if (!data.password) errors.password = 'Enter your password.';

  return errors;
}
