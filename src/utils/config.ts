import configs from "@/config";

/**
 * Build nested dot-path keys
 */
type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never;

type Paths<T> = {
  [K in keyof T & string]: T[K] extends object ? K | Join<K, Paths<T[K]>> : K;
}[keyof T & string];

/**
 * Resolve value type from dot path
 */
type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

type ConfigKey = Paths<typeof configs>;

export function config<K extends ConfigKey>(
  key: K
): PathValue<typeof configs, K> {
  const value = key
    .split(".")
    .reduce<unknown>((obj, part) => {
      if (obj && typeof obj === "object" && part in (obj as Record<string, unknown>)) {
        return (obj as Record<string, unknown>)[part];
      }
      return undefined;
    }, configs as unknown);

  return value as PathValue<typeof configs, K>;
}
