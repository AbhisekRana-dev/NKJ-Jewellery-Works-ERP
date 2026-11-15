const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

const BASE_URL = "http://127.0.0.1:4173";
const viewports = [
  { name: "small-mobile", width: 320, height: 568 },
  { name: "mobile", width: 375, height: 667 },
  { name: "iphone", width: 390, height: 844 },
  { name: "large-mobile", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "large-tablet", width: 1024, height: 1366 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "large-desktop", width: 1920, height: 1080 },
  { name: "small-mobile-landscape", width: 568, height: 320 },
  { name: "mobile-landscape", width: 844, height: 390 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer(server) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error("Vite server exited before becoming ready.");
    try {
      const response = await fetch(BASE_URL + "/calculator");
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }
    await delay(500);
  }
  throw new Error("Vite development server did not become ready.");
}

async function assertNoHorizontalOverflow(page, viewport, stage) {
  const metrics = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const elements = Array.from(document.body.querySelectorAll("*"));
    const describe = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        className: typeof element.className === "string" ? element.className : "",
        id: element.id || "",
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        position: style.position,
        overflowX: style.overflowX,
        before: getComputedStyle(element, "::before").content,
        after: getComputedStyle(element, "::after").content,
        text: (element.innerText || "").slice(0, 70),
      };
    };
    const offenders = elements.map(describe).filter((item) => item.right > width + 1 || item.left < -1)
      .sort((a, b) => b.right - a.right).slice(0, 18);
    const scrollNodes = elements.filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map(describe).slice(0, 24);
    return {
      viewport: width,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      bodyMetrics: describe(document.body),
      rootMetrics: describe(document.getElementById("root")),
      offenders,
      scrollNodes,
    };
  });
  assert(
    metrics.document <= metrics.viewport + 1 && metrics.body <= metrics.viewport + 1,
    viewport.name + " (" + viewport.width + "x" + viewport.height + ") " + stage +
      " has horizontal overflow: " + JSON.stringify(metrics)
  );

  for (const selector of [
    ".nkj-calculator-page",
    ".nkj-calculator-options",
    ".nkj-calculator-workspace",
    ".nkj-calculator-panel:not([hidden])",
  ]) {
    const element = page.locator(selector).first();
    if (!(await element.count()) || !(await element.isVisible())) continue;
    const rect = await element.boundingBox();
    assert(rect && rect.x >= -1 && rect.x + rect.width <= viewport.width + 1,
      viewport.name + " " + stage + " clips " + selector + ": " + JSON.stringify(rect));
  }
}

