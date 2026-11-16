const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

const BASE_URL = "http://127.0.0.1:4174";
const viewports = [
  { name: "small-mobile", width: 320, height: 568 },
  { name: "mobile", width: 375, height: 667 },
  { name: "iphone", width: 390, height: 844 },
  { name: "large-mobile", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "large-tablet", width: 1024, height: 1366 },
  { name: "small-mobile-landscape", width: 568, height: 320 },
  { name: "mobile-landscape", width: 844, height: 390 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "large-desktop", width: 1920, height: 1080 },
];

const ownerRoutes = [
  "/dashboard", "/saved-invoices", "/customers", "/profile", "/rates",
  "/inventory", "/stock-movements", "/staff", "/attendance", "/salary",
  "/salary-payments", "/leaves", "/expenses", "/bookings", "/installments",
  "/suppliers", "/purchases", "/payments", "/transactions", "/old-gold",
  "/karigars", "/repairs", "/reports", "/reports/sales", "/reports/profit",
  "/reports/expenses", "/design-catalog", "/database", "/audit-logs",
];

const publicRoutes = ["/", "/invoice", "/designs", "/calculator", "/mobile-design-upload/mobile-responsive-smoke-token", "/login", "/setup-totp"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer(server) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error("Vite server exited before becoming ready.");
    try {
      const response = await fetch(BASE_URL + "/dashboard");
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }
    await delay(500);
  }
  throw new Error("Vite development server did not become ready.");
}

function apiPayload(path, method) {
  if (path.endsWith("/auth/session")) return { username: "admin2026" };
  if (path === "/api/admin/profile") {
    return {
      fullName: "Responsive Test Owner",
      username: "admin2026",
      email: "",
      phone: "",
      designation: "Administrator",
      company: "Nandikishor Jewellery Works",
      address: "Jhargram",
      about: "",
      photoDataUrl: "",
    };
  }
  if (path === "/api/auth/sessions/summary") return { activeCount: 1, historyCount: 1, maxActive: 0 };
  if (path === "/api/rates") {
    return { gold24kRate: 7000, gold22kRate: 6420, silverRate: 90, diamondRatePerCarat: 0 };
  }
  if (path === "/api/admin/attendance/dashboard") return { summary: {}, records: [], staff: [] };
  if (path === "/api/admin/designs" && method === "GET") return { items: [], total: 0, page: 0 };
  if (path === "/api/admin/designs/categories" || path === "/api/designs/categories") return [];
  if (path === "/api/designs") return { items: [], total: 0, page: 0 };
  if (path === "/api/invoices/date-support") return { enabled: true, supported: true };
  if (path === "/api/invoices") return [];
  if (path === "/api/admin/transactions/summary") return {};
  if (path === "/api/admin/installments/plans" || path === "/api/admin/installments/payments") return [];
  if (path === "/api/admin/reports/summary" || path === "/api/admin/dashboard") return {};
  if (path === "/api/admin/database/status") return {};
  if (path.startsWith("/api/admin/modules/")) return [];
  if (path.startsWith("/api/admin/transactions")) return [];
  if (path.startsWith("/api/admin/rates/")) return [];
  if (path.startsWith("/api/admin/installments/")) return [];
  if (path.startsWith("/api/admin/audit-logs")) return [];
  if (path.startsWith("/api/admin/designs/")) return {};
  if (method !== "GET") return { success: true };
  return {};
}

async function installApiRouteMocks(page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // Do not intercept source modules such as /src/core/api/client.js.
    if (!url.pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }
    if (url.pathname === "/api/events" || url.pathname === "/api/events/public") {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "cache-control": "no-cache" },
        body: ": responsive-smoke-connected\\n\\n",
      });
      return;
    }
    const body = apiPayload(url.pathname, request.method().toUpperCase());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

async function installApiMocks(page) {
  await page.addInitScript(() => {
    localStorage.setItem("nkj_token", "responsive-layout-test-token");
    localStorage.setItem("nkj_user", "admin2026");
  });
  await installApiRouteMocks(page);
}

