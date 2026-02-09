// Comprehensive industry list for prospect search
export const INDUSTRIES = [
  // Technology
  { value: 'software_development', label: 'Software Development' },
  { value: 'saas', label: 'SaaS' },
  { value: 'information_technology', label: 'Information Technology & Services' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'cloud_computing', label: 'Cloud Computing' },
  { value: 'artificial_intelligence', label: 'Artificial Intelligence & Machine Learning' },
  { value: 'data_analytics', label: 'Data Analytics & Business Intelligence' },
  { value: 'fintech', label: 'FinTech' },
  { value: 'edtech', label: 'EdTech' },
  { value: 'healthtech', label: 'HealthTech' },
  { value: 'proptech', label: 'PropTech' },
  { value: 'ecommerce', label: 'E-Commerce & Online Retail' },
  { value: 'blockchain', label: 'Blockchain & Cryptocurrency' },
  { value: 'gaming', label: 'Gaming & Esports' },
  { value: 'telecommunications', label: 'Telecommunications' },
  { value: 'internet_services', label: 'Internet Services' },
  { value: 'hardware', label: 'Computer Hardware' },
  { value: 'semiconductors', label: 'Semiconductors' },
  { value: 'robotics', label: 'Robotics & Automation' },
  { value: 'iot', label: 'Internet of Things (IoT)' },

  // Finance & Insurance
  { value: 'banking', label: 'Banking' },
  { value: 'financial_services', label: 'Financial Services' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'investment_management', label: 'Investment Management' },
  { value: 'venture_capital', label: 'Venture Capital & Private Equity' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'wealth_management', label: 'Wealth Management' },
  { value: 'mortgage', label: 'Mortgage & Lending' },
  { value: 'credit_unions', label: 'Credit Unions' },
  { value: 'payments', label: 'Payment Processing' },

  // Healthcare & Life Sciences
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'hospitals', label: 'Hospitals & Health Systems' },
  { value: 'medical_devices', label: 'Medical Devices' },
  { value: 'pharmaceuticals', label: 'Pharmaceuticals' },
  { value: 'biotechnology', label: 'Biotechnology' },
  { value: 'dental', label: 'Dental' },
  { value: 'mental_health', label: 'Mental Health & Wellness' },
  { value: 'veterinary', label: 'Veterinary' },
  { value: 'home_health', label: 'Home Health Care' },
  { value: 'clinical_research', label: 'Clinical Research' },
  { value: 'medical_practice', label: 'Medical Practice' },
  { value: 'chiropractic', label: 'Chiropractic' },
  { value: 'optometry', label: 'Optometry' },
  { value: 'physical_therapy', label: 'Physical Therapy' },

  // Real Estate & Construction
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'commercial_real_estate', label: 'Commercial Real Estate' },
  { value: 'property_management', label: 'Property Management' },
  { value: 'construction', label: 'Construction' },
  { value: 'residential_construction', label: 'Residential Construction' },
  { value: 'commercial_construction', label: 'Commercial Construction' },
  { value: 'architecture', label: 'Architecture & Planning' },
  { value: 'civil_engineering', label: 'Civil Engineering' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical Services' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'painting', label: 'Painting & Coatings' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'home_improvement', label: 'Home Improvement' },
  { value: 'solar', label: 'Solar Energy' },
  { value: 'general_contracting', label: 'General Contracting' },
  { value: 'demolition', label: 'Demolition' },
  { value: 'interior_design', label: 'Interior Design' },

  // Professional Services
  { value: 'legal', label: 'Legal Services' },
  { value: 'consulting', label: 'Management Consulting' },
  { value: 'marketing_advertising', label: 'Marketing & Advertising' },
  { value: 'public_relations', label: 'Public Relations' },
  { value: 'staffing_recruiting', label: 'Staffing & Recruiting' },
  { value: 'human_resources', label: 'Human Resources' },
  { value: 'business_consulting', label: 'Business Consulting' },
  { value: 'it_consulting', label: 'IT Consulting' },
  { value: 'graphic_design', label: 'Graphic Design' },
  { value: 'web_design', label: 'Web Design & Development' },
  { value: 'seo', label: 'SEO & Digital Marketing' },
  { value: 'translation', label: 'Translation & Localization' },
  { value: 'photography', label: 'Photography' },
  { value: 'videography', label: 'Videography & Film' },
  { value: 'event_planning', label: 'Event Planning & Management' },
  { value: 'printing', label: 'Printing Services' },
  { value: 'security_services', label: 'Security Services' },
  { value: 'janitorial', label: 'Janitorial & Cleaning Services' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'moving_storage', label: 'Moving & Storage' },

  // Manufacturing & Industrial
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'aerospace', label: 'Aerospace & Defense' },
  { value: 'chemicals', label: 'Chemicals' },
  { value: 'plastics', label: 'Plastics & Rubber' },
  { value: 'metals', label: 'Metals & Mining' },
  { value: 'food_manufacturing', label: 'Food & Beverage Manufacturing' },
  { value: 'textiles', label: 'Textiles & Apparel Manufacturing' },
  { value: 'electronics_manufacturing', label: 'Electronics Manufacturing' },
  { value: 'packaging', label: 'Packaging & Containers' },
  { value: 'machinery', label: 'Machinery & Equipment' },
  { value: 'paper', label: 'Paper & Forest Products' },
  { value: 'glass', label: 'Glass & Ceramics' },
  { value: 'furniture_manufacturing', label: 'Furniture Manufacturing' },

  // Retail & Consumer
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale & Distribution' },
  { value: 'consumer_goods', label: 'Consumer Goods' },
  { value: 'luxury_goods', label: 'Luxury Goods & Jewelry' },
  { value: 'fashion', label: 'Fashion & Apparel' },
  { value: 'cosmetics', label: 'Cosmetics & Beauty' },
  { value: 'sporting_goods', label: 'Sporting Goods' },
  { value: 'pet_industry', label: 'Pet Industry' },
  { value: 'wine_spirits', label: 'Wine & Spirits' },
  { value: 'grocery', label: 'Grocery & Supermarkets' },
  { value: 'convenience_stores', label: 'Convenience Stores' },
  { value: 'auto_dealerships', label: 'Auto Dealerships' },

  // Food & Hospitality
  { value: 'restaurants', label: 'Restaurants' },
  { value: 'fast_food', label: 'Fast Food & Quick Service' },
  { value: 'bars_nightclubs', label: 'Bars & Nightclubs' },
  { value: 'catering', label: 'Catering' },
  { value: 'food_trucks', label: 'Food Trucks' },
  { value: 'bakeries', label: 'Bakeries & Cafes' },
  { value: 'hotels', label: 'Hotels & Resorts' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'travel_tourism', label: 'Travel & Tourism' },
  { value: 'airlines', label: 'Airlines & Aviation' },

  // Education
  { value: 'education', label: 'Education' },
  { value: 'higher_education', label: 'Higher Education' },
  { value: 'k12', label: 'K-12 Education' },
  { value: 'elearning', label: 'E-Learning & Online Courses' },
  { value: 'tutoring', label: 'Tutoring & Test Prep' },
  { value: 'vocational_training', label: 'Vocational & Trade Schools' },
  { value: 'childcare', label: 'Childcare & Daycare' },
  { value: 'driving_schools', label: 'Driving Schools' },

  // Energy & Environment
  { value: 'oil_gas', label: 'Oil & Gas' },
  { value: 'renewable_energy', label: 'Renewable Energy' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'environmental_services', label: 'Environmental Services' },
  { value: 'waste_management', label: 'Waste Management & Recycling' },
  { value: 'water_treatment', label: 'Water Treatment' },

  // Transportation & Logistics
  { value: 'transportation', label: 'Transportation' },
  { value: 'trucking', label: 'Trucking & Freight' },
  { value: 'shipping', label: 'Shipping & Maritime' },
  { value: 'logistics', label: 'Logistics & Supply Chain' },
  { value: 'warehousing', label: 'Warehousing & Storage' },
  { value: 'courier', label: 'Courier & Delivery Services' },
  { value: 'railroads', label: 'Railroads' },
  { value: 'towing', label: 'Towing Services' },
  { value: 'auto_repair', label: 'Auto Repair & Maintenance' },
  { value: 'car_wash', label: 'Car Wash & Detailing' },

  // Media & Entertainment
  { value: 'media', label: 'Media & Broadcasting' },
  { value: 'publishing', label: 'Publishing' },
  { value: 'music', label: 'Music Industry' },
  { value: 'film_production', label: 'Film & TV Production' },
  { value: 'animation', label: 'Animation' },
  { value: 'news', label: 'News & Journalism' },
  { value: 'podcasting', label: 'Podcasting' },
  { value: 'advertising_tech', label: 'Advertising Technology' },

  // Government & Non-Profit
  { value: 'government', label: 'Government & Public Sector' },
  { value: 'nonprofit', label: 'Non-Profit & NGO' },
  { value: 'religious', label: 'Religious Organizations' },
  { value: 'political', label: 'Political Organizations' },
  { value: 'military', label: 'Military & Defense' },
  { value: 'philanthropy', label: 'Philanthropy & Foundations' },

  // Agriculture & Farming
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'farming', label: 'Farming & Ranching' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'fisheries', label: 'Fisheries & Aquaculture' },
  { value: 'forestry', label: 'Forestry & Timber' },
  { value: 'cannabis', label: 'Cannabis & Hemp' },

  // Health & Fitness
  { value: 'gyms', label: 'Gyms & Fitness Centers' },
  { value: 'yoga_pilates', label: 'Yoga & Pilates Studios' },
  { value: 'spas', label: 'Spas & Salons' },
  { value: 'personal_training', label: 'Personal Training' },
  { value: 'martial_arts', label: 'Martial Arts Studios' },
  { value: 'sports_leagues', label: 'Sports Leagues & Clubs' },

  // Other Services
  { value: 'funeral_services', label: 'Funeral Services' },
  { value: 'laundry', label: 'Laundry & Dry Cleaning' },
  { value: 'storage', label: 'Self-Storage' },
  { value: 'vending', label: 'Vending Services' },
  { value: 'locksmith', label: 'Locksmith Services' },
  { value: 'staffing_agencies', label: 'Staffing Agencies' },
  { value: 'coworking', label: 'Coworking Spaces' },
  { value: 'franchise', label: 'Franchise Operations' },
];

