import client from "prom-client";

export const register = new client.Registry();

client.collectDefaultMetrics({
  register,
});

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  buckets: [50, 100, 200, 500, 1000, 3000],
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

export const businessCounters = {
  userSignups: new client.Counter({
    name: "business_user_signups_total",
    help: "Total number of successful user signups",
  }),
  loginAttempts: new client.Counter({
    name: "business_login_attempts_total",
    help: "Total number of login attempts",
    labelNames: ["result"], // "success" or "failure"
  }),
};

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(businessCounters.userSignups);
register.registerMetric(businessCounters.loginAttempts);
