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
    "Pick the script for your business and use it word for word for your first 100 dials. Once it feels natural, put it in your own words. Every owner on your Brivano list is trying to do it without a professional. Your job is to find the ones who are stuck, not to convince the ones who aren't.",
  // Every script follows this five-step flow. Show it above the scripts.
  callFlow: [
    { step: "Ask about the listing", text: "\"I'm calling about the house on Maple Street. Is it still available?\" They posted it so people would call. This is the call they're expecting." },
    { step: "Say who you are and why you called", text: "Right away, in one sentence. Never let them think you're a buyer or renter." },
    { step: "Ask 2 or 3 questions", text: "Ask, then stop talking. Most of the call should be them." },
    { step: "Tie what you do to what they said", text: "One or two sentences, using their own words. Not a pitch." },
    { step: "Ask for one specific next step", text: "Offer two times (\"today at 4 or tomorrow at 10?\"), not \"sometime this week.\"" },
  ],
  mindset: [
    "The first call is short, usually 2 to 3 minutes. The goal is a meeting, a follow-up date, or a clear no.",
    "Most owners will say they don't need help. That's normal. Owners get more open after the listing has sat 3 to 6 weeks.",
    "Most conversations happen by the third attempt, so call each new lead at least three times before you give up.",
    "Expect about 1 real conversation per 8 to 12 dials. Track your numbers so a rough day doesn't feel personal.",
  ],
  dailyRhythm: [
    "Call new leads first, ideally within 24 hours of the listing going up. Fresh owners pick up the most.",
    "Block 60 to 90 minutes for calls, with no email or admin in between.",
    "Late morning and mid-afternoon tend to be best. Avoid early morning, lunch, and the evening commute.",
    "Text anyone you couldn't reach the same day, then log outcomes and set follow-up dates before you stop.",
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
    { title: "Be honest about who you are", text: "Give your name and say you're an agent, investor, or manager early. Never pose as a buyer or renter." },
    { title: "Agents", text: "Some brokerages have their own rules on calling FSBOs; check yours." },
  ],
  prepChecklist: [
    "Look at the listing: price, days posted, photos, any \"no agents\" note",
    "Know 2 or 3 nearby comps (sold prices or comparable rents)",
    "Note one specific thing you can mention (the price, how long it's been up, the photos)",
    "Decide which next step you'll ask for at the end",
  ],
};

