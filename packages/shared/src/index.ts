import { z } from 'zod';

export const SignupInput = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  fullName: z.string().min(1).optional(),
});
export type SignupInput = z.infer<typeof SignupInput>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const UserPublic = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string().nullable().optional(),
  role: z.enum(['ADMIN', 'BROKER', 'CLIENT', 'USER']),
});
export type UserPublic = z.infer<typeof UserPublic>;

export const AuthResponse = z.object({
  accessToken: z.string(),
  user: UserPublic,
});
export type AuthResponse = z.infer<typeof AuthResponse>;

export const DomainSearchResult = z.object({
  domain: z.string(),
  available: z.boolean(),
  price: z.number().optional(),
  currency: z.string().optional(),
});
export type DomainSearchResult = z.infer<typeof DomainSearchResult>;

// ---------------------------------------------------------------------------
// VCO operator-surface types (shapes returned by /v1/vco/*).
//
// These mirror — but do not duplicate — the Zod schemas in
// apps/api/src/integrations/gigtech.ts. Fields are kept intentionally narrow
// to what the web UI actually needs to render. If the upstream shape changes
// in a way the UI needs, add the fields here and surface them in the route.
// ---------------------------------------------------------------------------

export interface VcoStatus {
  mode: 'mock' | 'live';
  api_base: string;
}

export interface VcoUserCustomer {
  customer_id: string;
  name: string;
  status?: string;
}

export interface VcoMe {
  username: string;
  email: string;
  firstname?: string;
  lastname?: string;
  is_admin?: boolean;
  vco_name?: string;
  vco_website?: string;
  vco_support_email?: string;
  iam_domain?: string;
  customers?: VcoUserCustomer[];
  admin_of_customers?: VcoUserCustomer[];
}

export interface VcoCustomer {
  customer_id: string;
  name: string;
  contact_name?: string;
  email?: string;
  billable?: boolean;
  status?: string;
  show_prices?: boolean;
}

export interface VcoDatacenter {
  name?: string;
  code?: string;
  city?: string;
  country?: string;
  country_code?: string;
}

export interface VcoLocation {
  name: string;
  datacenter?: VcoDatacenter;
  is_freemium?: boolean;
}

export interface VcoCloudspace {
  cloudspace_id: string;
  name: string;
  status?: string;
  location?: string;
  private_network?: string;
  external_network_ip?: string;
  cloudspace_mode?: string;
  creation_time?: number;
  update_time?: number;
}

export interface VcoInvoice {
  invoice_id: string;
  customer_id: string;
  customer_name: string;
  number: string;
  currency: string;
  total_incl: number;
  status: string;
  payment_status: string;
  month: number;
  creation_timestamp: number;
  customer_reference_id?: string;
}

export interface VcoAuditLog {
  id: string;
  timestamp: number;
  customer_id?: string;
  location?: string;
  resource_id?: string;
  resource_type?: string;
  user_email?: string;
  user_name?: string;
  username?: string;
  method?: string;
  path?: string;
  status_code?: number;
  status_text?: string;
  response_time?: number;
}
