import type { CompanyResult } from '@/lib/api/industrySearch';

/** Derive Apollo-style employee range label from a numeric headcount. */
export function employeeCountToRange(count: number | null | undefined): string {
  if (!count || count <= 0) return '';
  if (count >= 10001) return '10,001+ employees';
  if (count >= 5001) return '5,001-10,000 employees';
  if (count >= 1001) return '1,001-5,000 employees';
  if (count >= 501) return '501-1,000 employees';
  if (count >= 201) return '201-500 employees';
  if (count >= 51) return '51-200 employees';
  if (count >= 11) return '11-50 employees';
  return '1-10 employees';
}

export const PEOPLE_EXPORT_HEADERS = [
  'Name',
  'Title',
  'Headline',
  'Seniority',
  'Departments',
  'Organization',
  'Domain',
  'Work Email',
  'Phone',
  'Mobile Phone',
  'Industry',
  'Employees',
  'Employee Range',
  'Revenue',
  'Founded',
  'City',
  'State',
  'Country',
  'LinkedIn',
  'Technologies',
] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const s = String(value).replace(/"/g, '""');
  return `"${s}"`;
}

/** Map a preview row (person) to CSV column values in PEOPLE_EXPORT_HEADERS order. */
export function peopleRowToExportValues(row: CompanyResult): string[] {
  const employeeRange = row.employee_range || employeeCountToRange(row.employee_count);
  return [
    row.name,
    row.job_title || '',
    row.headline || '',
    row.seniority || '',
    (row.keywords || []).join('; '),
    (row.organization_name || '').trim(),
    row.domain || '',
    row.email || '',
    row.phone || '',
    row.mobile_phone || '',
    row.industry || '',
    row.employee_count?.toString() || '',
    employeeRange,
    row.annual_revenue?.toString() || '',
    row.founded_year?.toString() || '',
    row.headquarters_city || '',
    row.headquarters_state || '',
    row.headquarters_country || '',
    row.linkedin_url || '',
    (row.technologies || []).join('; '),
  ];
}

export function buildPeopleExportCsv(rows: CompanyResult[]): string {
  const lines = [
    PEOPLE_EXPORT_HEADERS.join(','),
    ...rows.map((row) => peopleRowToExportValues(row).map(csvEscape).join(',')),
  ];
  return lines.join('\n');
}

export function downloadPeopleCsv(rows: CompanyResult[], filename?: string): void {
  const csv = buildPeopleExportCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `people-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