async function runViewportTest(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const pageErrors = [];

  page.on("pageerror", (error) => pageErrors.push("pageerror: " + error.stack));
  page.on("requestfailed", (request) => pageErrors.push("requestfailed: " + request.url() + " " + request.failure()?.errorText));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push("console: " + message.text());
  });
  await page.route("**/api/events/public", (route) => route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: "",
  }));

  try {
    const response = await page.goto(BASE_URL + "/calculator", { waitUntil: "domcontentloaded" });
    try {
      await page.locator(".nkj-calculator-page").waitFor({ state: "visible", timeout: 10000 });
    } catch {
      const diagnostics = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        bodyHtml: document.body.innerHTML.slice(0, 5000),
        rootHtml: document.getElementById("root")?.innerHTML.slice(0, 5000) || "no-root",
        scripts: Array.from(document.scripts).map((item) => item.src),
        modules: performance.getEntriesByType("resource").filter((item) => item.name.includes("/src/") || item.name.includes("@vite")).map((item) => item.name).slice(0, 40),
      })).catch((error) => ({ diagnosticsError: error.message }));
      throw new Error("Calculator did not render at " + viewport.name +
        ". HTTP " + (response ? response.status() : "no response") +
        ". Diagnostics: " + JSON.stringify(diagnostics).slice(0, 8000) +
        ". Browser errors: " + pageErrors.join(" | "));
    }
    await page.locator(".nkj-calculator-options button[data-calculator-mode]").first().waitFor();

    const tabs = page.locator(".nkj-calculator-options button[data-calculator-mode]");
    assert(await tabs.count() === 4, viewport.name + ": expected all four calculator tabs.");
    for (let index = 0; index < 4; index += 1) {
      assert(await tabs.nth(index).isVisible(), viewport.name + ": calculator tab " + index + " is not visible.");
    }
    await assertNoHorizontalOverflow(page, viewport, "initial calculator view");

    // New ornaments: weight x rate; this is a layout smoke check, not a formula change.
    await page.locator('[data-calculator-mode="new"]').click();
    let panel = page.locator('.nkj-calculator-panel:not([hidden])');
    let inputs = panel.locator(".nkj-calc-fields input");
    await inputs.nth(0).fill("2");
    await inputs.nth(1).fill("5000");
    let total = await panel.locator(".nkj-calc-result-hero strong").innerText();
    assert(total.includes("10,000.00"), viewport.name + ": New Ornaments result is not visible or incorrect: " + total);
    await assertNoHorizontalOverflow(page, viewport, "new ornaments");
    if (viewport.width <= 767) {
      const inputMode = await panel.locator(".nkj-calc-fields input").first().getAttribute("inputmode");
      assert(inputMode === "decimal", viewport.name + ": numeric input does not request a decimal keypad.");
    }

    // Old ornaments: net value uses entered weight, purity percentage and rate.
    await page.locator('[data-calculator-mode="old"]').click();
    panel = page.locator('.nkj-calculator-panel:not([hidden])');
    inputs = panel.locator(".nkj-calc-fields input");
    await inputs.nth(0).fill("10");
    await inputs.nth(1).fill("80");
    await inputs.nth(2).fill("5000");
    total = await panel.locator(".nkj-calc-result-hero strong").innerText();
    assert(total.includes("40,000.00"), viewport.name + ": Old Ornaments result is not visible or incorrect: " + total);
    await assertNoHorizontalOverflow(page, viewport, "old ornaments");

    // Diamond: populate gold and diamond inputs and confirm the summary remains in view.
    await page.locator('[data-calculator-mode="diamond"]').click();
    panel = page.locator('.nkj-calculator-panel:not([hidden])');
    inputs = panel.locator(".nkj-calc-fields input");
    await inputs.nth(0).fill("2");
    await inputs.nth(1).fill("5000");
    await inputs.nth(2).fill("1");
    await inputs.nth(3).fill("10000");
    total = await panel.locator(".nkj-calc-result-hero strong").innerText();
    assert(total.includes("21,200.00"), viewport.name + ": Diamond result is not visible or incorrect: " + total);
    await assertNoHorizontalOverflow(page, viewport, "diamond calculator");

    // Manual calculator: 2 + 3 = 5 using the touch keypad.
    await page.locator('[data-calculator-mode="manual"]').click();
    panel = page.locator('.nkj-calculator-panel:not([hidden])');
    const keys = panel.locator(".nkj-calc-keypad > button");
    await keys.nth(13).click(); // 2
    await keys.nth(15).click(); // +
    await keys.nth(14).click(); // 3
    await keys.nth(19).click(); // =
    const manualResult = await panel.locator(".nkj-calc-result").innerText();
    assert(manualResult.includes("5.00"), viewport.name + ": Manual keypad result is not visible: " + manualResult);
    await assertNoHorizontalOverflow(page, viewport, "manual calculator");

    if (viewport.width <= 767) {
      const keypadButtons = await keys.count();
      assert(keypadButtons === 20, viewport.name + ": manual keypad is missing buttons.");
      const smallestButton = await keys.first().boundingBox();
      assert(smallestButton && smallestButton.height >= 44, viewport.name + ": keypad buttons are too small for touch.");
    }

    assert(pageErrors.length === 0, viewport.name + ": uncaught browser errors: " + pageErrors.join(" | "));
    process.stdout.write("PASS " + viewport.name + " " + viewport.width + "x" + viewport.height + "\n");
  } finally {
    await context.close();
  }
}


