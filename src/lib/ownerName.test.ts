import { expect, test } from "bun:test";
import { ownerNameText } from "./ownerName";
test("owner name objects become text", () => {
  expect(ownerNameText("Jane")).toBe("Jane");
  expect(ownerNameText({ first: "A", last: "B" })).toBe("A B");
  expect(ownerNameText({ full: "X Y", first: "X" })).toBe("X Y");
  expect(ownerNameText({ fullName: "Z" })).toBe("Z");
  expect(ownerNameText(42)).toBeNull();
});
