import { describe, expect, test } from "bun:test";
import { fillTokens } from "../data/playbookContent";
import { canCallOrText, outcomeEffects, scriptsFor, scriptParts, spokenScriptText, toLeadType, tokenValues } from "./playbook";

describe("stage directions", () => {
  test("excludes answer cues while preserving paragraph breaks in copied speech", () => {
    expect(spokenScriptText("Is it still for sale?\n\n[They answer]\n\nGreat."))
      .toBe("Is it still for sale?\n\nGreat.");
  });
  test("excludes inline coaching and conditional cues", () => {
    expect(spokenScriptText("What went wrong? [Listen.] Tell me. [If no] Ask again. [Repeat their answer back before moving on.]"))
      .toBe("What went wrong? Tell me. Ask again.");
  });
  test("keeps fill-in placeholders copyable", () => {
    expect(spokenScriptText("[your fee] [your %] [their headache] [link]"))
      .toBe("[your fee] [your %] [their headache] [link]");
  });
  test("classifies coaching separately from fill-in values", () => {
    expect(scriptParts("[They answer] [your fee]").filter((part) => part.cue).map((part) => part.text))
      .toEqual(["[They answer]"]);
  });
});

describe("tokens", () => {
  test("fills tokens from lead and profile", () => {
    const v = tokenValues(
      { contact_name: "Maria Lopez", business_name: "12 Oak St, Naperville, IL", city: "Naperville" },
      { first_name: "Sam", last_name: "Lee", brokerage: "Acme Realty", phone: "555-0100" },
    );
    expect(fillTokens("Hi {ownerName}, {yourName} with {company} about {street} in {area}. {phone}", v))
      .toBe("Hi Maria, Sam Lee with Acme Realty about 12 Oak St in Naperville. 555-0100");
  });
  test("leaves unknown tokens visible and uses 'there' without owner name", () => {
    expect(fillTokens("Hi {ownerName}, {company}", tokenValues(null, null))).toBe("Hi there, {company}");
  });
  test("maps listing_type", () => {
    expect(toLeadType("fsbo")).toBe("FSBO");
    expect(toLeadType("frbo")).toBe("FRBO");
    expect(toLeadType(null)).toBeNull();
  });
});

describe("script matching", () => {
  test("FRBO + property manager shows leasing and PM scripts", () => {
    expect(scriptsFor("FRBO", "property_manager").map((s) => s.id)).toEqual(["frbo-leasing", "frbo-pm"]);
  });
  test("FSBO + investor shows only investor script", () => {
    expect(scriptsFor("FSBO", "investor").map((s) => s.id)).toEqual(["fsbo-investor"]);
  });
  test("show all puts role matches first", () => {
    expect(scriptsFor("FRBO", "leasing_agent", true)[0].id).toBe("frbo-leasing");
    expect(scriptsFor("FRBO", "leasing_agent", true)).toHaveLength(4);
  });
});

describe("outcomes", () => {
  test("no answer counts toward contacted goal", () => {
    expect(outcomeEffects("no_answer").countsAsContacted).toBe(true);
  });
  test("do not call marks lead and blocks follow-up", () => {
    expect(outcomeEffects("do_not_call").markDoNotContact).toBe(true);
    expect(outcomeEffects("do_not_call").allowFollowUp).toBe(false);
  });
  test("appointment set moves stage", () => {
    expect(outcomeEffects("appointment_set").setStatus).toBe("appointment_set");
    expect(outcomeEffects("conversation").setStatus).toBeNull();
  });
  test("do-not-contact lead hides call/text", () => {
    expect(canCallOrText({ do_not_contact: true })).toBe(false);
    expect(canCallOrText({ do_not_contact: false })).toBe(true);
  });
});
