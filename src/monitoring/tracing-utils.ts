import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("veylo-backend-tracer");

/**
 * Wraps a function in a custom span for distributed tracing.
 * @param name The name of the span
 * @param fn The async function to execute
 */
export async function withTrace<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    } finally {
      span.end();
    }
  });
}

export { tracer };
