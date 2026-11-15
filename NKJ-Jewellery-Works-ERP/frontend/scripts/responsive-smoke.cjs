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
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
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

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push("console: " + message.text());
  });
  await page.route("**/api/**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ message: "Responsive smoke test: backend is intentionally not connected." }),
  }));

  try {
    const response = await page.goto(BASE_URL + "/calculator", { waitUntil: "domcontentloaded" });
    try {
      await page.locator(".nkj-calculator-page").waitFor({ state: "visible", timeout: 10000 });
    } catch {
      const bodyText = await page.locator("body").innerText().catch(() => "");
      throw new Error("Calculator did not render at " + viewport.name +
        ". HTTP " + (response ? response.status() : "no response") +
        ". Page text: " + bodyText.slice(0, 2500) +
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
    assert(total.includes("20,000.00"), viewport.name + ": Diamond result is not visible or incorrect: " + total);
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
      const inputMode = await page.locator(".nkj-calculator-panel:not([hidden]) .nkj-calc-fields input").first().getAttribute("inputmode");
      assert(inputMode === "decimal", viewport.name + ": numeric input does not request a decimal keypad.");
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
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
})();
