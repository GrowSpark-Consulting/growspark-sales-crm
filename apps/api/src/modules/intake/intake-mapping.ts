import type { WebsiteEnquiryIntakeInput } from '@growspark/shared';

/**
 * Lenient, best-effort field mapping. The real Grow Spark website's exact
 * form field names are not confirmed (CLAUDE.md — that repository is off
 * limits until a separate, explicitly-approved patch), so this tries a
 * handful of reasonable aliases per target field rather than requiring one
 * exact name, and never rejects a submission just because a field it didn't
 * recognise showed up — everything not consumed below lands in
 * capturedFields instead of being dropped. The roadmap's own mapping table
 * (docs/decisions.md D71 / the Day 5a brief) is the source for these
 * aliases and the formType -> sourceDetail labels.
 */

const NAME_KEYS = ['name', 'full_name', 'fullName'];
const EMAIL_KEYS = ['email'];
const PHONE_KEYS = ['phone', 'phone_number', 'phoneNumber', 'mobile'];
const COMPANY_KEYS = ['company', 'company_name', 'companyName'];
const WEBSITE_KEYS = ['website'];
const CHALLENGE_KEYS = ['challenge', 'message', 'requirement'];
const INDUSTRY_KEYS = ['industry'];

const CONSUMED_KEYS = new Set([
  ...NAME_KEYS,
  ...EMAIL_KEYS,
  ...PHONE_KEYS,
  ...COMPANY_KEYS,
  ...WEBSITE_KEYS,
  ...CHALLENGE_KEYS,
  ...INDUSTRY_KEYS,
]);

const FORM_TYPE_SOURCE_DETAILS: Record<string, string> = {
  contact: 'Website / Contact Form',
  engagement_application: 'Website / Engagement Application',
  strategy_session: 'Website / Strategy Session',
  growth_intensive: 'Website / Growth Intensive',
};

function getStringField(fields: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export interface MappedIntakeFields {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  website: string | null;
  requirement: string | null;
  industry: string | null;
  sourceDetail: string;
  capturedFields: Record<string, unknown>;
}

export function mapIntakeFields(input: WebsiteEnquiryIntakeInput): MappedIntakeFields {
  const { fields } = input;

  const name = getStringField(fields, NAME_KEYS);
  const [firstNamePart, ...rest] = name ? name.split(/\s+/) : [];
  const lastName = rest.length > 0 ? rest.join(' ') : null;

  const capturedFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!CONSUMED_KEYS.has(key)) {
      capturedFields[key] = value;
    }
  }

  return {
    firstName: firstNamePart && firstNamePart.trim() ? firstNamePart.trim() : 'Website Enquiry',
    lastName,
    email: getStringField(fields, EMAIL_KEYS),
    phone: getStringField(fields, PHONE_KEYS),
    companyName: getStringField(fields, COMPANY_KEYS),
    website: getStringField(fields, WEBSITE_KEYS),
    requirement: getStringField(fields, CHALLENGE_KEYS),
    industry: getStringField(fields, INDUSTRY_KEYS),
    sourceDetail: FORM_TYPE_SOURCE_DETAILS[input.formType] ?? `Website / ${input.formType}`,
    capturedFields,
  };
}
