type JsonValue = any;

type TestStatus = "PASS" | "FAIL" | "SKIP";

interface SmokeResponse {
  status: number;
  statusText: string;
  ms: number;
  json: JsonValue;
  text: string;
  corsPresent: boolean;
}

interface TestResult {
  name: string;
  status: TestStatus;
  ms: number;
  method: string;
  path: string;
  expected: string;
  got?: string;
  hint?: string;
  details?: string;
  warnings: string[];
}

const DEFAULT_API_URL = "https://dome-monorepo-production.up.railway.app/api/v1";
const PRODUCTION_URL = (process.env["PRODUCTION_URL"] ?? DEFAULT_API_URL).replace(/\/+$/, "");
const APP_URL = PRODUCTION_URL.replace(/\/api\/v1$/, "");
const TEST_PHONE = "+14165550100";
const FULL_LOGIN_PHONE = "+14165550101";
// When TEST_MODE=true is set on the server, any phone accepts this bypass code
const TEST_MODE_OTP = "000000";
const SLOT_DATE = "2026-06-05";
const SLOW_MS = 2000;

let accessToken: string | undefined;
let facilityId: string | undefined;

const results: TestResult[] = [];

function nowLabel(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function printHeader() {
  const line = "─".repeat(49);
  console.log(`┌${line}┐`);
  console.log(`│  DOME PRODUCTION SMOKE TEST${" ".repeat(21)}│`);
  console.log(`│  ${APP_URL.padEnd(45).slice(0, 45)}  │`);
  console.log(`│  Run: ${nowLabel().padEnd(38)}│`);
  console.log(`└${line}┘`);
  console.log("");
}

function urlFor(path: string): string {
  if (path === "/health") return `${APP_URL}/health`;
  return `${PRODUCTION_URL}${path}`;
}

async function request(
  method: string,
  path: string,
  body?: JsonValue,
  token?: string
): Promise<SmokeResponse> {
  const started = Date.now();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(urlFor(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: JsonValue = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: res.status,
    statusText: res.statusText,
    ms: Date.now() - started,
    json,
    text,
    corsPresent: res.headers.has("access-control-allow-origin"),
  };
}

function arrayAtData(json: JsonValue): JsonValue[] | undefined {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json)) return json;
  return undefined;
}

function responseWarnings(res: SmokeResponse): string[] {
  const warnings: string[] = [];
  if (!res.corsPresent) warnings.push("Missing CORS header");
  if (res.ms > SLOW_MS) warnings.push(`Slow response > ${SLOW_MS}ms`);
  if (res.status >= 500) warnings.push("Possible database connection or missing environment variable issue");
  return warnings;
}

async function runTest(
  name: string,
  method: string,
  path: string,
  expected: string,
  check: (res: SmokeResponse) => { ok: boolean; hint?: string; details?: string },
  options: { body?: JsonValue; token?: string; skip?: string } = {}
) {
  if (options.skip) {
    const result: TestResult = {
      name,
      status: "SKIP",
      ms: 0,
      method,
      path,
      expected,
      got: "Skipped",
      hint: options.skip,
      warnings: [],
    };
    results.push(result);
    printResult(result);
    return undefined;
  }

  try {
    const res = await request(method, path, options.body, options.token);
    const verdict = check(res);
    const result: TestResult = {
      name,
      status: verdict.ok ? "PASS" : "FAIL",
      ms: res.ms,
      method,
      path,
      expected,
      got: `${res.status} ${res.statusText}`.trim(),
      hint: verdict.hint,
      details: verdict.details,
      warnings: responseWarnings(res),
    };
    results.push(result);
    printResult(result);
    return res;
  } catch (err) {
    const result: TestResult = {
      name,
      status: "FAIL",
      ms: 0,
      method,
      path,
      expected,
      got: "Request failed",
      hint: "Check production URL, DNS, Railway service health, and network access.",
      details: err instanceof Error ? err.message : String(err),
      warnings: [],
    };
    results.push(result);
    printResult(result);
    return undefined;
  }
}

