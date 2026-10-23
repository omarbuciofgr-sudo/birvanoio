// Brivano Prospecting Playbook content
// Merge tokens: {ownerName} {street} {area} {yourName} {company} {phone}
// Replace tokens at render time with the lead's data and the user's profile.
// Script wording is supplied by the product owner; do not rewrite it.

export type PlaybookRole = "agent" | "investor" | "leasing_agent" | "property_manager";
export type LeadType = "FSBO" | "FRBO";

export interface Objection {
  theySay: string;
  youSay: string;
}

export interface CallScript {
  id: string;
  title: string;
  leadType: LeadType;
  roles: PlaybookRole[];
  goal: string;
  opener: string;
  discovery: string[];
  bridge?: string;
  asks: { label: string; text: string }[];
  objections: Objection[];
  notes?: string[];
}

export const roleLabels: Record<PlaybookRole, string> = {
  agent: "Real estate agent",
  investor: "Investor / wholesaler",
  leasing_agent: "Leasing agent",
  property_manager: "Property manager",
};

export const gettingStarted = {
  intro:
    "Pick the one angle that matches your business, use that script for your first 100 dials, and only then start adjusting it. Every owner on your Brivano list is trying to do something without a professional; your job is to find the ones who are stuck, not to convince the ones who aren't.",
  mindset: [
    "You are calling to start a conversation, not to close on the first call. The goal of call one is a follow-up, a meeting, or a clear no.",
    "Most owners will say they don't need help. That's normal. The money is in the follow-up, when the listing has sat for 3 to 6 weeks.",
    "Ask more than you tell. A good call is roughly 70% them talking.",
    "Expect about 1 real conversation per 8 to 12 dials. Track it so the numbers don't feel personal.",
  ],
  dailyRhythm: [
    "Call new leads first, ideally within 24 hours of the listing appearing. Fresh owners are most likely to pick up.",
    "Block 60 to 90 minutes of calls, no email or admin in between.",
    "Text and email anyone you couldn't reach, the same day.",
    "Spend the last 15 minutes logging outcomes and setting follow-up dates.",
  ],
};

export const compliance = {
  disclaimer:
    "Calling owners about their listing is usually treated as telemarketing. This is a general overview, not legal advice; rules vary by state, so confirm with your broker or an attorney.",
  rules: [
    { title: "Scrub against Do Not Call lists", text: "Check numbers against the National DNC Registry and any state lists before calling. A public listing does not by itself give you permission to call a number on the registry." },
    { title: "Respect calling hours", text: "Call only between 8 a.m. and 9 p.m. in the owner's local time zone." },
    { title: "Keep an internal do-not-call list", text: "If someone says \"don't call me again,\" log it and honor it permanently." },
    { title: "Texting is stricter than calling", text: "Avoid automated or mass texting to people who haven't opted in. Manual, one-to-one texts after a real conversation are the safer route." },
    { title: "Identify yourself", text: "Give your name and company at the start of every call." },
    { title: "Agents", text: "Some brokerages have their own rules on calling FSBOs; check yours." },
  ],
  prepChecklist: [
    "Look at the listing: price, days on market, photos, any \"no agents\" note",
    "Know 2 to 3 nearby comps (sold prices or comparable rents)",
    "Note one specific detail you can mention (\"the updated kitchen,\" \"the corner lot\")",
    "Decide what you're asking for at the end of the call",
  ],
};

