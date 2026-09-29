export type ScriptKind = "call" | "sms" | "email";
export type OwnerSituation = "fsbo" | "frbo";

export type StarterScript = {
  key: string;
  situation: OwnerSituation;
  type: ScriptKind;
  name: string;
  subject?: string;
  body: string;
};

/** Category stored on saved scripts, e.g. "script_fsbo". */
export const scriptCategory = (s: OwnerSituation) => `script_${s}`;

export const STARTER_SCRIPTS: StarterScript[] = [
  {
    key: "fsbo-call", situation: "fsbo", type: "call", name: "FSBO call",
    body: `Hi {{owner_name}}, this is {{agent_name}} with {{brokerage}}. I saw your home at {{address}} is for sale by owner, and I wanted to reach out.

I'm not calling to pressure you into anything. A lot of owners selling on their own like having someone to answer quick questions about pricing, showings or paperwork.

How has it been going so far? Have you had many showings?

(If open) Would it help if I sent you a few recent sales nearby so you can see how your price compares?`,
  },
  {
    key: "fsbo-text", situation: "fsbo", type: "sms", name: "FSBO text",
    body: `Hi {{owner_name}}, this is {{agent_name}} with {{brokerage}}. I saw your home at {{address}} is for sale by owner. Happy to share recent nearby sales if that's helpful, no strings attached. Reply STOP to opt out.`,
  },
  {
    key: "fsbo-email", situation: "fsbo", type: "email", name: "FSBO email",
    subject: "Your home at {{address}}",
    body: `Hi {{owner_name}},

I noticed your home at {{address}} is listed for sale by owner. I'm {{agent_name}} with {{brokerage}}, and I work with sellers in the area.

If it would be useful, I can send you a short list of recent sales nearby so you can compare your price. There's no obligation.

Wishing you a smooth sale either way.

{{agent_name}}
{{brokerage}}`,
  },
  {
    key: "frbo-call", situation: "frbo", type: "call", name: "FRBO call",
    body: `Hi {{owner_name}}, this is {{agent_name}} with {{brokerage}}. I saw your rental at {{address}} and wanted to reach out.

A lot of owners renting on their own are busy handling showings, tenant screening and repairs. I help with that, but mostly I wanted to see how it's going.

Have you had much interest so far?

(If open) Would a quick look at what similar rentals nearby are going for be helpful?`,
  },
  {
    key: "frbo-text", situation: "frbo", type: "sms", name: "FRBO text",
    body: `Hi {{owner_name}}, this is {{agent_name}} with {{brokerage}}. I saw your rental at {{address}}. If you'd like, I can share what similar rentals nearby are leasing for. Reply STOP to opt out.`,
  },
  {
    key: "frbo-email", situation: "frbo", type: "email", name: "FRBO email",
    subject: "Your rental at {{address}}",
    body: `Hi {{owner_name}},

I came across your rental at {{address}}. I'm {{agent_name}} with {{brokerage}}, and I help owners in the area find and screen good tenants.

If it would help, I can send you a quick look at what similar rentals nearby are leasing for. No obligation at all.

Best,
{{agent_name}}
{{brokerage}}`,
  },
];

export const TYPE_LABEL: Record<ScriptKind, string> = { call: "Call script", sms: "Text message", email: "Email" };