async function runRouteResponsiveSmoke(browser) {
  const representativeViewports = [
    { name: "route-mobile", width: 320, height: 568 },
    { name: "route-tablet", width: 768, height: 1024 },
    { name: "route-laptop", width: 1366, height: 768 },
    { name: "route-desktop", width: 1920, height: 1080 },
  ];
  const publicRoutes = [
    "/", "/invoice", "/designs", "/setup-totp",
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

  for (const viewport of representativeViewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const pageErrors = [];
    page.setDefaultTimeout(8000);
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.route("**/api/**", (route) => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Responsive route smoke test: backend is offline." }),
    }));
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

    try {
      // This known-working public page mounts the SPA before testing Login.
      await page.goto(BASE_URL + "/calculator", { waitUntil: "domcontentloaded" });
      await page.locator(".nkj-calculator-page").waitFor({ state: "visible" });
      await page.evaluate(() => {
        window.history.pushState({}, "", "/login");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.locator(".nkj-login-page").waitFor({ state: "visible" });
      await assertNoHorizontalOverflow(page, viewport, "login page");

      // Simulate only the authentication response; no production account or API
      // data is used. Reload so AuthProvider validates the CI-only bearer token.
      await page.evaluate(() => {
        localStorage.setItem("nkj_token", "responsive-ci-only-token");
        localStorage.setItem("nkj_user", "responsive-ci-owner");
        localStorage.setItem("nkj_last_activity", String(Date.now()));
      });
      await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
      await page.locator(".app-layout").waitFor({ state: "visible" });

      for (const route of publicRoutes) {
        await page.goto(BASE_URL + route, { waitUntil: "domcontentloaded" });
        await page.locator(".app-layout").waitFor({ state: "visible" });
        await page.waitForTimeout(80);
        const result = await page.evaluate(() => ({
          body: document.body.scrollWidth,
          document: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
          text: document.getElementById("root")?.innerText?.trim().length || 0,
        }));
        assert(result.text > 0, viewport.name + " " + route + ": empty page content.");
        assert(result.body <= result.viewport + 1 && result.document <= result.viewport + 1,
          viewport.name + " " + route + ": horizontal overflow " + JSON.stringify(result));
      }

      for (const route of ownerRoutes) {
        await page.goto(BASE_URL + route, { waitUntil: "domcontentloaded" });
        await page.locator(".app-layout").waitFor({ state: "visible" });
        await page.waitForTimeout(80);
        const result = await page.evaluate(() => ({
          body: document.body.scrollWidth,
          document: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
          text: document.getElementById("root")?.innerText?.trim().length || 0,
        }));
        assert(result.text > 0, viewport.name + " " + route + ": empty page content.");
        assert(result.body <= result.viewport + 1 && result.document <= result.viewport + 1,
          viewport.name + " " + route + ": horizontal overflow " + JSON.stringify(result));
      }

      assert(pageErrors.length === 0,
        viewport.name + ": uncaught page errors: " + pageErrors.join(" | "));
      process.stdout.write("PASS " + viewport.name + " route smoke (" +
        (publicRoutes.length + ownerRoutes.length + 1) + " routes)\n");
    } finally {
      await context.close();
    }
  }
  process.stdout.write("All public and owner route responsive smoke checks passed.\n");
}

(async () => {
  const server = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
    { cwd: process.cwd(), stdio: "inherit", env: process.env }
  );

  let browser;
  try {
    await waitForServer(server);
    browser = await chromium.launch({ headless: true });
    for (const viewport of viewports) {
      await runViewportTest(browser, viewport);
    }
    process.stdout.write("All responsive calculator viewport checks passed.\n");
    await runRouteResponsiveSmoke(browser);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
})();