export const callScripts: CallScript[] = [
  {
    id: "fsbo-agent",
    title: "FSBO: agent seeking the listing",
    leadType: "FSBO",
    roles: ["agent"],
    goal: "Learn their timeline and motivation, earn the right to follow up, and book a 15-minute meeting if they're open. Don't pitch your commission or ask for the listing on call one.",
    opener:
      "Hi, is this {ownerName}? Hi {ownerName}, this is {yourName} with {company}. I saw your home on {street} is for sale by owner, and I'm not calling to talk you out of selling it yourself. I had a quick question, do you have a minute?",
    discovery: [
      "How's it been going so far? Getting many calls or showings?",
      "If it sells, where are you headed next?",
      "What's your timeline for being moved?",
      "How did you land on the price?",
      "What made you decide to sell it yourself? (Usually the answer is saving commission. Acknowledge it; don't argue.)",
      "If you got a buyer tomorrow, do you know what the next steps would be? (Inspection, appraisal, title, contract.)",
    ],
    bridge:
      "That makes sense. A lot of owners I talk to go the same route and do great. Where I usually help is the stuff after the offer: buyer financing falling through, appraisal coming in low, inspection negotiations. Would it be helpful if I sent you a free pricing report on what's sold nearby in the last 90 days? No strings.",
    asks: [
      { label: "Soft", text: "Can I send you that report and check back in a couple of weeks to see how it's going?" },
      { label: "Medium", text: "I work with buyers in this area too. If I have one who fits, would you be open to cooperating with a buyer's agent?" },
      { label: "Strong", text: "Would you be open to 15 minutes this week? I'll walk you through the comps, and if it's not a fit, you keep the report." },
    ],
    objections: [
      { theySay: "I don't want to pay a commission.", youSay: "Totally fair, that's why most people try it themselves. The real question is your net. If I could show you a way to net the same or more after fees, would that be worth 15 minutes?" },
      { theySay: "I've already got lots of interest.", youSay: "That's great. Out of curiosity, how many of those were pre-approved buyers? That's usually where things get tricky." },
      { theySay: "My neighbor/friend is an agent.", youSay: "Good to have someone you trust. If it doesn't work out with them, I'd love to be your backup. Mind if I send you the comps anyway?" },
      { theySay: "Call me in 30 days if it hasn't sold.", youSay: "Will do. I'll put it on my calendar. Anything I should keep an eye out for in the meantime?" },
      { theySay: "Are you just trying to get the listing?", youSay: "Honestly, eventually, if it makes sense for you. Today I'm just trying to be useful so you think of me if you need help." },
    ],
  },
  {
    id: "fsbo-investor",
    title: "FSBO: investor making a direct offer",
    leadType: "FSBO",
    roles: ["investor"],
    goal: "Find owners who value speed and certainty over top dollar, and get a walkthrough.",
    opener:
      "Hi {ownerName}, this is {yourName} with {company}. I saw your home on {street} is for sale by owner. I buy homes in {area} directly, as-is, and can close on your timeline without showings or repairs. Would you be open to a cash offer to compare against what you're seeing?",
    discovery: [
      "How long has it been on the market?",
      "What's your timeline for being moved?",
      "Is there anything the house needs?",
      "If it sold, what would you do next?",
      "Do you have a number in mind where a quick, as-is sale would make sense?",
    ],
    asks: [
      { label: "If motivated", text: "I can usually close in 2 to 3 weeks, as-is. Can I take a look this week and get you a real number?" },
      { label: "If not yet", text: "No problem. If it's still listed in a few weeks, can I check back in?" },
    ],
    objections: [
      { theySay: "What would you pay?", youSay: "Depends on condition. I'd want to see it in person. When's a good time this week?" },
      { theySay: "You'll lowball me.", youSay: "My offer will be below retail because I'm paying cash and taking it as-is. What you save is commissions, repairs, and time. I'll show you the math." },
    ],
  },
  {
    id: "frbo-investor",
    title: "FRBO: investor looking to buy the rental",
    leadType: "FRBO",
    roles: ["investor"],
    goal: "A landlord between tenants is most likely to think about selling. Find the tired landlords and plant the idea of a clean exit.",
    opener:
      "Hi, is this {ownerName}? This is {yourName} with {company}. I saw your place on {street} is up for rent. I'm a local investor and I buy rentals in {area}. Before you lock in a new tenant, would you ever consider selling it instead if the number made sense?",
    discovery: [
      "How long have you owned it?",
      "Is this your first rental or do you have a few?",
      "How's being a landlord been for you? (Listen for frustration: repairs, late rent, evictions.)",
      "Why is it vacant now? Did the last tenant leave on good terms?",
      "Is there anything it needs before the next tenant moves in?",
      "If you sold, what would you do with the money?",
      "Do you have a number in mind where selling would make sense?",
    ],
    asks: [
      { label: "If motivated", text: "I can usually close in 2 to 3 weeks, as-is, and you skip the turnover entirely. Can I take a look at it this week and get you a real number?" },
      { label: "If curious", text: "Fair enough. Rent it out, and if you ever get tired of it, I'll buy it with the tenant in place. Can I check back in a few months?" },
    ],
    objections: [
      { theySay: "It's not for sale.", youSay: "I get it, that's why I asked before you sign a new lease. If you ever change your mind, would you want a cash offer you can compare against?" },
      { theySay: "It's a great cash-flowing property.", youSay: "Then you're doing it right. Do you have others you're less happy with?" },
      { theySay: "What would you pay?", youSay: "Depends on condition. I'd want to see it in person. When's a good time this week?" },
      { theySay: "You'll lowball me.", youSay: "My offer will be below retail because I'm paying cash and taking it as-is. What you save is commissions, repairs, vacancy, and time. I'll show you the math." },
    ],
    notes: ["If they say no right away, ask how many rentals they have. A portfolio owner may want to sell a different property."],
  },
  {
    id: "frbo-agent",
    title: "FRBO: agent seeking to list it for sale",
    leadType: "FRBO",
    roles: ["agent"],
    goal: "Vacancy is the best time to sell a rental. Lead with that, and with what the owner's equity could do for them.",
    opener:
      "Hi {ownerName}, this is {yourName} with {company}. I saw your rental on {street} is available. I'm not calling about renting it. I work with a lot of landlords in {area}, and with values where they are, some are choosing to sell while the unit's empty. Has that crossed your mind at all?",
    discovery: [
      "How long have you owned it, and what did you buy it for? (Gauges equity.)",
      "Do you know roughly what it's worth today?",
      "How has the rent compared to your mortgage, taxes, and repairs lately?",
      "What would make selling worth it to you?",
      "Would you rather sell it empty or with a tenant in place?",
    ],
    bridge:
      "Vacant homes usually sell faster and for more, because I can market it to buyers who want to live there, not just investors. Would it help if I ran a quick valuation so you can compare selling against another year of renting?",
    asks: [
      { label: "Primary", text: "Can I send you a rent-versus-sell breakdown with a value estimate? Then you can decide before you sign a new lease." },
      { label: "If leaning toward renting", text: "Makes sense. Can I check in before the lease is up, so you have options?" },
    ],
    objections: [],
    notes: [
      "Their equity, not their monthly rent, is the big number. Show it.",
      "If they've owned it a while, a 1031 exchange may let them trade into a lower-maintenance property. Suggest they talk to a tax advisor; don't give tax advice.",
      "Selling during a vacancy avoids having to wait out a new 12-month lease.",
      "If they decide to rent, log the expected lease end date.",
    ],
  },
  {
    id: "frbo-leasing",
    title: "FRBO: leasing agent / tenant placement",
    leadType: "FRBO",
    roles: ["leasing_agent", "agent", "property_manager"],
    goal: "One-time service: you find and screen the tenant, the owner keeps managing. Your hook is vacancy cost.",
    opener:
      "Hi {ownerName}, this is {yourName} with {company}. I saw your place on {street} is for rent. I help owners find and screen tenants, and you stay in control after that. How's the search going so far?",
    discovery: [
      "How long has it been listed?",
      "How many inquiries or showings have you had?",
      "How are you screening applicants: credit, background, income, references?",
      "Have you had a tenant situation go badly before?",
      "When do you need someone moved in by?",
      "Do you prefer to handle the day-to-day yourself once someone's in?",
    ],
    bridge:
      "That's what most owners tell me. The part that takes the most time is fielding calls, doing showings, and screening properly. I handle all of that, and you only meet the tenant I'd recommend. My fee is usually less than what one extra vacant month costs you.",
    asks: [
      { label: "Soft", text: "Would it help if I sent you a rent analysis for your area, so you know you're priced to fill fast?" },
      { label: "Strong", text: "If you're not getting the right applicants in the next couple of weeks, would you be open to me taking it over?" },
    ],
    objections: [
      { theySay: "I can find a tenant myself.", youSay: "You probably can. The question is how fast and how well screened. One bad tenant can cost more than a year of fees." },
      { theySay: "How much do you charge?", youSay: "Typically [your fee], only when I place a tenant. If it doesn't rent, you pay nothing." },
      { theySay: "I already have showings lined up.", youSay: "Great. If none of them work out, keep my number. Want a screening checklist in the meantime?" },
    ],
  },
  {
    id: "frbo-pm",
    title: "FRBO: property management company",
    leadType: "FRBO",
    roles: ["property_manager"],
    goal: "Sell time back and fewer headaches. Best targets live far away, own several units, or just had a bad tenant.",
    opener:
      "Hi {ownerName}, this is {yourName} with {company}. We manage rentals in {area}, and I saw your place on {street} is available. I'm curious, are you managing it yourself, or is someone helping you?",
    discovery: [
      "How long have you been managing it yourself?",
      "Do you live nearby, or is it a drive for you?",
      "How many rentals do you own?",
      "What's the most frustrating part: tenant calls, repairs, collecting rent, turnover?",
      "Who handles maintenance when something breaks at 10 p.m.?",
      "Have you ever used a property manager? How did it go?",
    ],
    bridge:
      "That's really common. We take over everything you just mentioned: marketing, screening, rent collection, maintenance, and inspections, so you get a deposit and a monthly statement. Most owners tell us they wish they'd done it sooner.",
    asks: [
      { label: "Strong", text: "Can I come see the property this week and show you exactly what we'd charge and what rent we'd expect?" },
      { label: "Soft", text: "Can I send you our rental analysis and management overview? If this tenant search drags on, you'll have it." },
      { label: "Foot in the door", text: "If you'd rather keep managing, we also do tenant placement only. Want me to fill this vacancy for you?" },
    ],
    objections: [
      { theySay: "Managers are too expensive.", youSay: "Our fee is [your %]. Owners usually make that back through faster leasing, fewer vacancies, and vendor pricing on repairs. Want me to run the numbers on your unit?" },
      { theySay: "I had a bad experience with a manager.", youSay: "I'm sorry. What went wrong? [Listen.] Here's how we handle that differently." },
      { theySay: "I only have one property.", youSay: "Plenty of our owners started with one. It's the same headaches whether you have one or ten." },
      { theySay: "I like being in control.", youSay: "You'd still approve big repairs and the tenant. We just handle the calls and paperwork." },
    ],
  },
];

