const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

const BASE_URL = "http://127.0.0.1:4174";
const viewports = [
  { name: "mobile", width: 320, height: 568 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
];

const publicRoutes = [
  "/", "/invoice", "/designs", "/login", "/setup-totp",
  "/mobile-design-upload/responsive-smoke-token",
];
const ownerRoutes = [
  "/dashboard", "/saved-invoices", "/customers", "/profile", "/calculator",
  "/rates", "/inventory", "/stock-movements", "/staff", "/attendance",
  "/salary", "/salary-payments", "/leaves", "/expenses", "/bookings",
  "/installments", "/installment-payments", "/suppliers", "/purchases",
  "/payments", "/transactions", "/old-gold", "/karigars", "/repairs",
  "/reports", "/reports/sales", "/reports/profit", "/reports/expenses",
  "/design-catalog", "/database", "/audit-logs",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer(server) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error("Vite server exited before becoming ready.");
    try {
      const response = await fetch(BASE_URL + "/");
      if (response.ok) return;
    } catch {
      // Vite is starting.
    }
    await delay(500);
  }
  throw new Error("Vite development server did not become ready.");
}

async function inspectPage(page, route, viewport) {
  const result = await page.evaluate(() => {
    const root = document.getElementById("root");
    return {
      url: location.pathname,
      title: document.title,
      rootTextLength: (root?.innerText || "").trim().length,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rootWidth: root?.getBoundingClientRect().width || 0,
    };
  });

  assert(result.rootTextLength > 0,
    viewport.name + " " + route + ": page content is empty.");
  assert(result.documentWidth <= result.viewportWidth + 1 && result.bodyWidth <= result.viewportWidth + 1,
    viewport.name + " " + route + ": page has horizontal overflow: " + JSON.stringify(result));
}

async function run() {
  const server = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4174", "--strictPort"],
    { cwd: process.cwd(), stdio: "inherit", env: process.env }
  );

  let browser;
  const failures = [];
  try {
    await waitForServer(server);
    browser = await chromium.launch({ headless: true });

    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const pageErrors = [];
      page.setDefaultTimeout(8000);
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.route("**/api/auth/session", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ username: "responsive-ci-owner" }),
      }));
      await page.route("**/api/events**", (route) => route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "",
      }));
      await page.route("**/api/**", (route) => route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Responsive smoke test: backend is intentionally offline." }),
      }));

      // First check public/login screens with no owner credential.
      await context.clearCookies();
      await page.goto(BASE_URL + "/login", { waitUntil: "domcontentloaded" });
      await page.locator("#root > *").first().waitFor({ state: "visible" });
      await page.waitForTimeout(120);
      try {
        await inspectPage(page, "/login", viewport);
      } catch (error) {
        failures.push(error.message);
      }

      // Install a fake CI-only token so owner routes pass the client-side Guard.
      await page.evaluate(() => {
        localStorage.setItem("nkj_token", "responsive-ci-only-token");
        localStorage.setItem("nkj_user", "responsive-ci-owner");
        localStorage.setItem("nkj_last_activity", String(Date.now()));
      });

      for (const route of publicRoutes.filter((item) => item !== "/login")) {
        try {
          await page.goto(BASE_URL + route, { waitUntil: "domcontentloaded" });
          await page.locator("#root > *").first().waitFor({ state: "visible" });
          await page.waitForTimeout(120);
          await inspectPage(page, route, viewport);
        } catch (error) {
          failures.push(viewport.name + " " + route + ": " + error.message);
        }
      }

      for (const route of ownerRoutes) {
        try {
          await page.goto(BASE_URL + route, { waitUntil: "domcontentloaded" });
          await page.locator("#root > *").first().waitFor({ state: "visible" });
          await page.waitForTimeout(120);
          await inspectPage(page, route, viewport);
        } catch (error) {
          failures.push(viewport.name + " " + route + ": " + error.message);
        }
      }

      if (pageErrors.length) {
        failures.push(viewport.name + " uncaught React/browser errors: " + pageErrors.join(" | "));
      }
      process.stdout.write(
        "CHECKED " + viewport.name + ": " + (publicRoutes.length + ownerRoutes.length) +
        " public/owner routes\n"
      );
      await context.close();
    }

    if (failures.length) {
      console.error(failures.join("\n"));
      process.exitCode = 1;
    } else {
      process.stdout.write("All public and owner route responsive smoke checks passed.\n");
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

run();