async function checkViewport(page, path, viewport) {
  const errors = [];
  const failedResponses = [];
  const onResponse = (response) => {
    const request = response.request();
    const contentType = response.headers()["content-type"] || "";
    if (response.status() >= 400 || (request.resourceType() === "script" && !contentType.includes("javascript"))) {
      failedResponses.push({
        url: response.url(),
        status: response.status(),
        contentType,
        resourceType: request.resourceType(),
      });
    }
  };
  const onPageError = (error) => errors.push("pageerror: " + error.message);
  const onConsoleError = (message) => {
    if (message.type() === "error") errors.push("console: " + message.text());
  };
  const onRequestFailed = (request) => {
    // External font/CDN requests may be blocked in CI; fail only for app-origin assets/API.
    if (new URL(request.url()).origin === new URL(BASE_URL).origin) {
      errors.push("requestfailed: " + request.url() + " " + request.failure()?.errorText);
    }
  };

  page.on("response", onResponse);
  page.on("pageerror", onPageError);
  page.on("console", onConsoleError);
  page.on("requestfailed", onRequestFailed);

  try {
    const response = await page.goto(BASE_URL + path, { waitUntil: "domcontentloaded" });
    assert(response && response.ok(), path + " did not return an HTML page.");
    await page.locator("#root").waitFor({ state: "attached", timeout: 10000 });
    await page.waitForTimeout(100);

    const currentPath = await page.evaluate(() => window.location.pathname);
    assert(
      currentPath === path,
      path + " was redirected to " + currentPath + "; owner-session mock did not authenticate the route."
    );

    try {
      await page.waitForFunction(() => {
        const root = document.getElementById("root");
        return Boolean(root && (root.innerText || "").trim().length > 0);
      }, { timeout: 6000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        path: location.pathname,
        title: document.title,
        bodyText: (document.body.innerText || "").slice(0, 1000),
        rootMarkup: document.getElementById("root")?.innerHTML.slice(0, 4000) || "",
        scriptResources: performance.getEntriesByType("resource")
          .filter((entry) => entry.name.includes("/src/") || entry.name.includes("@vite"))
          .map((entry) => ({
            name: entry.name,
            size: entry.transferSize,
            duration: Math.round(entry.duration),
          })),
      })).catch((diagnosticError) => ({ diagnosticError: diagnosticError.message }));

      throw new Error(
        "Page content was not visible for " + path + " at " + viewport.name +
        ": " + JSON.stringify(diagnostic) +
        "; failed responses: " + JSON.stringify(failedResponses) +
        "; browser errors: " + errors.join(" | ") +
        "; " + error.message
      );
    }

    const renderedText = await page.locator("#root").innerText();
    assert(renderedText.trim().length > 0, path + " rendered an empty application root at " + viewport.name + ".");

    const result = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const root = document.getElementById("root");
      const app = document.querySelector(".app-content");
      const containers = Array.from(document.querySelectorAll(
        ".container, .nkj-module-page, .nkj-dashboard, .nkj-calculator-page"
      ));
      const outOfBounds = containers.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          className: element.className,
          left: Math.round(rect.left * 10) / 10,
          right: Math.round(rect.right * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
        };
      }).filter((item) => item.left < -1 || item.right > width + 1).slice(0, 6);

      return {
        width,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        rootWidth: root?.scrollWidth || 0,
        appWidth: app?.scrollWidth || 0,
        outOfBounds,
        overflowCandidates: Array.from(document.body.querySelectorAll('*')).map((el) => { const rect = el.getBoundingClientRect(); const style = getComputedStyle(el); return { tag: el.tagName, id: el.id || '', className: typeof el.className === 'string' ? el.className : '', left: Math.round(rect.left), right: Math.round(rect.right), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, overflowX: style.overflowX, text: (el.innerText || '').slice(0, 50) }; }).filter((item) => item.right > width + 1 || item.left < -1 || (item.scrollWidth > item.clientWidth + 1 && item.overflowX !== 'auto' && item.overflowX !== 'scroll')).slice(0, 20),
      };
    });

    assert(
      result.documentWidth <= result.width + 1 && result.bodyWidth <= result.width + 1,
      path + " overflows at " + viewport.name + ": " + JSON.stringify(result)
    );
    assert(
      result.outOfBounds.length === 0,
      path + " has a page/container outside the viewport at " + viewport.name + ": " + JSON.stringify(result.outOfBounds)
    );
    assert(errors.length === 0, path + " caused browser runtime errors at " + viewport.name + ": " + errors.join(" | "));
  } finally {
    page.removeListener("response", onResponse);
    page.removeListener("pageerror", onPageError);
    page.removeListener("console", onConsoleError);
    page.removeListener("requestfailed", onRequestFailed);
  }
}