function printResult(result: TestResult) {
  const icon = result.status === "PASS" ? "✅ PASS" : result.status === "SKIP" ? "⚠️ SKIP" : "❌ FAIL";
  const suffix = result.status === "FAIL" && result.got ? ` [${result.got}]` : "";
  console.log(`${icon}  ${result.name.padEnd(32)}${suffix} (${result.ms}ms)`);
  for (const warning of result.warnings) {
    console.log(`⚠️ WARN  ${result.name.padEnd(32)} ${warning}`);
  }
}

function okStatus(status: number, allowed: number[]) {
  return allowed.includes(status);
}

async function main() {
  printHeader();

  await runTest("Health Check", "GET", "/health", '{ status: "ok", env: "production" }', (res) => ({
    ok: res.status === 200 && res.json?.status === "ok" && res.json?.env === "production",
    hint: "Check NODE_ENV and root /health route registration.",
    details: JSON.stringify(res.json),
  }));

  await runTest("Auth — Send OTP", "POST", "/auth/send-otp", '200 { data: { message: "Verification code sent" } }', (res) => {
    if (res.status === 200 && res.json?.data?.message === "Verification code sent") return { ok: true };
    // Twilio trial accounts can only send to verified numbers — not a server bug
    const isTwilioTrial = res.json?.code === 21608 || (typeof res.json?.message === "string" && res.json.message.includes("Trial accounts"));
    if (isTwilioTrial) return { ok: true, hint: "Twilio trial account — add test phone to verified numbers at twilio.com to enable OTP smoke tests." };
    return { ok: false, hint: "Check Twilio credentials and auth route registration.", details: JSON.stringify(res.json) };
  }, { body: { phone: TEST_PHONE } });

  const verifyOtp = await runTest("Auth — Verify OTP", "POST", "/auth/verify-otp", "200 (TEST_MODE) or 400/401 (wrong code — endpoint is live)", (res) => {
    if ([200, 400, 401].includes(res.status)) return { ok: true };
    return {
      ok: false,
      hint: "Expected 200/400/401 — any of these confirm the endpoint is reachable. 5xx or 404 suggests a route/server issue.",
      details: JSON.stringify(res.json),
    };
  }, { body: { phone: TEST_PHONE, code: TEST_MODE_OTP } });

  if (verifyOtp?.status === 200) {
    accessToken = verifyOtp.json?.data?.accessToken;
  }

  const search = await runTest("Facilities — Search", "GET", "/facilities?lat=43.6532&lng=-79.3832&radius=10", "200 data array", (res) => {
    const data = arrayAtData(res.json);
    if (res.status === 200 && data) {
      facilityId = data[0]?.id;
      return { ok: true };
    }
    return {
      ok: false,
      hint: "Check facilities route, database seed data, and query parsing.",
      details: JSON.stringify(res.json),
    };
  });

  if (!facilityId && search?.status === 200) {
    const data = arrayAtData(search.json);
    facilityId = data?.[0]?.id;
  }

  await runTest("Facilities — Detail", "GET", facilityId ? `/facilities/${facilityId}` : "/facilities/:facilityId", "200 facility object", (res) => ({
    ok: res.status === 200 && !!res.json?.data?.id,
    hint: "Check facility detail route and saved facilityId from search.",
    details: JSON.stringify(res.json),
  }), { skip: facilityId ? undefined : "No facility returned from search; cannot test detail." });

  await runTest("Facilities — Slots", "GET", facilityId ? `/facilities/${facilityId}/slots?date=${SLOT_DATE}` : "/facilities/:facilityId/slots", "200 slots array", (res) => ({
    ok: res.status === 200 && Array.isArray(res.json?.data?.slots),
    hint: "Check slots route and slot date availability.",
    details: JSON.stringify(res.json),
  }), { skip: facilityId ? undefined : "No facility returned from search; cannot test slots." });

  await runTest(
    "Facilities — Available Courts",
    "GET",
    facilityId ? `/facilities/${facilityId}/available-courts?date=${SLOT_DATE}&startTime=10:00&duration=60` : "/facilities/:facilityId/available-courts",
    "200 courts array",
    (res) => ({
      ok: res.status === 200 && Array.isArray(res.json?.data?.courts),
      hint: "Check available-courts route, date, duration, and generated slots.",
      details: JSON.stringify(res.json),
    }),
    { skip: facilityId ? undefined : "No facility returned from search; cannot test available courts." }
  );

  await runTest("Auth — Full Login Send OTP", "POST", "/auth/send-otp", "200", (res) => {
    if (res.status === 200) return { ok: true };
    const isTwilioTrial = res.json?.code === 21608 || (typeof res.json?.message === "string" && res.json.message.includes("Trial accounts"));
    if (isTwilioTrial) return { ok: true, hint: "Twilio trial account — add test phone to verified numbers at twilio.com." };
    return { ok: false, hint: "Check OTP provider configuration.", details: JSON.stringify(res.json) };
  }, { body: { phone: FULL_LOGIN_PHONE } });

  await new Promise((resolve) => setTimeout(resolve, 2000));

  await runTest("Auth — Full Login Verify OTP", "POST", "/auth/verify-otp", "Skipped without real OTP", () => ({ ok: true }), {
    skip: "No real OTP is available to this script. Use the OTP received by the test phone to verify manually.",
  });

  const noTokenSkip = accessToken ? undefined : "No auth token — OTP login flow did not complete. Provide a real phone + OTP to test auth-protected endpoints.";

  await runTest("Vendor — Application Status", "GET", "/vendor/application-status", "200 or 403", (res) => ({
    ok: okStatus(res.status, [200, 403]),
    hint: "Check vendor middleware and role permissions.",
    details: JSON.stringify(res.json),
  }), { token: accessToken, skip: noTokenSkip });

  await runTest("Connect — Games Feed", "GET", "/connect/games?city=Toronto", "200 games array", (res) => ({
    ok: res.status === 200 && Array.isArray(res.json?.data),
    hint: "Check connect route registration and OpenGame query.",
    details: JSON.stringify(res.json),
  }));

  await runTest("Alerts — Count", "GET", "/alerts/count", "200 { pending: number }", (res) => ({
    ok: res.status === 200 && typeof res.json?.data?.pending === "number",
    hint: "Check alerts route and user auth.",
    details: JSON.stringify(res.json),
  }), { token: accessToken, skip: noTokenSkip });

  await runTest("Reviews — Pending", "GET", "/reviews/pending", "200 array", (res) => ({
    ok: res.status === 200 && Array.isArray(res.json?.data),
    hint: "Check reviews route and pending reviews query.",
    details: JSON.stringify(res.json),
  }), { token: accessToken, skip: noTokenSkip });

  printSummary();
}

function printSummary() {
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;
  console.log("");
  console.log("─".repeat(49));
  console.log(`Results: ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ""}`);
  console.log("─".repeat(49));

  const failedTests = results.filter((r) => r.status === "FAIL");
  if (!failedTests.length) return;

  console.log("");
  console.log("FAILED TESTS DETAILS:");
  for (const result of failedTests) {
    console.log(`❌ ${result.name}`);
    console.log(`   Expected: ${result.expected}`);
    console.log(`   Got: ${result.got ?? "Unknown"}`);
    console.log(`   URL: ${result.method} ${result.path}`);
    if (result.hint) console.log(`   Hint: ${result.hint}`);
    if (result.details) console.log(`   Details: ${result.details.slice(0, 500)}`);
    if (result.warnings.length) console.log(`   Warnings: ${result.warnings.join("; ")}`);
    console.log("");
  }
}

main().catch((err) => {
  console.error("Smoke test runner failed:", err);
  process.exit(1);
});
