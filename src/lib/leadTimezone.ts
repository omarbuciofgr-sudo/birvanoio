/** Resolve a best-guess IANA timezone for a lead. */

const US_STATE_TZ: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix",
  AR: "America/Chicago", CA: "America/Los_Angeles", CO: "America/Denver",
  CT: "America/New_York", DE: "America/New_York", FL: "America/New_York",
  GA: "America/New_York", HI: "Pacific/Honolulu", ID: "America/Boise",
  IL: "America/Chicago", IN: "America/Indiana/Indianapolis", IA: "America/Chicago",
  KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago",
  ME: "America/New_York", MD: "America/New_York", MA: "America/New_York",
  MI: "America/Detroit", MN: "America/Chicago", MS: "America/Chicago",
  MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York", NJ: "America/New_York",
  NM: "America/Denver", NY: "America/New_York", NC: "America/New_York",
  ND: "America/Chicago", OH: "America/New_York", OK: "America/Chicago",
  OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago",
  TX: "America/Chicago", UT: "America/Denver", VT: "America/New_York",
  VA: "America/New_York", WA: "America/Los_Angeles", WV: "America/New_York",
  WI: "America/Chicago", WY: "America/Denver", DC: "America/New_York",
};

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN",
  texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
};

/** Rough country default. */
const COUNTRY_TZ: Record<string, string> = {
  US: "America/New_York", USA: "America/New_York",
  CA: "America/Toronto", CAN: "America/Toronto",
  MX: "America/Mexico_City",
  UK: "Europe/London", GB: "Europe/London",
  IE: "Europe/Dublin", FR: "Europe/Paris", DE: "Europe/Berlin",
  ES: "Europe/Madrid", IT: "Europe/Rome", NL: "Europe/Amsterdam",
  SE: "Europe/Stockholm", NO: "Europe/Oslo", DK: "Europe/Copenhagen",
  FI: "Europe/Helsinki", PL: "Europe/Warsaw", CH: "Europe/Zurich",
  AT: "Europe/Vienna", BE: "Europe/Brussels", PT: "Europe/Lisbon",
  AU: "Australia/Sydney", NZ: "Pacific/Auckland",
  JP: "Asia/Tokyo", KR: "Asia/Seoul", CN: "Asia/Shanghai",
  IN: "Asia/Kolkata", SG: "Asia/Singapore", HK: "Asia/Hong_Kong",
  BR: "America/Sao_Paulo", AR: "America/Argentina/Buenos_Aires",
  ZA: "Africa/Johannesburg", AE: "Asia/Dubai", IL: "Asia/Jerusalem",
};

/** Phone dialing code → country hint (small set). */
function phoneCountry(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) return null;
  const p = digits.slice(1);
  if (p.startsWith("1")) return "US"; // NANP — could be CA too, default US
  if (p.startsWith("44")) return "GB";
  if (p.startsWith("33")) return "FR";
  if (p.startsWith("49")) return "DE";
  if (p.startsWith("34")) return "ES";
  if (p.startsWith("39")) return "IT";
  if (p.startsWith("31")) return "NL";
  if (p.startsWith("46")) return "SE";
  if (p.startsWith("47")) return "NO";
  if (p.startsWith("45")) return "DK";
  if (p.startsWith("358")) return "FI";
  if (p.startsWith("48")) return "PL";
  if (p.startsWith("41")) return "CH";
  if (p.startsWith("43")) return "AT";
  if (p.startsWith("32")) return "BE";
  if (p.startsWith("351")) return "PT";
  if (p.startsWith("353")) return "IE";
  if (p.startsWith("61")) return "AU";
  if (p.startsWith("64")) return "NZ";
  if (p.startsWith("81")) return "JP";
  if (p.startsWith("82")) return "KR";
  if (p.startsWith("86")) return "CN";
  if (p.startsWith("91")) return "IN";
  if (p.startsWith("65")) return "SG";
  if (p.startsWith("852")) return "HK";
  if (p.startsWith("52")) return "MX";
  if (p.startsWith("55")) return "BR";
  if (p.startsWith("54")) return "AR";
  if (p.startsWith("27")) return "ZA";
  if (p.startsWith("971")) return "AE";
  if (p.startsWith("972")) return "IL";
  return null;
}

export type TzSource = "state" | "phone" | "country";

export interface ResolvedTz {
  tz: string | null;
  source: TzSource | null;
}

export function resolveLeadTimezone(input: {
  state?: string | null;
  city?: string | null;
  phone?: string | null;
  country?: string | null;
}): ResolvedTz {
  const stateRaw = (input.state || "").trim();
  if (stateRaw) {
    const upper = stateRaw.toUpperCase();
    if (US_STATE_TZ[upper]) return { tz: US_STATE_TZ[upper], source: "state" };
    const code = STATE_NAME_TO_CODE[stateRaw.toLowerCase()];
    if (code && US_STATE_TZ[code]) return { tz: US_STATE_TZ[code], source: "state" };
  }
  if (input.phone) {
    const cc = phoneCountry(input.phone);
    if (cc && COUNTRY_TZ[cc]) return { tz: COUNTRY_TZ[cc], source: "phone" };
  }
  if (input.country) {
    const c = input.country.trim().toUpperCase();
    if (COUNTRY_TZ[c]) return { tz: COUNTRY_TZ[c], source: "country" };
  }
  return { tz: null, source: null };
}
