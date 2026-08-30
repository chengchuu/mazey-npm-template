/**
 * @author Cheng
 */

import type { CreateGreetingOptions } from "./typing";

export type { CreateGreetingOptions } from "./typing";

/**
 * Create a friendly greeting message.
 *
 * @param name - The name to include in the greeting.
 * @param options - Optional formatting options.
 * @returns The generated greeting message.
 */
export function createGreeting(
  name: string,
  options: CreateGreetingOptions = {},
): string {
  const normalizedName = name.trim();
  const punctuation = options.punctuation ?? "!";

  return `Hello, ${normalizedName || "friend"}${punctuation}`;
}