export const callScripts: CallScript[] = [
  {
    id: "fsbo-agent",
    title: "FSBO: agent seeking the listing",
    leadType: "FSBO",
    roles: ["agent"],
    goal: "Find out where they're moving and how soon, then book a 15-minute visit. Don't argue about commission on this call.",
    opener:
      "Hi, is this {ownerName}? Hey {ownerName}, this is {yourName}. I'm calling about the house on {street}. Is it still for sale?\n\n[They answer]\n\nGreat. To be upfront, I'm a local agent, not a buyer. Mind if I ask you two quick questions about it?",
    discovery: [
      "If it sells this month, where are you headed next?",
      "And when do you need to be there?",
      "How'd you come up with your price?",
      "Are you open to buyers who have an agent, or only buyers without one?",
      "If it hasn't sold in 60 days, what's your plan?",
    ],
    bridge:
      "Makes sense. Most owners try it themselves to keep more money, and I get that. My job is to get you more after fees than you'd net on your own. If I can't show you that, I'll tell you.",
    asks: [
      { label: "Strong", text: "I can stop by for 15 minutes and show you what homes near you actually sold for. Would today at 4 or tomorrow at 10 be better?" },
      { label: "Soft", text: "Can I text you what's sold near you in the last 90 days? Then you'll know your price holds up." },
      { label: "If they say no", text: "No problem. I'll check back in two weeks to see how it's going. Fair?" },
    ],
    objections: [
      { theySay: "I'm not paying a commission.", youSay: "Totally fair. Can I ask, is it the commission itself, or what you walk away with? Because if I can't get you a higher net, you shouldn't hire me." },
      { theySay: "I've got lots of interest already.", youSay: "That's great. How many of them are pre-approved? That's usually where it falls apart." },
      { theySay: "My friend is an agent.", youSay: "Good to have. Are they helping you with this one? [If no] Then can I be your backup if it doesn't go the way you want?" },
      { theySay: "Call me if you have a buyer.", youSay: "Will do. What price and closing date would you need to say yes?" },
      { theySay: "You just want the listing.", youSay: "Eventually, if it makes sense for you. Today I just want to see if I can help." },
    ],
    notes: [
      "Why \"Is it still for sale?\" works: it's the call they posted the listing for, so they stay on the line. Say you're an agent right after.",
      "\"Where are you headed next?\" gets them talking about their goal, not the house. Their answer tells you how motivated they are.",
      "\"What price and closing date would you need?\" turns a brush-off into useful information.",
    ],
  },
  {
    id: "fsbo-investor",
    title: "FSBO: investor making a direct offer",
    leadType: "FSBO",
    roles: ["investor"],
    goal: "Find the sellers who care more about speed and skipping repairs than top dollar, and get a walkthrough.",
    opener:
      "Hi, is this {ownerName}? Hey, it's {yourName}. I'm calling about the house on {street}. Is it still available?\n\n[They answer]\n\nGreat. I'm a local investor. I buy houses as-is for cash. Would you consider an offer if it meant no repairs, no showings, and you pick the closing date?",
    discovery: [
      "What's got you selling?",
      "How soon do you need to be out?",
      "What shape is it in? Anything that needs work, like the roof, HVAC, or kitchen?",
      "Is anyone living there right now?",
      "If I paid cash and covered closing costs, what would you need to walk away with?",
    ],
    bridge:
      "Okay. I'll be straight with you: I can't pay retail. What I can do is take it as-is, cover closing, and close when you want. Let me look at the numbers and come back with a real offer.",
    asks: [
      { label: "If motivated", text: "I'd like to see it before I give you a number. Is tomorrow after 5 or Saturday morning better?" },
      { label: "If not yet", text: "Totally fine. If it's still listed in three weeks, mind if I check back?" },
    ],
    objections: [
      { theySay: "What would you pay?", youSay: "Depends on condition, and I don't want to throw out a wrong number. What would you need to get?" },
      { theySay: "You'll lowball me.", youSay: "My offer will be under retail, I won't pretend it isn't. The question is whether skipping repairs, fees, and months of waiting is worth the difference. That's your call." },
      { theySay: "Not interested.", youSay: "Understood. Just so I know, is there anything that would make you consider an offer in the next year?" },
      { theySay: "I want full price.", youSay: "That makes sense if the house is ready and you've got time. If either of those changes, keep my number." },
    ],
    notes: [
      "Be upfront that you buy below retail. The sellers who say yes anyway are your real leads.",
      "Get them to name a number first. Whoever says a number first sets the range.",
      "Condition, motivation, timeline, price: if you leave the call knowing all four, it was a good call.",
    ],
  },
  {
    id: "frbo-investor",
    title: "FRBO: investor looking to buy the rental",
    leadType: "FRBO",
    roles: ["investor"],
    goal: "Catch tired landlords between tenants, when the cost of owning hurts most, and plant the idea of selling.",
    opener:
      "Hi, is this {ownerName}? Hey, it's {yourName}. I'm calling about your rental on {street}. Is it still available?\n\n[They answer]\n\nOkay. I'm not looking to rent, I'm a local investor who buys rentals. Before you sign a new lease, would you ever sell it if the number was right?",
    discovery: [
      "How long have you owned it?",
      "Is this your only rental, or do you have a few?",
      "Honestly, how's being a landlord been?",
      "Why did the last tenant leave?",
      "What does it need before someone moves in?",
      "If you did sell, what number would make it worth it?",
    ],
    bridge:
      "Sounds like turnover is the worst part. If I bought it, you'd skip the repairs, the showings, and the next tenant entirely. I can usually close in a few weeks.",
    asks: [
      { label: "If motivated", text: "Can I come see it while it's empty? Tomorrow afternoon or Saturday morning?" },
      { label: "If not", text: "Go ahead and rent it. I buy with tenants in place too. Mind if I check in after it's leased?" },
    ],
    objections: [
      { theySay: "It's not for sale.", youSay: "Understood, that's why I called before the lease is signed. Do you have any other rentals you'd think about selling?" },
      { theySay: "It cash flows great.", youSay: "Then keep it. Is there one in your portfolio that doesn't?" },
      { theySay: "What would you pay?", youSay: "Depends on condition. I don't want to guess wrong. What would you need to get?" },
      { theySay: "You'll lowball me.", youSay: "My offer will be under retail, I won't pretend otherwise. What you'd save is turnover, repairs, agent fees, and time. You can decide if that's worth it." },
    ],
    notes: [
      "Vacancy is when landlords feel the cost of owning the most. That's why you call now.",
      "\"How's being a landlord been?\" is the key question. Let them vent. The more they complain, the better the lead.",
      "A no on this property is often a yes on another one. Always ask about their other rentals.",
    ],
  },
  {
    id: "frbo-agent",
    title: "FRBO: agent seeking to list it for sale",
    leadType: "FRBO",
    roles: ["agent"],
    goal: "Get them curious about what the property is worth, then offer a sell-versus-rent comparison.",
    opener:
      "Hi, is this {ownerName}? Hey, it's {yourName}. I'm calling about your rental on {street}. Is it still available?\n\n[They answer]\n\nGreat. I'm a local agent, not a renter. Quick question: since it's sitting empty, have you thought about selling instead?",
    discovery: [
      "How long have you owned it?",
      "Do you know roughly what it's worth today?",
      "After the mortgage, taxes, and repairs, what's it actually making you each month?",
      "If you sold, what would you do with the money?",
      "Would it be easier to sell now while it's empty, or later with a tenant in it?",
    ],
    bridge:
      "A lot of owners don't realize how much equity they're sitting on. Empty homes also sell faster, and I can market it to people who want to live there, not just investors. That usually means a better price.",
    asks: [
      { label: "Primary", text: "Let me put together a quick sell-versus-rent comparison. I can walk you through it tomorrow at 10 or 4. Which works?" },
      { label: "If they're renting it", text: "Fair. When does the new lease end? I'll check back a couple of months before, so you have options." },
    ],
    objections: [
      { theySay: "It's an investment. I'm not selling.", youSay: "Makes sense. Do you know what it's worth today? Most owners like knowing the number, even if they keep it." },
      { theySay: "The taxes would kill me.", youSay: "That's worth knowing before you decide. A tax advisor can tell you about options like a 1031 exchange. Want me to get you the value so you can ask them with real numbers?" },
      { theySay: "Maybe later.", youSay: "Got it. Roughly when? I'll set a reminder and check back then." },
      { theySay: "Rents are great right now.", youSay: "True. Want to see it side by side, a few more years of renting versus selling now? Takes me 10 minutes to put together." },
    ],
    notes: [
      "The value estimate is your hook. Owners want to know what their property is worth, even if they plan to keep it.",
      "Don't give tax advice. Point them to a tax advisor.",
      "Log the lease end date. That's your next best call.",
    ],
  },
  {
    id: "frbo-leasing",
    title: "FRBO: leasing agent / tenant placement",
    leadType: "FRBO",
    roles: ["leasing_agent", "agent", "property_manager"],
    goal: "Show them what a vacant month costs, then offer to take over showings and screening.",
    opener:
      "Hi, is this {ownerName}? Hey, it's {yourName}. I'm calling about your rental on {street}. Is it still available?\n\n[They answer]\n\nOkay. Full disclosure, I'm a leasing agent, not a renter. How's the search going? Getting good applicants?",
    discovery: [
      "How long has it been listed?",
      "How many showings have you done so far?",
      "How are you screening people: credit, income, background?",
      "When do you need someone moved in?",
      "Once it's rented, do you want to keep managing it yourself?",
    ],
    bridge:
      "Every month it sits empty costs you a full month's rent. I handle the showings and the screening, and you just approve the tenant. My fee is usually less than one empty month.",
    asks: [
      { label: "Strong", text: "Want me to take over showings this week? I can come see the unit tomorrow at 11 or 3." },
      { label: "Soft", text: "Can I text you what similar units nearby actually rented for? If you're priced high, that's usually why it's slow." },
      { label: "If they say no", text: "No problem. If it's still open in two weeks, can I take a shot at it?" },
    ],
    objections: [
      { theySay: "I can find someone myself.", youSay: "I'm sure you can. The question is how fast, and how well screened. One bad tenant can cost more than years of fees." },
      { theySay: "How much do you charge?", youSay: "[your fee], and only if I place a tenant. If it doesn't rent, you owe nothing." },
      { theySay: "I've got showings lined up.", youSay: "Great. If none of them work out, call me and I'll start the same day." },
    ],
    notes: [
      "Lead with the cost of vacancy. It makes your fee feel small.",
      "Look at the listing first. Weak photos or a high price give you a specific reason to call.",
    ],
  },
  {
    id: "frbo-pm",
    title: "FRBO: property management company",
    leadType: "FRBO",
    roles: ["property_manager"],
    goal: "Find out what's eating their time, then offer to see the property and show your pricing.",
    opener:
      "Hi, is this {ownerName}? Hey, it's {yourName} with {company}. I'm calling about your rental on {street}. Is it still available?\n\n[They answer]\n\nGreat. I'm not a renter. We manage rentals in {area}. Are you handling this one yourself right now?",
    discovery: [
      "How long have you been managing it yourself?",
      "Do you live close by, or is it a drive?",
      "How many rentals do you have?",
      "What's been the biggest headache this year? [Repeat their answer back before moving on.]",
      "Who takes the call when something breaks at night?",
      "Ever used a manager before? How'd that go?",
    ],
    bridge:
      "So [their headache] is what's eating your time. That's exactly what we take off your plate: screening, rent, repairs, all of it. You get a deposit and a statement every month.",
    asks: [
      { label: "Strong", text: "Can I come see the unit and show you what we'd charge and what we think it'll rent for? Thursday or Friday?" },
      { label: "Soft", text: "Want me to send our pricing and a rent estimate so you have it handy?" },
      { label: "Foot in the door", text: "If you'd rather keep managing, we can just find you a tenant for this one. Want me to do that?" },
    ],
    objections: [
      { theySay: "Managers are too expensive.", youSay: "Our fee is [your %]. Most owners make that back through faster leasing and cheaper repairs. Want me to run the numbers on your unit?" },
      { theySay: "I had a bad experience with a manager.", youSay: "I'm sorry. What went wrong? [Listen.] Here's how we handle that differently." },
      { theySay: "I already have a manager.", youSay: "Good. What's working, and what would you change if you could?" },
      { theySay: "I only have one property.", youSay: "Plenty of our owners started with one. It's the same headaches with one or ten." },
      { theySay: "I like being in control.", youSay: "You'd still approve the tenant and any big repairs. We just take the calls and the paperwork." },
    ],
    notes: [
      "\"What's been the biggest headache this year?\" is the most important question on this call. Repeat their answer back before you say anything about your company.",
      "Best targets live far from the property, own several units, or just had a bad tenant.",
    ],
  },
];

