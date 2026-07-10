/**
 * @jest-environment node
 */
import { createGreeting, packageInfo } from "../src/index";

test("creates a default greeting", () => {
  expect(createGreeting("Cheng")).toBe("Hello, Cheng!");
});

test("creates a greeting with custom punctuation", () => {
  expect(createGreeting("community", { punctuation: "." })).toBe(
    "Hello, community.",
  );
});

test("falls back to a friendly name when input is blank", () => {
  expect(createGreeting("   ")).toBe("Hello, friend!");
});

test("exposes package metadata", () => {
  expect(packageInfo.name).toBe("mazey-npm-template");
});