export const universalObjections: Objection[] = [
  { theySay: "How did you get my number?", youSay: "It was on your listing for {street}. I'm local and reach out to owners who list on their own." },
  { theySay: "I'm busy.", youSay: "No problem. Is there a better time later today or tomorrow? It'll take two minutes." },
  { theySay: "Not interested.", youSay: "Understood. Mind if I ask, is that not interested right now, or not at all?" },
  { theySay: "Just send me something.", youSay: "Happy to. So I send the right thing, what's the one thing you'd most want to know?" },
  { theySay: "Take me off your list.", youSay: "Absolutely, I'll remove you right now. Sorry for the bother. (Then mark the lead Do Not Call.)" },
];

export const voicemails: Record<LeadType, string> = {
  FSBO: "Hi {ownerName}, {yourName} with {company}. Saw your home on {street} and had a quick question about it, nothing pushy. Call or text me at {phone}. Again, {yourName}, {phone}.",
  FRBO: "Hi {ownerName}, {yourName} with {company}, calling about your rental on {street}. I had a quick question for you. My number is {phone}. Again, {yourName}, {phone}. Thanks.",
};

export const voicemailTips =
  "Keep voicemails under 20 seconds, say your number twice, and don't pitch. Curiosity gets more callbacks than a sales message.";

