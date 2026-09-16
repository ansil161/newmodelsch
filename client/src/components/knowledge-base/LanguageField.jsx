import { SelectField } from '@/components/console';

/**
 * The languages a document here is likely to be in. The code is what travels
 * to the index as a retrieval filter; the list is a convenience, not a limit
 * the server imposes.
 */
const LANGUAGES = [
  ['en', 'English'],
  ['hi', 'Hindi'],
  ['te', 'Telugu'],
  ['ur', 'Urdu'],
  ['ta', 'Tamil'],
  ['kn', 'Kannada'],
  ['mr', 'Marathi'],
];

export function LanguageField({
  value,
  onChange,
  error,
  label = 'Language',
  allowAuto = false,
  emptyLabel = 'Knowledge base default',
}) {
  const known = LANGUAGES.some(([code]) => code === value);
  return (
    <SelectField label={label} value={value} onChange={(event) => onChange(event.target.value)} error={error} optional={allowAuto}>
      {allowAuto ? <option value="">{emptyLabel}</option> : null}
      {LANGUAGES.map(([code, name]) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
      {value && !known ? <option value={value}>{value}</option> : null}
    </SelectField>
  );
}
