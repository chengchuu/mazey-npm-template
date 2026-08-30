/**
 * @author Cheng
 */

/**
 * Options for creating a greeting message.
 */
export interface CreateGreetingOptions {
  /**
   * The punctuation appended to the generated greeting.
   *
   * @defaultValue "!"
   */
  punctuation?: string;
}

/**
 * Basic package metadata exposed by the library.
 */
export interface PackageInfo {
  name: string;
  version: string;
}
