type EnumValues<T extends readonly string[]> = T[number];

class EnvBuilder {
  constructor(
    private key: string,
    private value: string | undefined,
  ) {}

  private fail(message: string): never {
    throw new Error(`[ENV] ${this.key}: ${message}`);
  }

  raw(): string | undefined {
    return this.value;
  }

  required(): string {
    if (!this.value || this.value.trim() === "") {
      this.fail("is required");
    }

    return this.value;
  }

  string(defaultValue = ""): string {
    return this.value ?? defaultValue;
  }

  int(defaultValue = 0): number {
    const val = parseInt(this.value ?? "", 10);

    if (Number.isNaN(val)) return defaultValue;

    return val;
  }

  number(defaultValue = 0): number {
    const val = Number(this.value);

    if (Number.isNaN(val)) return defaultValue;

    return val;
  }

  float(defaultValue = 0): number {
    const val = parseFloat(this.value ?? "");

    if (Number.isNaN(val)) return defaultValue;

    return val;
  }

  boolean(defaultValue = false): boolean {
    if (this.value === undefined) return defaultValue;

    return ["true", "1", "yes", "on"].includes(this.value.toLowerCase());
  }

  array(separator = ","): string[] {
    if (!this.value) return [];

    return this.value
      .split(separator)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  json<T = unknown>(defaultValue?: T): T {
    if (!this.value) {
      if (defaultValue !== undefined) return defaultValue;
      this.fail("missing JSON value");
    }

    try {
      return JSON.parse(this.value!) as T;
    } catch {
      this.fail("invalid JSON");
    }
  }

  enum<const T extends readonly string[]>(
    values: T,
    defaultValue?: EnumValues<T>,
  ): EnumValues<T> {
    const val = this.value ?? defaultValue;

    if (!val || !values.includes(val)) {
      this.fail(`must be one of: ${values.join(", ")}`);
    }

    return val as EnumValues<T>;
  }

  url(defaultValue?: string): string {
    const val = this.value ?? defaultValue;

    if (!val) this.fail("missing URL");

    try {
      new URL(val);
      return val;
    } catch {
      this.fail("invalid URL");
    }
  }
}

export function env(key: string): EnvBuilder {
  return new EnvBuilder(key, process.env[key]);
}