export const universalObjections: Objection[] = [
  { theySay: "How did you get my number?", youSay: "It was on your listing for {street}." },
  { theySay: "I'm busy.", youSay: "No problem. Is later today or tomorrow morning better? It'll take two minutes." },
  { theySay: "Not interested.", youSay: "Understood. Is that not right now, or not at all?" },
  { theySay: "Just send me something.", youSay: "Happy to. So I send the right thing, what would you most want to know?" },
  { theySay: "Take me off your list.", youSay: "Absolutely, I'll remove you right now. Sorry to bother you. (Then mark the lead Do Not Call.)" },
];

export const voicemails: Record<LeadType, string> = {
  FSBO: "Hi {ownerName}, it's {yourName}, calling about the house on {street}. Quick question for you. Call or text me at {phone}. Again, {yourName}, {phone}.",
  FRBO: "Hi {ownerName}, it's {yourName}, calling about your rental on {street}. Quick question for you. Call or text me at {phone}. Again, {yourName}, {phone}.",
};

export const voicemailTips =
  "Keep voicemails under 20 seconds, say your number twice, and don't pitch. Curiosity gets more callbacks than a sales message.";

export const followUpCadence = [
  { day: 1, touch: "Call, voicemail, then text", purpose: "First contact" },
  { day: 3, touch: "Call", purpose: "Second attempt" },
  { day: 7, touch: "Call, then email something useful (comps, rent check)", purpose: "Third attempt and give value" },
  { day: 14, touch: "Call", purpose: "\"How's it going?\" check-in" },
  { day: 30, touch: "Call or text", purpose: "Listing has likely gone stale; owners get more open" },
  { day: 60, touch: "Monthly check-in", purpose: "Stay top of mind" },
];

export const textTemplates: { id: string; label: string; leadType: LeadType | null; text: string }[] = [
  { id: "missed-fsbo", label: "After a missed call (FSBO)", leadType: "FSBO", text: "Hi {ownerName}, it's {yourName}. Just tried calling about your house on {street}. Is it still for sale?" },
  { id: "missed-frbo", label: "After a missed call (FRBO)", leadType: "FRBO", text: "Hi {ownerName}, it's {yourName}. Just called about your rental on {street}. Is it still available?" },
  { id: "after-convo", label: "After a conversation", leadType: null, text: "Great talking with you, {ownerName}. Here's what I mentioned: [link]. Let me know if any questions come up." },
  { id: "checkin-30", label: "30-day check-in", leadType: null, text: "Hi {ownerName}, {yourName} here. Checking in on {street}. How's it going?" },
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
