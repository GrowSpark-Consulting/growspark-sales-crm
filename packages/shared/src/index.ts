export { ROLES } from './roles.js';
export { healthResponseSchema } from './health.js';
export type { HealthResponse } from './health.js';
export { LOSS_REASONS, lossReasonSchema } from './loss-reasons.js';
export type { LossReason } from './loss-reasons.js';
export { PERMISSIONS, ROLE_PERMISSIONS, hasPermission } from './permissions.js';
export type { Permission } from './permissions.js';
export { loginSchema, changePasswordSchema, meResponseSchema } from './auth.js';
export type { LoginInput, ChangePasswordInput, MeResponse } from './auth.js';
export {
  idParamSchema,
  pageQuerySchema,
  paginationMetaSchema,
  sortQuerySchema,
  booleanQueryParam,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './common.js';
export type { IdParam, PageQuery } from './common.js';
export {
  createUserSchema,
  updateUserSchema,
  resetUserPasswordSchema,
  listUsersQuerySchema,
  userResponseSchema,
  usersListResponseSchema,
  userOptionResponseSchema,
  userOptionsListResponseSchema,
} from './users.js';
export type {
  CreateUserInput,
  UpdateUserInput,
  ResetUserPasswordInput,
  ListUsersQuery,
  UserResponse,
  UserOptionResponse,
} from './users.js';
export {
  listAuditEventsQuerySchema,
  auditEventResponseSchema,
  auditEventsListResponseSchema,
} from './audit.js';
export type { ListAuditEventsQuery, AuditEventResponse } from './audit.js';
export { normalizeEmail, normalizePhone, normalizeCompanyName } from './normalize.js';
export {
  COUNTRY_CALLING_CODES,
  DEFAULT_COUNTRY_CALLING_CODE,
  matchCountryCallingCode,
  isValidPhoneNumber,
  isValidManualEntryPhone,
  toE164,
  phoneFieldSchema,
  parsePhoneLenient,
} from './phone.js';
export type { CountryCallingCode } from './phone.js';
export { LEAD_STATUSES, leadStatusSchema, OPEN_LEAD_STATUSES, openLeadStatusSchema } from './lead-statuses.js';
export type { LeadStatus, OpenLeadStatus } from './lead-statuses.js';
export { PRIORITIES, prioritySchema } from './priorities.js';
export type { Priority } from './priorities.js';
export { duplicateMatchSchema } from './duplicates.js';
export type { DuplicateMatch } from './duplicates.js';
export { leadSourceResponseSchema, leadSourcesListResponseSchema } from './lead-sources.js';
export type { LeadSourceResponse } from './lead-sources.js';
export {
  createCompanySchema,
  updateCompanySchema,
  listCompaniesQuerySchema,
  companyResponseSchema,
  companiesListResponseSchema,
  companyWithDuplicatesResponseSchema,
} from './companies.js';
export type {
  CreateCompanyInput,
  UpdateCompanyInput,
  ListCompaniesQuery,
  CompanyResponse,
} from './companies.js';
export {
  contactCreatableFields,
  createContactSchema,
  updateContactSchema,
  listContactsQuerySchema,
  contactResponseSchema,
  contactsListResponseSchema,
  contactWithDuplicatesResponseSchema,
} from './contacts.js';
export type {
  CreateContactInput,
  UpdateContactInput,
  ListContactsQuery,
  ContactResponse,
} from './contacts.js';
export {
  leadCreatableFields,
  createLeadSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  listLeadsQuerySchema,
  leadDuplicateCheckQuerySchema,
  leadResponseSchema,
  leadsListResponseSchema,
  leadWithDuplicatesResponseSchema,
  leadDuplicatesResponseSchema,
  leadStatusHistoryResponseSchema,
  leadStatusHistoryListResponseSchema,
} from './leads.js';
export type {
  CreateLeadInput,
  UpdateLeadInput,
  UpdateLeadStatusInput,
  ListLeadsQuery,
  LeadDuplicateCheckQuery,
  LeadResponse,
  LeadStatusHistoryResponse,
} from './leads.js';
export { convertLeadSchema, leadConversionResponseSchema, leadConversionMatchesResponseSchema } from './lead-conversion.js';
export type { ConvertLeadInput, LeadConversionResponse, LeadConversionMatchesResponse } from './lead-conversion.js';
