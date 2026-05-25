import type { Warehouse } from '@/types/database'

export const WAREHOUSES_SEED: Omit<Warehouse, 'id' | 'created_at' | 'is_active'>[] = [
  {
    name: 'ANNEX CONSOLIDATION CENTER',
    code: 'ANNEX',
    address: '300 Mitchell Ave',
    city: 'Alameda',
    state: 'CA',
    zip: '94501',
    phone: '+1 510-352-8244',
    fax: null,
    email: null,
    contact_person: null,
    country: 'US',
  },
  {
    name: 'CONTINENTAL NJ',
    code: 'CONTINENTAL',
    address: '200 Middlesex Ave',
    city: 'Carteret',
    state: 'NJ',
    zip: '07008',
    phone: '973-578-2702',
    fax: null,
    email: null,
    contact_person: 'Jackie Massamillo',
    country: 'US',
  },
  {
    name: 'GREEN ROOM',
    code: 'GREEN_ROOM',
    address: '1302 29th Street NW',
    city: 'Auburn',
    state: 'WA',
    zip: '98001',
    phone: '+1 253-735-4470',
    fax: null,
    email: 'outbound@greenroominfo.com',
    contact_person: null,
    country: 'US',
  },
  {
    name: 'DUPUY STORAGE HOUSTON',
    code: 'DUPUY',
    address: '7703 Cannon Street',
    city: 'Houston',
    state: 'TX',
    zip: '77021',
    phone: '832-384-7750',
    fax: '832-384-7760',
    email: null,
    contact_person: 'Karen Loredo',
    country: 'US',
  },
  {
    name: 'COSTA ORO INTL LLC',
    code: 'COSTA_ORO',
    address: '440 E 19th Street',
    city: 'Tacoma',
    state: 'WA',
    zip: '98421',
    phone: null,
    fax: null,
    email: null,
    contact_person: null,
    country: 'US',
  },
  {
    name: 'GBH DEPOT INC - CANADA',
    code: 'GBH_CANADA',
    address: '55 Marie-Curie',
    city: 'Salaberry-de-Valleyfield',
    state: 'QC',
    zip: 'J6T 0R8',
    phone: null,
    fax: null,
    email: null,
    contact_person: null,
    country: 'CA',
  },
]

export const FREIGHT_DEFAULTS = {
  item_description: 'Coffee in bags',
  handling_unit: 'Pallets',
  dimensions: { length: 48, width: 40, height: 48 },
  freight_class: '65',
  nmfc: '073260',
  nmfc_sub: '10',
} as const

export const WEIGHT_PER_UNIT = {
  kg70: 154.32,  // lbs
  kg35: 77.16,   // lbs
  kg24: 52.91,   // lbs
} as const

export const MAX_BAGS_PER_PALLET = {
  kg70: 10,
  kg35: 12,
  kg24: 50,
} as const

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/quotes/new', label: 'New Quote', icon: 'Plus' },
  { href: '/quotes', label: 'Quote History', icon: 'History' },
] as const

export const QUOTE_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const

export const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
]