async function testOwnerSidebar(browser) {
  // Isolate the drawer interaction from the long sequence of route reloads.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  try {
    // Install API/event mocks first, then establish the site origin before writing the test session.
    await installApiRouteMocks(page);
    await page.goto(BASE_URL + "/login", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const root = document.getElementById("root");
      return Boolean(root && root.children.length > 0);
    }, { timeout: 10000 });
    await page.evaluate(() => {
      localStorage.setItem("nkj_token", "responsive-layout-test-token");
      localStorage.setItem("nkj_user", "admin2026");
    });
    await page.goto(BASE_URL + "/dashboard", { waitUntil: "domcontentloaded" });
    try {
      await page.locator("#nkj-owner-sidebar").waitFor({ state: "attached", timeout: 10000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        path: location.pathname,
        tokenPresent: Boolean(localStorage.getItem("nkj_token")),
        bodyText: (document.body.innerText || "").slice(0, 700),
        rootMarkup: document.getElementById("root")?.innerHTML.slice(0, 1400) || "",
        scripts: Array.from(document.scripts).map((item) => item.src),
      }));
      throw new Error("Owner drawer did not render: " + JSON.stringify(diagnostic) +
        "; browser errors: " + browserErrors.join(" | ") + "; " + error.message);
    }

    const ownerShell = await page.locator("#nkj-owner-sidebar").count();
    const authToken = await page.evaluate(() => localStorage.getItem("nkj_token"));
    assert(ownerShell === 1 && Boolean(authToken), "Owner route was not authenticated before sidebar testing.");
    await page.locator(".nkj-mobile-menu-button").waitFor({ state: "visible", timeout: 10000 });
    await page.locator(".nkj-mobile-menu-button").click();
    await page.locator(".nkj-owner-sidebar:not(.is-collapsed)").waitFor({ state: "visible", timeout: 5000 });
    await page.locator('.nkj-owner-nav a[href="/profile"]').click();
    await page.waitForURL("**/profile");
    await page.locator(".nkj-owner-sidebar.is-collapsed").waitFor({ state: "attached", timeout: 5000 });
    process.stdout.write("PASS owner mobile drawer opens, navigates, and closes\\n");
  } finally {
    await context.close();
  }
}

async function testPublicNavigation(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE_URL + "/login", { waitUntil: "domcontentloaded" });
  try {
    await page.locator(".nkj-public-menu-button").waitFor({ state: "visible", timeout: 10000 });
    await page.locator(".nkj-public-menu-button").click();
    await page.locator(".nkj-public-topbar > nav.is-open").waitFor({ state: "visible", timeout: 5000 });
    await page.locator('.nkj-public-topbar a[href="/designs"]').click();
    await page.waitForURL("**/designs");
    await page.locator(".nkj-public-topbar > nav:not(.is-open)").waitFor({ state: "attached", timeout: 5000 });
    process.stdout.write("PASS public mobile menu opens, navigates, and closes\\n");
  } finally {
    await context.close();
  }
}

(async () => {
  const server = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4174", "--strictPort"],
    { cwd: process.cwd(), stdio: "inherit", env: { ...process.env, VITE_API_BASE_URL: "/api" } }
  );
  let browser;
  try {
    await waitForServer(server);
    browser = await chromium.launch({ headless: true });

    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await installApiMocks(page);
      try {
        for (const path of ownerRoutes) {
          process.stdout.write("CHECK " + viewport.name + " " + path + "\\n");
          await checkViewport(page, path, viewport);
        }
        if (viewport.width === 390) {
          await testOwnerSidebar(browser);
        }
      } finally {
        await context.close();
      }
      process.stdout.write("PASS all " + ownerRoutes.length + " owner routes at " + viewport.name + " " + viewport.width + "x" + viewport.height + "\\n");
    }

    const publicContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const publicPage = await publicContext.newPage();
    await publicPage.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith("/api/")) {
        await route.continue();
        return;
      }
      if (url.pathname === "/api/events" || url.pathname === "/api/events/public") {
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          headers: { "cache-control": "no-cache" },
          body: ": responsive-smoke-connected\\n\\n",
        });
        return;
      }
      const body = apiPayload(url.pathname, route.request().method().toUpperCase());
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    try {
      for (const path of publicRoutes) {
        await checkViewport(publicPage, path, { name: "public-mobile", width: 390, height: 844 });
      }
    } finally {
      await publicContext.close();
    }

    await testPublicNavigation(browser);
    process.stdout.write("All owner/public page responsive smoke checks passed.\\n");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
})();