// Countries
export const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'SE', label: 'Sweden' },
  { value: 'NO', label: 'Norway' },
  { value: 'DK', label: 'Denmark' },
  { value: 'FI', label: 'Finland' },
  { value: 'IE', label: 'Ireland' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'PT', label: 'Portugal' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'AT', label: 'Austria' },
  { value: 'BE', label: 'Belgium' },
  { value: 'PL', label: 'Poland' },
  { value: 'CZ', label: 'Czech Republic' },
  { value: 'IN', label: 'India' },
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'South Korea' },
  { value: 'SG', label: 'Singapore' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'IL', label: 'Israel' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'SA', label: 'Saudi Arabia' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'CO', label: 'Colombia' },
  { value: 'AR', label: 'Argentina' },
  { value: 'CL', label: 'Chile' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'KE', label: 'Kenya' },
  { value: 'EG', label: 'Egypt' },
  { value: 'PH', label: 'Philippines' },
  { value: 'TH', label: 'Thailand' },
  { value: 'VN', label: 'Vietnam' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'MY', label: 'Malaysia' },
  { value: 'TW', label: 'Taiwan' },
  { value: 'RO', label: 'Romania' },
  { value: 'UA', label: 'Ukraine' },
  { value: 'TR', label: 'Turkey' },
  { value: 'RU', label: 'Russia' },
  { value: 'CN', label: 'China' },
];