export const followUpCadence = [
  { day: 1, touch: "Call, voicemail, then text", purpose: "First contact" },
  { day: 3, touch: "Call", purpose: "Second attempt" },
  { day: 7, touch: "Email with something useful (comps, rent analysis)", purpose: "Give value" },
  { day: 14, touch: "Call", purpose: "\"How's it going?\" check-in" },
  { day: 30, touch: "Call or text", purpose: "Listing has likely gone stale; motivation rises" },
  { day: 60, touch: "Monthly check-in", purpose: "Stay top of mind" },
];

export const textTemplates: { id: string; label: string; leadType: LeadType | null; text: string }[] = [
  { id: "missed-fsbo", label: "After a missed call (FSBO)", leadType: "FSBO", text: "Hi {ownerName}, it's {yourName} with {company}. Just tried calling about your home on {street}. Had a quick question when you have a sec." },
  { id: "missed-frbo", label: "After a missed call (FRBO)", leadType: "FRBO", text: "Hi {ownerName}, {yourName} with {company} here. Called about your rental on {street}. Is it still available?" },
  { id: "after-convo", label: "After a conversation", leadType: null, text: "Great talking with you, {ownerName}. Here's that report I mentioned: [link]. Let me know if any questions come up." },
  { id: "checkin-30", label: "30-day check-in", leadType: null, text: "Hi {ownerName}, {yourName} here. Checking in on {street}. How's it going? Happy to help if anything's gotten stuck." },
];

export const textOptOutLine = "Reply STOP and I won't text again.";

export const callOutcomes = [
  "No answer",
  "Voicemail",
  "Conversation",
  "Not interested",
  "Appointment set",
  "Do not call",
] as const;

export type TokenKey = "ownerName" | "street" | "area" | "yourName" | "company" | "phone";

export function fillTokens(text: string, values: Partial<Record<TokenKey, string | null | undefined>>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    const v = (values as Record<string, string | null | undefined>)[key];
    return v && v.trim() ? v.trim() : match;
  });
}