// US States
export const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming',
];

// Company sizes
export const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1,000 employees' },
  { value: '1001-5000', label: '1,001-5,000 employees' },
  { value: '5001-10000', label: '5,001-10,000 employees' },
  { value: '10001+', label: '10,000+ employees' },
];

// Annual revenue ranges
export const REVENUE_RANGES = [
  { value: '0-1M', label: '$0 - $1M' },
  { value: '1M-5M', label: '$1M - $5M' },
  { value: '5M-10M', label: '$5M - $10M' },
  { value: '10M-50M', label: '$10M - $50M' },
  { value: '50M-100M', label: '$50M - $100M' },
  { value: '100M-500M', label: '$100M - $500M' },
  { value: '500M-1B', label: '$500M - $1B' },
  { value: '1B+', label: '$1B+' },
];

// Company types
export const COMPANY_TYPES = [
  { value: 'privately_held', label: 'Privately Held' },
  { value: 'public', label: 'Public Company' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'nonprofit', label: 'Non-Profit' },
  { value: 'government', label: 'Government Agency' },
  { value: 'educational', label: 'Educational Institution' },
  { value: 'self_employed', label: 'Self-Employed' },
];

// Business types for AI filters
export const BUSINESS_TYPES = [
  { value: 'b2b', label: 'B2B' },
  { value: 'b2c', label: 'B2C' },
  { value: 'b2b2c', label: 'B2B2C' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'saas', label: 'SaaS' },
  { value: 'agency', label: 'Agency' },
  { value: 'franchise', label: 'Franchise' },
  { value: 'ecommerce', label: 'E-Commerce' },
];

export interface ProspectSearchFilters {
  // Company attributes
  industries: string[];
  industriesToExclude: string[];
  companySizes: string[];
  annualRevenue: string;
  companyTypes: string[];
  keywordsInclude: string[];
  keywordsExclude: string[];
  
  // Location
  countries: string[];
  countriesToExclude: string[];
  citiesOrStates: string[];
  citiesOrStatesToExclude: string[];
  
  // Products & services
  productsDescription: string;
  
  // AI filters
  businessTypes: string[];
  
  // Limit
  limit: number;
}

export const defaultFilters: ProspectSearchFilters = {
  industries: [],
  industriesToExclude: [],
  companySizes: [],
  annualRevenue: '',
  companyTypes: [],
  keywordsInclude: [],
  keywordsExclude: [],
  countries: [],
  countriesToExclude: [],
  citiesOrStates: [],
  citiesOrStatesToExclude: [],
  productsDescription: '',
  businessTypes: [],
  limit: 50,
};
