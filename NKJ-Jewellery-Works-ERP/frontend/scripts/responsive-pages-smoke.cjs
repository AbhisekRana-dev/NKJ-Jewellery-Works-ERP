const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

const BASE_URL = "http://127.0.0.1:4174";
const viewports = [
  { name: "small-mobile", width: 320, height: 568 },
  { name: "mobile-360", width: 360, height: 780 },
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
  "/", "/invoice", "/calculator", "/designs",
  "/dashboard", "/saved-invoices", "/customers", "/profile", "/rates",
  "/inventory", "/stock-movements", "/staff", "/attendance", "/salary",
  "/salary-payments", "/leaves", "/expenses", "/bookings", "/installments", "/installment-payments",
  "/suppliers", "/purchases", "/payments", "/transactions", "/old-gold",
  "/karigars", "/repairs", "/reports", "/reports/sales", "/reports/profit",
  "/reports/expenses", "/design-catalog", "/database", "/audit-logs",
];

const publicRoutes = ["/", "/invoice", "/designs", "/calculator", "/rate", "/mobile-design-upload/mobile-responsive-smoke-token", "/login", "/setup-totp"];

// Authenticated compatibility routes may intentionally land on a canonical page.
const expectedRoutePaths = {
  "/installment-payments": "/installments",
};

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

const responsiveSavedInvoice = {
  id: "responsive-mobile-invoice",
  invoiceNo: "NKJ-MOBILE-TEST-001",
  invoiceDate: "2026-11-17",
  invoiceTime: "10:15:00",
  customerName: "Mobile QA Customer With A Long Full Name",
  mobile: "9876543210",
  address: "Sasra, Gopiballavpur, Jhargram, Paschim Medinipur, West Bengal — PIN 721506, India",
  paymentMode: "UPI",
  referenceNo: "UPI-TEST-20261117-001",
  showGstin: true,
  newItems: [
    { description: "22K Gold Necklace with Traditional Filigree Work", purity: "22K / 916", netWeight: 5.25, rate: 6900, makingCharge: 600, stampCharge: 50, extraCharge: 100 },
    { description: "Gold Earrings Pair", purity: "22K", netWeight: 1.2, rate: 6900, makingCharge: 150, stampCharge: 20, extraCharge: 0 },
  ],
  oldItems: [
    { description: "Old Gold Necklace Exchange", purity: "22K", pureWeight: 2, rate: 6500, amount: 13000 },
  ],
  newTotal: 45425,
  oldTotal: 13000,
  gstPercent: 3,
  gstAmount: 1362.75,
  discount: 0,
  grandTotal: 33787.75,
  totalPaid: 15000,
  description: "Mobile QA fixture with populated gold rows, exchange value, long customer address, GST and payment balance.",
};

function apiPayload(path, method) {
  if (path.endsWith("/auth/session")) {
    return { username: "admin2026", lastActivityAt: Date.now() };
  }
  if (path === "/api/auth/login") return { challengeId: "responsive-login-challenge", requiresTotp: true };
  if (path === "/api/auth/verify") return { token: "responsive-relogin-token", username: "admin2026" };
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
  if (path === "/api/designs/categories") {
    return [
      { id: "necklaces", slug: "necklaces", metalType: "GOLD", subcategoryName: "Necklaces", activeDesignCount: 3 },
      { id: "earrings", slug: "earrings", metalType: "GOLD", subcategoryName: "Earrings", activeDesignCount: 4 },
      { id: "bangles", slug: "bangles", metalType: "GOLD", subcategoryName: "Bangles", activeDesignCount: 5 },
      { id: "rings", slug: "rings", metalType: "GOLD", subcategoryName: "Rings", activeDesignCount: 6 },
    ];
  }
  if (path === "/api/admin/designs/categories") return [];
  if (path === "/api/designs") return { items: [], total: 0, page: 0 };
  if (path === "/api/invoices/date-support") return { enabled: true, supported: true };
  if (path === "/api/invoices") return [responsiveSavedInvoice];
  if (path === "/api/invoices/" + responsiveSavedInvoice.id) return responsiveSavedInvoice;
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
        body: ": responsive-smoke-connected\n\n",
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
    const expectedPath = expectedRoutePaths[path] || path;
    assert(
      currentPath === expectedPath,
      path + " resolved to " + currentPath + "; expected " + expectedPath + "."
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
      const tableAncestors = [];
      let tableNode = document.querySelector(".items-table.new-items-table");
      while (tableNode && tableAncestors.length < 10) {
        const rect = tableNode.getBoundingClientRect();
        const style = getComputedStyle(tableNode);
        tableAncestors.push({
          tag: tableNode.tagName,
          className: typeof tableNode.className === "string" ? tableNode.className : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          scrollWidth: tableNode.scrollWidth,
          clientWidth: tableNode.clientWidth,
          overflowX: style.overflowX,
          display: style.display,
          minWidth: style.minWidth,
        });
        tableNode = tableNode.parentElement;
      }
      const invoiceSheetChildren = Array.from(document.querySelector(".invoice-sheet")?.children || []).map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName,
          className: typeof element.className === "string" ? element.className : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          overflowX: style.overflowX,
          display: style.display,
          minWidth: style.minWidth,
          gridTemplateColumns: style.gridTemplateColumns,
        };
      });
      const overflowElements = Array.from(document.body.querySelectorAll("*")).map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName,
          className: typeof element.className === "string" ? element.className.slice(0, 90) : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          overflowX: style.overflowX,
        };
      }).filter((item) => (item.right > width + 1 || item.left < -1)
        && item.overflowX !== "auto" && item.overflowX !== "scroll")
        .sort((a, b) => b.right - a.right).slice(0, 18);

      return {
        width,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        rootWidth: root?.scrollWidth || 0,
        appWidth: app?.scrollWidth || 0,
        outOfBounds,
        overflowElements,
        tableAncestors,
        invoiceSheetChildren,
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

async function inspectInvoiceMobileLayout(page, viewport, invoiceKind) {
  const result = await page.evaluate(() => {
    const invoice = document.querySelector("#invoice-print");
    const shop = invoice?.querySelector(".inv-shop");
    const heading = shop?.querySelector("h1");
    const meta = invoice?.querySelector(".inv-meta");
    const firstLabel = invoice?.querySelector(".form-grid label");
    const colon = firstLabel?.querySelector(":scope > i");
    const firstInput = firstLabel?.querySelector("input, select");
    const tableWrap = invoice?.querySelector(".table-wrap");
    const itemTable = tableWrap?.querySelector(".items-table");
    const rect = (element) => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { left: value.left, right: value.right, width: value.width, height: value.height };
    };
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      invoice: rect(invoice),
      shop: rect(shop),
      heading: rect(heading),
      headingWritingMode: heading ? getComputedStyle(heading).writingMode : null,
      headingWordBreak: heading ? getComputedStyle(heading).wordBreak : null,
      meta: rect(meta),
      colonDisplay: colon ? getComputedStyle(colon).display : null,
      firstInput: rect(firstInput),
      tableWrap: rect(tableWrap),
      tableOverflowX: tableWrap ? getComputedStyle(tableWrap).overflowX : null,
      tableClientWidth: tableWrap?.clientWidth || 0,
      tableScrollWidth: tableWrap?.scrollWidth || 0,
      itemTableScrollWidth: itemTable?.scrollWidth || 0,
    };
  });

  assert(result.invoice, invoiceKind + " invoice did not render at " + viewport.name + ".");
  assert(
    result.documentWidth <= result.viewportWidth + 1 && result.bodyWidth <= result.viewportWidth + 1,
    invoiceKind + " invoice page has horizontal overflow at " + viewport.name + ": " + JSON.stringify(result)
  );
  assert(
    result.shop && result.shop.width >= result.invoice.width * 0.82,
    invoiceKind + " shop header is still squeezed into a narrow column at " + viewport.name + ": " + JSON.stringify(result)
  );
  assert(
    result.meta && result.meta.width >= result.invoice.width * 0.82,
    invoiceKind + " invoice metadata does not use the full mobile width at " + viewport.name + ": " + JSON.stringify(result)
  );
  assert(
    result.headingWritingMode === "horizontal-tb" &&
    result.heading.width >= result.invoice.width * 0.75,
    invoiceKind + " shop title is compressed/vertical at " + viewport.name + ": " + JSON.stringify(result)
  );
  assert(
    result.colonDisplay === "none",
    invoiceKind + " customer/payment form still renders a standalone colon row at " + viewport.name + "."
  );
  assert(
    result.firstInput && result.firstInput.width >= result.invoice.width * 0.7,
    invoiceKind + " customer/payment input is too narrow at " + viewport.name + ": " + JSON.stringify(result)
  );
  assert(
    result.tableWrap &&
    result.tableClientWidth > 0 &&
    result.tableScrollWidth <= result.tableClientWidth + 1 &&
    result.itemTableScrollWidth <= result.tableClientWidth + 1,
    invoiceKind + " ornament cards exceed their phone-width container at " + viewport.name + ": " + JSON.stringify(result)
  );
}

async function assertInvoiceTablesUseMobileCards(page, invoiceKind) {
  const results = await page.evaluate(() => Array.from(
    document.querySelectorAll("#invoice-print .table-wrap")
  ).map((wrap) => {
    const table = wrap.querySelector(".items-table");
    const tbody = table?.tBodies?.[0];
    const rows = Array.from(tbody?.rows || []);
    return {
      tableClass: table?.className || "",
      clientWidth: wrap.clientWidth,
      containerRight: wrap.getBoundingClientRect().right,
      scrollWidth: wrap.scrollWidth,
      overflowX: getComputedStyle(wrap).overflowX,
      tableDisplay: table ? getComputedStyle(table).display : "missing",
      tableScrollWidth: table?.scrollWidth || 0,
      headDisplay: table?.tHead ? getComputedStyle(table.tHead).display : "missing",
      bodyDisplay: tbody ? getComputedStyle(tbody).display : "missing",
      rows: rows.map((row) => {
        const cells = Array.from(row.cells);
        const rowRect = row.getBoundingClientRect();
        const labelledCells = cells.filter((cell) => {
          const content = getComputedStyle(cell, "::before").content;
          return content && content !== "none" && content !== "normal";
        }).length;
        return {
          display: getComputedStyle(row).display,
          width: rowRect.width,
          right: rowRect.right,
          labelledCells,
          cellCount: cells.length,
          cells: cells.map((cell) => {
            const cellRect = cell.getBoundingClientRect();
            // Mode radio buttons are controls, not the editable value field.
            // Measure the numeric/text field so a 15px %/₹ radio cannot make
            // the mobile card test falsely report a squeezed input.
            const valueFields = Array.from(cell.querySelectorAll(
              'input:not([type="radio"]), select, textarea'
            ));
            const fieldRect = valueFields[0]?.getBoundingClientRect();
            return {
              width: cellRect.width,
              height: cellRect.height,
              labelWidth: cellRect.width,
              fieldWidth: fieldRect?.width || 0,
              fieldHeight: fieldRect?.height || 0,
              fieldCount: valueFields.length,
            };
          }),
        };
      }),
    };
  }));

  assert(results.length >= 2, invoiceKind + " must render both new and old ornament table regions.");
  for (const result of results) {
    assert(
      result.tableDisplay === "block" &&
      result.headDisplay === "none" &&
      result.bodyDisplay === "grid",
      invoiceKind + " ornament table is not rendered as a labelled mobile-card list: " + JSON.stringify(result)
    );
    assert(
      result.clientWidth > 0 &&
      result.scrollWidth <= result.clientWidth + 1 &&
      result.tableScrollWidth <= result.clientWidth + 1 &&
      !["auto", "scroll"].includes(result.overflowX),
      invoiceKind + " ornament cards create a horizontal swipe area instead of fitting the screen: " + JSON.stringify(result)
    );
    assert(result.rows.length > 0, invoiceKind + " has no visible ornament cards: " + JSON.stringify(result));
    for (const row of result.rows) {
      assert(
        row.display === "grid" &&
        row.width <= result.clientWidth + 1 &&
        row.right <= result.containerRight + 1,
        invoiceKind + " ornament card is wider than its phone container: " + JSON.stringify(result)
      );
      assert(
        row.labelledCells >= Math.max(4, row.cellCount - 1),
        invoiceKind + " ornament card is missing readable field labels: " + JSON.stringify(result)
      );
      assert(
        row.cells.every((cell) => cell.width >= 60) &&
        row.cells.every((cell) => !cell.fieldCount || cell.fieldWidth >= Math.min(96, cell.width - 12)),
        invoiceKind + " ornament fields were squeezed into narrow desktop percentage columns: " + JSON.stringify(result)
      );
      assert(
        row.cells.every((cell) => !cell.fieldCount || cell.fieldHeight >= 44),
        invoiceKind + " ornament input is vertically clipped or too short for mobile typing: " + JSON.stringify(result)
      );
    }
  }
}

async function fillNewInvoiceForMobile(page, width) {
  const customerPanel = page.locator("#invoice-print .inv-two .inv-panel").nth(0);
  const customerInputs = customerPanel.locator(".form-grid label input");
  await customerInputs.nth(0).fill("mobile QA 123 Customer With A Long Full Name");
  await customerInputs.nth(1).fill("9876543210");
  await customerInputs.nth(2).fill("sasra, Gopiballavpur, Jhargram, Paschim Medinipur, West Bengal — pin 721506, India");

  const paymentPanel = page.locator("#invoice-print .inv-two .inv-panel").nth(1);
  await paymentPanel.locator(".form-grid label select").selectOption("UPI");
  await paymentPanel.locator(".form-grid label input").fill("UPI-TEST-20261117-001");

  const table = page.locator("#invoice-print .new-items-table");
  const fillRow = async (rowIndex, values) => {
    const inputs = table.locator("tbody tr").nth(rowIndex).locator('td input:not([type="radio"])');
    for (let index = 0; index < values.length; index += 1) {
      await inputs.nth(index).fill(String(values[index]));
    }
  };

  await fillRow(0, [
    "22K Gold Necklace with Traditional Filigree Work", "22K / 916",
    "5.25", "6900", "600", "50", "100",
  ]);
  await page.locator("#invoice-print .inv-left .ornament-panel").first()
    .locator("button:has-text('+ Add Ornament')").click();
  await fillRow(1, [
    "Gold Earrings Pair", "22K", "1.2", "6900", "150", "20", "0",
  ]);

  const values = await page.evaluate(() => {
    const invoice = document.querySelector("#invoice-print");
    const panel = invoice?.querySelector(".new-items-table")?.closest(".ornament-panel");
    const totalText = panel?.querySelector(".row-end strong")?.textContent || "";
    const amountText = invoice?.querySelector(".new-items-table tbody tr:first-child td:nth-child(9)")?.textContent || "";
    const wrap = invoice?.querySelector(".new-items-table")?.closest(".table-wrap");
    return {
      name: invoice?.querySelector(".inv-two .inv-panel:first-child .form-grid label:first-child input")?.value || "",
      address: invoice?.querySelector(".inv-two .inv-panel:first-child .form-grid label:nth-child(3) input")?.value || "",
      rows: invoice?.querySelectorAll(".new-items-table tbody tr").length || 0,
      totalNumber: Number(totalText.replace(/[^\d.-]/g, "")),
      firstAmount: Number(amountText.replace(/[^\d.-]/g, "")),
      tableClientWidth: wrap?.clientWidth || 0,
      tableScrollWidth: wrap?.scrollWidth || 0,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  assert(values.name === "MOBILE QA CUSTOMER WITH A LONG FULL NAME" && !/\d/.test(values.name),
    "Customer name must remove digits and remain uppercase: " + JSON.stringify(values.name));
  assert(values.address === "SASRA, GOPIBALLAVPUR, JHARGRAM, PASCHIM MEDINIPUR, WEST BENGAL — PIN 721506, INDIA",
    "Customer address must remain uppercase and preserve house/PIN digits: " + JSON.stringify(values.address));
  assert(values.rows === 2, "New Invoice did not add the second ornament row.");
  assert(Math.abs(values.firstAmount - 36975) < 0.01,
    "New ornament row amount is incorrect: " + JSON.stringify(values));
  assert(Math.abs(values.totalNumber - 45425) < 0.01,
    "New ornament subtotal is incorrect: " + JSON.stringify(values));
  assert(values.tableScrollWidth <= values.tableClientWidth + 1,
    "The New Invoice ornament cards overflow their phone-width container.");
  assert(values.documentWidth <= values.viewportWidth + 1,
    "The populated New Invoice caused page-level horizontal scrolling at " + width + "px.");
}

async function verifyRealSharedPdf(page) {
  const shareButton = page.locator(".nkj-whatsapp-action");
  try {
    await shareButton.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(
      () => {
        const button = document.querySelector(".nkj-whatsapp-action");
        return Boolean(button && !button.disabled);
      },
      { timeout: 35000 }
    );
  } catch (error) {
    const detail = await page.locator(".nkj-invoice-detail-sheet").innerText().catch(() => "");
    throw new Error(
      "The saved invoice's actual PDF file was not prepared for sharing. Detail: " +
      detail.slice(-900) + "; " + error.message
    );
  }

  // Check and click synchronously so a React re-render cannot replace the
  // prepared-PDF button between the enabled check and locator click.
  await page.waitForFunction(
    () => {
      const button = document.querySelector(".nkj-whatsapp-action");
      if (!button || button.disabled) return false;
      button.click();
      return true;
    },
    undefined,
    { timeout: 35000 }
  );
  await page.waitForFunction(
    () => Boolean(window.__nkjSharedPdfCapture),
    undefined,
    { timeout: 10000 }
  );
  const captured = await page.evaluate(() => window.__nkjSharedPdfCapture);
  assert(captured?.type === "application/pdf", "The native share flow did not receive an application/pdf file.");
  assert(captured.size > 1000, "The generated invoice PDF is unexpectedly small or empty.");
  assert(captured.name === responsiveSavedInvoice.invoiceNo + ".pdf",
    "The generated PDF filename does not match the saved invoice.");
  assert(captured.header?.startsWith("%PDF-"), "The shared invoice attachment is not a PDF document.");
  const mediaBox = captured.header.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
  assert(mediaBox, "The actual shared PDF has no readable page MediaBox.");
  const pageWidth = Number(mediaBox[3]) - Number(mediaBox[1]);
  const pageHeight = Number(mediaBox[4]) - Number(mediaBox[2]);
  assert(pageWidth > pageHeight && pageWidth >= 840 && pageHeight >= 590,
    "The actual shared PDF is not A4 landscape: " + JSON.stringify({ pageWidth, pageHeight }));
}

async function verifyInvoicePrintPdf(page, invoiceKind) {
  await page.emulateMedia({ media: "print" });
  const printLayout = await page.evaluate(() => {
    const invoice = document.querySelector("#invoice-print");
    const actions = document.querySelector(".invoice-actions, .nkj-invoice-detail-actions");
    return {
      width: invoice ? parseFloat(getComputedStyle(invoice).width) : 0,
      actionsDisplay: actions ? getComputedStyle(actions).display : "missing",
    };
  });
  assert(
    printLayout.width >= 1000,
    invoiceKind + " print stylesheet did not restore the full landscape invoice width: " + JSON.stringify(printLayout)
  );
  assert(
    printLayout.actionsDisplay === "none",
    invoiceKind + " print stylesheet did not hide on-screen invoice actions."
  );

  const printGeometry = await page.evaluate(() => {
    const rect = (element) => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        className: typeof element.className === "string" ? element.className : element.tagName,
        top: Math.round(r.top), left: Math.round(r.left),
        right: Math.round(r.right), bottom: Math.round(r.bottom),
        width: Math.round(r.width), height: Math.round(r.height),
        scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight,
        clientWidth: element.clientWidth, clientHeight: element.clientHeight,
        display: style.display, visibility: style.visibility, position: style.position,
        minHeight: style.minHeight, maxHeight: style.maxHeight, overflow: style.overflow,
        breakInside: style.breakInside, breakBefore: style.breakBefore, breakAfter: style.breakAfter,
      };
    };
    const main = document.querySelector("main.container");
    const invoice = document.querySelector("#invoice-print");
    const overlay = document.querySelector(".nkj-invoice-detail-overlay");
    const dialog = document.querySelector(".nkj-invoice-detail-sheet");
    return {
      viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      body: rect(document.body),
      root: rect(document.querySelector("#root")),
      appLayout: rect(document.querySelector(".app-layout")),
      appContent: rect(document.querySelector(".app-content")),
      main: rect(main),
      mainChildren: Array.from(main?.children || []).map(rect),
      overlay: rect(overlay),
      dialog: rect(dialog),
      invoice: rect(invoice),
      invoiceChildren: Array.from(invoice?.children || []).map(rect),
    };
  });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  assert(
    pdf.length > 1000 && pdf.subarray(0, 5).toString("ascii") === "%PDF-",
    invoiceKind + " print/PDF output was not a valid PDF."
  );
  const pdfText = pdf.toString("latin1");
  const pageMatches = [...pdfText.matchAll(/\/Type\s*\/Page\b/g)];
  const pageCount = pageMatches.length;
  const mediaBoxes = [...pdfText.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)]
    .map((match) => match.slice(1).map(Number));
  assert(pageCount === 1, invoiceKind + " browser print produced " + pageCount +
    " pages; expected one page for the controlled fixture. Print geometry: " + JSON.stringify({
      printGeometry, mediaBoxes,
    }));
  const mediaBox = pdfText.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
  if (mediaBox) {
    const width = Number(mediaBox[3]) - Number(mediaBox[1]);
    const height = Number(mediaBox[4]) - Number(mediaBox[2]);
    assert(width > height, invoiceKind + " PDF page is not landscape.");
  }
  await page.emulateMedia({ media: "screen" });
}

async function testNewInvoiceMobile(browser, width) {
  const viewport = { name: "invoice-mobile-" + width, width, height: 820 };
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await installApiMocks(page);
  try {
    await page.goto(BASE_URL + "/invoice", { waitUntil: "domcontentloaded" });
    await page.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });
    await fillNewInvoiceForMobile(page, width);
    await inspectInvoiceMobileLayout(page, viewport, "New Invoice");
    await assertInvoiceTablesUseMobileCards(page, "New Invoice");
    if (width === 390) await verifyInvoicePrintPdf(page, "New Invoice");
    process.stdout.write("PASS populated New Invoice layout, calculations and table swipe at " + width + "px\n");
  } finally {
    await context.close();
  }
}
async function testNewInvoiceNativePrintSinglePage(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  await installApiMocks(page);

  try {
    await page.goto(BASE_URL + "/invoice", { waitUntil: "domcontentloaded" });
    await page.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#invoice-print .new-items-table tbody tr").first().locator("td").nth(2).locator("input").fill("22K / 916");
    await page.locator("#invoice-print .new-items-table tbody tr").first().locator("td").nth(3).locator("input").fill("5.25");
    await page.locator("#invoice-print .new-items-table tbody tr").first().locator("td").nth(4).locator("input").fill("6900");

    await page.emulateMedia({ media: "print" });
    const geometry = await page.evaluate(() => {
      const invoice = document.querySelector("#invoice-print");
      const main = document.querySelector("main.invoice-container");
      const appLayout = document.querySelector(".app-layout");
      const rect = invoice.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      return {
        invoiceTop: rect.top,
        invoiceHeight: rect.height,
        mainTop: mainRect.top,
        appLayoutMinHeight: getComputedStyle(appLayout).minHeight,
        appLayoutDisplay: getComputedStyle(appLayout).display,
        appContentDisplay: getComputedStyle(document.querySelector(".app-content")).display,
        invoiceBreakInside: getComputedStyle(invoice).breakInside,
      };
    });

    assert(geometry.invoiceTop <= 1 && geometry.mainTop <= 1,
      "New invoice must start at the top of print page 1: " + JSON.stringify(geometry));
    assert(geometry.appLayoutDisplay === "block" && geometry.appContentDisplay === "block",
      "Print layout must reset the full-height application flex shell: " + JSON.stringify(geometry));
    assert(geometry.invoiceBreakInside !== "avoid",
      "The complete invoice sheet must not be treated as one unbreakable print block.");

    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    const pdfSource = pdf.toString("latin1");
    const pageCount = (pdfSource.match(/\/Type\s*\/Page\b/g) || []).length;
    assert(pageCount === 1,
      "New invoice Ctrl+P must generate exactly one A4 landscape PDF page, not " + pageCount + ".");

    process.stdout.write("PASS new invoice Ctrl+P prints from page 1 on one A4 landscape page\\n");
  } finally {
    await context.close();
  }
}

async function testInvoiceMakingChargeModes(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  await installApiMocks(page);
  try {
    await page.goto(BASE_URL + "/invoice", { waitUntil: "domcontentloaded" });
    await page.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });
    const row = page.locator("#invoice-print .new-items-table tbody tr").first();
    const deleteButton = row.locator("td:last-child .icon-btn");
    const deleteButtonRect = await deleteButton.boundingBox();
    const deleteIconRect = await deleteButton.locator("svg").boundingBox();
    assert(deleteButtonRect && deleteButtonRect.width >= 32 && deleteButtonRect.height >= 32,
      "New ornament delete button must have a visible 32px or larger hit target.");
    assert(deleteIconRect && deleteIconRect.width >= 11 && deleteIconRect.width <= 14
      && deleteIconRect.height >= 11 && deleteIconRect.height <= 14,
      "New ornament trash glyph must remain compact at about 12–13px.");
    const weightInput = row.locator("td").nth(3).locator("input");
    const rateInput = row.locator("td").nth(4).locator("input");
    const flatMode = row.locator('.making-charge-mode-option input[value="amount"]');
    const percentMode = row.locator('.making-charge-mode-option input[value="percent"]');

    await weightInput.fill("5.25");
    await rateInput.fill("6900");
    await flatMode.check();
    await row.locator(".making-charge-flat-input").fill("5000");
    let rowTotal = Number((await row.locator("td").nth(8).innerText()).replace(/[^\d.-]/g, ""));
    assert(Math.abs(rowTotal - 41375) < 0.01, "Fixed ₹5,000 making charge total is incorrect: " + rowTotal);

    await percentMode.check();
    await row.locator(".making-charge-percent-input").fill("12");
    const makingCell = row.locator("td").nth(5);
    const stampCell = row.locator("td").nth(6);
    const resultRect = await row.locator(".making-charge-result").boundingBox();
    const inputRect = await row.locator(".making-charge-percent-input").boundingBox();
    const cellRect = await makingCell.boundingBox();
    const stampInputRect = await stampCell.locator("input").boundingBox();
    assert(resultRect && inputRect && Math.abs(resultRect.y - inputRect.y) < 5,
      "Percent entry and converted rupee amount must be displayed side by side.");
    assert(cellRect && resultRect.left >= cellRect.left && resultRect.right <= cellRect.right + 1,
      "Calculated rupee box must remain inside the Making Charge column; it must not overlap Stamp Charge.");
    assert(stampInputRect && resultRect.right < stampInputRect.left,
      "Calculated rupee box overlaps the Stamp Charge input.");
    const preview = await row.locator(".making-charge-result").innerText();
    const makingAmount = Number(preview.replace(/[^\d.-]/g, ""));
    assert(Math.abs(makingAmount - 4347) < 0.01, "12% making charge should equal ₹4,347.00: " + preview);

    rowTotal = Number((await row.locator("td").nth(8).innerText()).replace(/[^\d.-]/g, ""));
    assert(Math.abs(rowTotal - 40722) < 0.01, "Percentage mode ornament total is incorrect: " + rowTotal);

    await rateInput.fill("7000");
    const recalculated = Number((await row.locator(".making-charge-result").innerText()).replace(/[^\d.-]/g, ""));
    assert(Math.abs(recalculated - 4410) < 0.01, "Percentage charge did not recalculate after rate changed: " + recalculated);
    process.stdout.write("PASS invoice making charge percent/rupee selection and live totals\n");
  } finally {
    await context.close();
  }
}

async function testInvoiceToolbarAndDeleteControls(browser) {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width <= 760 ? 844 : 950 },
    });
    const page = await context.newPage();
    await installApiMocks(page);
    try {
      await page.goto(BASE_URL + "/invoice", { waitUntil: "domcontentloaded" });
      await page.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });

      assert(await page.locator(".nkj-calculator-trigger").count() === 0,
        "Invoice page must not show a Calculator button.");
      assert(await page.locator(".nkj-invoice-calculator-popup, .nkj-invoice-calculator-scrim").count() === 0,
        "Invoice page must not render a calculator popup or overlay.");

      const newDelete = page.locator("#invoice-print .new-items-table tbody tr").first().locator("td:last-child .icon-btn");
      const oldDelete = page.locator("#invoice-print .old-items-table tbody tr").first().locator("td:last-child .icon-btn");
      for (const [label, button] of [["new ornament", newDelete], ["old ornament", oldDelete]]) {
        const buttonRect = await button.boundingBox();
        const iconRect = await button.locator("svg").boundingBox();
        assert(buttonRect && buttonRect.width >= 32 && buttonRect.height >= 32,
          label + " delete control must retain a >=32px hit target; got " + JSON.stringify(buttonRect));
        assert(iconRect && iconRect.width >= 11 && iconRect.width <= 14 && iconRect.height >= 11 && iconRect.height <= 14,
          label + " trash icon should be about 12–13px; got " + JSON.stringify(iconRect));
      }
      process.stdout.write("PASS invoice has no Calculator button and accessible delete targets with compact icons at " + width + "px\\n");
    } finally {
      await context.close();
    }
  }
}

async function testInvoiceSavePinGate(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  let saveCalls = 0;
  let verifyCalls = [];
  let consumeCalls = 0;
  let saveRequestHeaders = null;
  let printDialogOpened = false;

  await page.addInitScript(() => {
    window.print = () => { window.__nkjPrintDialogOpened = true; };
    localStorage.setItem("nkj_user", "admin2026");
  });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }
    if (url.pathname === "/api/events" || url.pathname === "/api/events/public") {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "cache-control": "no-cache" },
        body: ": responsive-save-pin-test\n\n",
      });
      return;
    }

    if (url.pathname === "/api/invoices/date-support") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          invoiceDateSupported: true,
          apiVersion: "backdated-invoice-date-v1",
          invoiceGstinVisibilitySupported: true,
        }),
      });
      return;
    }

    if (url.pathname === "/api/invoices/verify-pin" && request.method() === "POST") {
      const body = request.postDataJSON();
      verifyCalls.push(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          verified: true,
          ticket: body.purpose === "SAVE" ? "qa-save-ticket" : "qa-print-ticket",
          expiresInSeconds: 90,
        }),
      });
      return;
    }

    if (url.pathname === "/api/invoices" && request.method() === "POST") {
      saveCalls += 1;
      saveRequestHeaders = request.headers();
      const body = request.postDataJSON();
      const selectedDate = String(body.invoiceDate || "");
      const datePart = selectedDate.slice(8, 10) + selectedDate.slice(5, 7) + selectedDate.slice(2, 4);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 9001,
          invoiceNo: "NKJ-" + datePart + "-001",
          invoiceDate: selectedDate,
          showGstin: body.showGstin !== false,
          customerName: body.customerName,
          grandTotal: body.grandTotal || 0,
        }),
      });
      return;
    }

    if (url.pathname === "/api/invoices/consume-print-ticket" && request.method() === "POST") {
      consumeCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authorized: true }),
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

  try {
    await page.goto(BASE_URL + "/invoice", { waitUntil: "domcontentloaded" });
    await page.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });

    await page.locator("#invoice-print .inv-two .inv-panel").first()
      .locator(".form-grid label input").first().fill("PIN Gate QA Customer");
    await page.locator("#invoice-print .new-items-table tbody tr:first-child td input")
      .first().fill("PIN gate test gold ring");

    const invoiceDraftKey = "nkj.invoice.draft.v2:admin2026:new";
    await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), invoiceDraftKey);
    await page.locator(".invoice-actions button.primary").click();
    await page.locator(".nkj-pin-overlay").waitFor({ state: "visible", timeout: 5000 });

    assert(saveCalls === 0, "New invoice reached POST /api/invoices before the SAVE PIN was verified.");
    assert(verifyCalls.length === 0, "A save request should not verify a PIN until the user submits the dialog.");

    await page.locator("#nkj-invoice-pin").fill("123456");
    await page.locator(".nkj-pin-dialog button[type='submit']").click();
    await page.waitForFunction(() => document.querySelector(".nkj-pin-overlay") === null, { timeout: 10000 });
    assert(saveCalls === 1, "The invoice was not posted after successful SAVE PIN verification.");
    assert(verifyCalls.length === 1 && verifyCalls[0].purpose === "SAVE",
      "The first PIN verification did not declare purpose SAVE: " + JSON.stringify(verifyCalls));
    assert(Boolean(verifyCalls[0].idempotencyKey),
      "The SAVE PIN was not bound to the draft idempotency key.");
    assert(saveRequestHeaders?.["x-invoice-pin-ticket"] === "qa-save-ticket",
      "The invoice POST did not include the one-time SAVE PIN ticket.");
    assert(Boolean(saveRequestHeaders?.["idempotency-key"]),
      "The invoice POST did not include its idempotency key.");
    assert(!(await page.evaluate((key) => localStorage.getItem(key), invoiceDraftKey)),
      "A successfully saved invoice left its local draft behind.");

    await page.locator(".invoice-actions button:not(.nkj-invoice-reset-button).secondary").click();
    await page.locator(".nkj-pin-overlay").waitFor({ state: "visible", timeout: 5000 });
    await page.locator("#nkj-invoice-pin").fill("123456");
    await page.locator(".nkj-pin-dialog button[type='submit']").click();
    await page.waitForFunction(() => window.__nkjPrintDialogOpened === true, { timeout: 10000 });

    assert(verifyCalls.length === 2 && verifyCalls[1].purpose === "PRINT",
      "Printing did not request a separate PRINT PIN after the SAVE PIN.");
    assert(verifyCalls[1].invoiceId === 9001,
      "The PRINT PIN was not bound to the newly saved invoice ID.");
    assert(consumeCalls === 1, "The print ticket was not consumed exactly once before printing.");
    printDialogOpened = await page.evaluate(() => window.__nkjPrintDialogOpened === true);
    assert(printDialogOpened, "The native print action was not reached after PRINT PIN authorization.");

    process.stdout.write("PASS save PIN gate, bound save ticket, separate print PIN and one-time print authorization\n");
  } finally {
    await context.close();
  }
}

async function testInvoiceDraftRecoveryAndReset(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await installApiMocks(page);
  const draftKey = "nkj.invoice.draft.v2:admin2026:new";
  const otherUserDraftKey = "nkj.invoice.draft.v2:anotheruser:new";

  try {
    await page.goto(BASE_URL + "/invoice", { waitUntil: "domcontentloaded" });
    await page.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });

    const customerInputs = page.locator("#invoice-print .inv-two .inv-panel").first()
      .locator(".form-grid label input");
    const newItemInputs = page.locator("#invoice-print .new-items-table tbody tr:first-child td input");
    await customerInputs.nth(0).fill("Draft Recovery Customer");
    await customerInputs.nth(1).fill("9876543210");
    await customerInputs.nth(2).fill("Jhargram, West Bengal");
    await newItemInputs.nth(0).fill("Draft Gold Necklace");
    await newItemInputs.nth(2).fill("4.25");
    await page.evaluate((key) => {
      localStorage.setItem(key, JSON.stringify({
        version: 2,
        customer: { name: "Another User Draft" },
        invoiceDate: "2026-11-17",
      }));
    }, otherUserDraftKey);

    await page.waitForFunction((key) => {
      const draft = JSON.parse(localStorage.getItem(key) || "null");
      return draft?.version === 2 && draft?.customer?.name === "Draft Recovery Customer";
    }, draftKey);
    const storedDraft = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), draftKey);
    assert(storedDraft?.newItems?.[0]?.description === "Draft Gold Necklace",
      "Ornament details were not persisted in the user's draft.");
    assert(storedDraft?.newItems?.[0]?.netWeight === "4.25",
      "Ornament weight was not persisted in the user's draft.");
    assert((await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).customer.name, otherUserDraftKey))
      === "Another User Draft",
      "Saving this account's draft overwrote another user's draft.");

    // Leave through the application Home route, then return through the real route.
    await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
    await page.goto(BASE_URL + "/invoice", { waitUntil: "domcontentloaded" });
    await page.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });
    assert((await customerInputs.nth(0).inputValue()) === "Draft Recovery Customer",
      "Home -> New Invoice navigation did not restore the customer.");
    assert((await newItemInputs.nth(0).inputValue()) === "Draft Gold Necklace",
      "Home -> New Invoice navigation did not restore ornament details.");

    // A direct browser reload must keep the draft, including its idempotency key.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });
    assert((await customerInputs.nth(0).inputValue()) === "Draft Recovery Customer",
      "Refreshing /invoice cleared the user's unfinished draft.");
    const afterReload = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), draftKey);
    assert(afterReload?.idempotencyKey === storedDraft.idempotencyKey,
      "Refreshing /invoice replaced the draft idempotency key.");

    let escapeCancelMessage = "";
    page.once("dialog", async (dialog) => {
      escapeCancelMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.keyboard.press("Escape");
    assert(escapeCancelMessage === "Are you sure you want to reset this invoice? All unsaved data will be deleted.",
      "Escape did not show the required reset confirmation.");
    assert((await customerInputs.nth(0).inputValue()) === "Draft Recovery Customer",
      "Canceling the Escape confirmation changed invoice fields.");

    page.once("dialog", async (dialog) => { await dialog.dismiss(); });
    await page.locator(".nkj-invoice-reset-button").click();
    assert((await customerInputs.nth(0).inputValue()) === "Draft Recovery Customer",
      "Canceling the Reset button changed invoice fields.");
    assert(Boolean(await page.evaluate((key) => localStorage.getItem(key), draftKey)),
      "Canceling Reset deleted the local draft.");

    page.once("dialog", async (dialog) => { await dialog.accept(); });
    await page.locator(".nkj-invoice-reset-button").click();
    assert((await customerInputs.nth(0).inputValue()) === "",
      "Confirming Reset did not clear customer fields.");
    assert(!(await page.evaluate((key) => localStorage.getItem(key), draftKey)),
      "Confirming Reset did not delete the account's draft.");
    assert(Boolean(await page.evaluate((key) => localStorage.getItem(key), otherUserDraftKey)),
      "Reset incorrectly removed another user's draft.");

    // Independently exercise Escape-confirm as well as Escape-cancel.
    await customerInputs.nth(0).fill("Escape Confirm Customer");
    await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), draftKey);
    page.once("dialog", async (dialog) => { await dialog.accept(); });
    await page.keyboard.press("Escape");
    assert((await customerInputs.nth(0).inputValue()) === "",
      "Confirming the Escape reset did not clear the current invoice.");
    assert(!(await page.evaluate((key) => localStorage.getItem(key), draftKey)),
      "Confirming the Escape reset did not delete the draft.");

    process.stdout.write("PASS per-user draft autosave, Home/return, reload recovery, Esc cancel/confirm and Reset cancel/confirm\n");
  } finally {
    await context.close();
  }
}

async function testTenMinuteInactivityLogoutAcrossTabs(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page1 = await context.newPage();
  const page2 = await context.newPage();
  const draftKey = "nkj.invoice.draft.v2:admin2026:new";
  const otherUserDraftKey = "nkj.invoice.draft.v2:anotheruser:new";

  await page1.addInitScript(() => { window.__NKJ_TEST_IDLE_TIMEOUT_MS = 2200; });
  await page2.addInitScript(() => { window.__NKJ_TEST_IDLE_TIMEOUT_MS = 2200; });
  await installApiMocks(page1);
  await installApiMocks(page2);

  try {
    await page1.goto(BASE_URL + "/dashboard", { waitUntil: "domcontentloaded" });
    await page1.locator("#nkj-owner-sidebar").waitFor({ state: "attached", timeout: 10000 });
    await page2.goto(BASE_URL + "/dashboard", { waitUntil: "domcontentloaded" });
    await page2.locator("#nkj-owner-sidebar").waitFor({ state: "attached", timeout: 10000 });

    await page1.evaluate((key) => localStorage.setItem(key, JSON.stringify({
      version: 2,
      idempotencyKey: "draft-to-keep-after-logout",
      invoiceDate: "2026-11-17",
      customer: { name: "Keep after logout" },
      newItems: [{ description: "Gold ring", netWeight: "1.5" }],
      oldItems: [],
    })), draftKey);
    await page1.evaluate((key) => localStorage.setItem(key, JSON.stringify({
      version: 2, customer: { name: "Another user's data" },
    })), otherUserDraftKey);

    // Activity in one tab must refresh the idle deadline in the other tab.
    await page1.waitForTimeout(700);
    await page1.mouse.move(180, 140);
    await page1.waitForTimeout(1200);
    assert((await page2.evaluate(() => location.pathname)) === "/dashboard",
      "Activity in the first tab did not reset the second tab's idle deadline.");

    await Promise.all([
      page1.waitForURL("**/login", { timeout: 6000 }),
      page2.waitForURL("**/login", { timeout: 6000 }),
    ]);
    const loginText1 = await page1.locator(".nkj-login-card").innerText();
    const loginText2 = await page2.locator(".nkj-login-card").innerText();
    assert(loginText1.includes("Your session expired due to inactivity. Please log in again."),
      "The first tab did not display the required inactivity message.");
    assert(loginText2.includes("Your session expired due to inactivity. Please log in again."),
      "The second tab did not receive synchronized inactivity logout.");
    assert(Boolean(await page1.evaluate((key) => localStorage.getItem(key), draftKey)),
      "Automatic logout deleted the unsaved invoice draft.");

    // Simulate a successful TOTP login response by restoring the same account's
    // authenticated browser state, then reload the app so AuthProvider validates it.
    await page1.evaluate(() => {
      localStorage.setItem("nkj_token", "responsive-relogin-token");
      localStorage.setItem("nkj_user", "admin2026");
    });
    await page1.goto(BASE_URL + "/login", { waitUntil: "domcontentloaded" });
    await page1.waitForURL("**/", { timeout: 10000 });
    await page1.goto(BASE_URL + "/invoice", { waitUntil: "domcontentloaded" });
    await page1.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });
    const recoveredName = await page1.locator("#invoice-print .inv-two .inv-panel").first()
      .locator(".form-grid label input").nth(0).inputValue();
    assert(recoveredName === "Keep after logout",
      "The user's unsaved invoice draft was not restored after login.");
    assert(Boolean(await page1.evaluate((key) => localStorage.getItem(key), otherUserDraftKey)),
      "Logging out/in changed another user's separate draft.");

    process.stdout.write("PASS interaction-reset idle timer, cross-tab logout, exact message and post-login draft recovery\n");
  } finally {
    await context.close();
  }
}

async function testSavedInvoiceMobile(browser) {
  const viewport = { name: "saved-invoice-mobile-390", width: 390, height: 844 };
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await installApiMocks(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (payload) => {
        const file = payload?.files?.[0];
        if (!file) throw new Error("No PDF file was passed to the native share flow.");
        const bytes = new Uint8Array(await file.slice(0, 200000).arrayBuffer());
        window.__nkjSharedPdfCapture = {
          name: file.name,
          type: file.type,
          size: file.size,
          header: new TextDecoder("ascii").decode(bytes),
        };
      },
    });
  });
  try {
    await page.goto(
      BASE_URL + "/saved-invoices?invoiceId=" + responsiveSavedInvoice.id,
      { waitUntil: "domcontentloaded" }
    );
    await page.locator(".nkj-invoice-detail-overlay #invoice-print.nkj-saved-invoice-sheet")
      .waitFor({ state: "visible", timeout: 12000 });
    await inspectInvoiceMobileLayout(page, viewport, "Old/Saved Invoice");
    await assertInvoiceTablesUseMobileCards(page, "Old/Saved Invoice");
    await verifyInvoicePrintPdf(page, "Old/Saved Invoice");
    await verifyRealSharedPdf(page);
    process.stdout.write("PASS populated Old Invoice modal, browser print and actual PDF share file\n");
  } finally {
    await context.close();
  }
}
async function assertMobileHeaderAlignment(page, headerSelector, menuSelector, brandSelector, label) {
  const result = await page.evaluate(({ headerSelector, menuSelector, brandSelector }) => {
    const header = document.querySelector(headerSelector);
    const menu = document.querySelector(menuSelector);
    const brand = document.querySelector(brandSelector);
    if (!header || !menu || !brand) return null;
    const a = menu.getBoundingClientRect();
    const b = brand.getBoundingClientRect();
    return {
      menuLeft: a.left,
      menuTop: a.top,
      menuRight: a.right,
      menuCenterY: a.top + a.height / 2,
      brandLeft: b.left,
      brandRight: b.right,
      brandCenterY: b.top + b.height / 2,
      headerLeft: header.getBoundingClientRect().left,
      headerRight: header.getBoundingClientRect().right,
    };
  }, { headerSelector, menuSelector, brandSelector });

  assert(result, label + " mobile header/menu/brand element was missing.");
  assert(
    result.brandLeft < result.menuLeft &&
    result.menuLeft >= result.brandRight - 2 &&
    result.menuRight >= result.headerRight - 15 &&
    result.menuRight <= result.headerRight + 2,
    label + " header must place the shop name on the left and hamburger on the right: " + JSON.stringify(result)
  );
  assert(
    Math.abs(result.menuCenterY - result.brandCenterY) <= 14,
    label + " hamburger and shop name are not aligned on one header row: " + JSON.stringify(result)
  );
}

async function assertOwnerHamburgerRightEdge(page, label) {
  const layout = await page.evaluate(() => {
    const header = document.querySelector(".nkj-owner-topbar.nkj-reference-navbar");
    const brand = header?.querySelector(":scope > a.brand");
    const menu = header?.querySelector(":scope > button.nkj-mobile-menu-button");
    if (!header || !brand || !menu) return null;
    const headerRect = header.getBoundingClientRect();
    const brandRect = brand.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const headerStyle = getComputedStyle(header);
    const menuStyle = getComputedStyle(menu);
    return {
      headerWidth: headerRect.width,
      headerRight: headerRect.right,
      brandRight: brandRect.right,
      menuLeft: menuRect.left,
      menuRight: menuRect.right,
      menuWidth: menuRect.width,
      rightGap: headerRect.right - menuRect.right,
      headerDirection: headerStyle.flexDirection,
      menuPosition: menuStyle.position,
      menuDisplay: menuStyle.display,
      menuVisibility: menuStyle.visibility,
    };
  });

  assert(layout, label + " owner header elements were missing.");
  assert(
    layout.headerDirection === "row" &&
    layout.menuPosition === "absolute" &&
    layout.menuDisplay !== "none" &&
    layout.menuVisibility === "visible" &&
    layout.menuWidth >= 40 &&
    layout.rightGap >= 6 && layout.rightGap <= 20 &&
    layout.menuLeft > layout.brandRight,
    label + " owner hamburger must stay at the far right of the header: " + JSON.stringify(layout)
  );
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
    for (const width of [320, 360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await assertMobileHeaderAlignment(
        page, ".nkj-owner-topbar.nkj-reference-navbar", ".nkj-mobile-menu-button",
        ".nkj-owner-topbar.nkj-reference-navbar > .brand", "Owner " + width + "px"
      );
      await assertOwnerHamburgerRightEdge(page, "Owner " + width + "px");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".nkj-mobile-menu-button").click();
    await page.locator(".nkj-owner-sidebar:not(.is-collapsed)").waitFor({ state: "visible", timeout: 5000 });
    await page.locator('.nkj-owner-nav a[href="/profile"]').click();
    await page.waitForURL("**/profile");
    await page.locator(".nkj-owner-sidebar.is-collapsed").waitFor({ state: "attached", timeout: 5000 });
    process.stdout.write("PASS owner mobile drawer opens, navigates, and closes\n");
  } finally {
    await context.close();
  }
}

async function testPhysicalMobileLayout(browser) {
  // Simulate Android Chrome with "Desktop site" enabled: a wide layout
  // viewport, but a touch-first physical device.
  const context = await browser.newContext({
    viewport: { width: 980, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await installApiMocks(page);
  try {
    await page.goto(BASE_URL + "/calculator", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.documentElement.classList.contains("nkj-touch-viewport-corrected"),
      { timeout: 10000 }
    );
    await page.locator(".nkj-calculator-page").waitFor({ state: "visible", timeout: 10000 });
    const calculator = await page.evaluate(() => {
      const options = document.querySelector(".nkj-calculator-options");
      const ornament = document.querySelector(".nkj-calc-ornament");
      const menu = document.querySelector(".nkj-mobile-menu-button");
      const columns = (value) => value.trim().split(/\s+/).filter(Boolean).length;
      return {
        viewportWidth: document.documentElement.clientWidth,
        screenWidth: window.screen.width,
        viewportMeta: document.querySelector('meta[name="viewport"]')?.content || "",
        coarsePointer: matchMedia("(pointer: coarse)").matches,
        optionsColumns: options ? columns(getComputedStyle(options).gridTemplateColumns) : 0,
        ornamentColumns: ornament ? columns(getComputedStyle(ornament).gridTemplateColumns) : 0,
        menuVisible: Boolean(menu && getComputedStyle(menu).display !== "none"),
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    assert(calculator.coarsePointer && calculator.screenWidth === 390 &&
      calculator.viewportMeta.includes("width=390"),
      "Phone desktop-site viewport was not corrected to the physical device width: " + JSON.stringify(calculator));
    assert(calculator.optionsColumns === 2,
      "Calculator modes did not switch to a two-row phone layout in desktop-site mode: " + JSON.stringify(calculator));
    assert(calculator.ornamentColumns === 1,
      "Calculator details and result did not stack vertically in desktop-site mode: " + JSON.stringify(calculator));
    assert(calculator.menuVisible,
      "Owner mobile hamburger is hidden in desktop-site mode: " + JSON.stringify(calculator));
    assert(calculator.documentWidth <= calculator.viewportWidth + 1,
      "Calculator causes horizontal page overflow in desktop-site mode: " + JSON.stringify(calculator));

    await page.goto(BASE_URL + "/invoice", { waitUntil: "domcontentloaded" });
    await page.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });
    const invoice = await page.evaluate(() => {
      const root = document.querySelector("#invoice-print");
      const firstLabel = root?.querySelector(".form-grid label");
      const input = firstLabel?.querySelector("input, select");
      const colon = firstLabel?.querySelector(":scope > i");
      const shop = root?.querySelector(".inv-shop");
      const meta = root?.querySelector(".inv-meta");
      const rectWidth = (element) => element?.getBoundingClientRect().width || 0;
      return {
        viewportWidth: document.documentElement.clientWidth,
        invoiceWidth: rectWidth(root),
        shopWidth: rectWidth(shop),
        metaWidth: rectWidth(meta),
        inputWidth: rectWidth(input),
        colonDisplay: colon ? getComputedStyle(colon).display : "missing",
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    assert(invoice.shopWidth >= invoice.invoiceWidth * .82 &&
      invoice.metaWidth >= invoice.invoiceWidth * .82,
      "Invoice header/metadata did not use the full phone width in desktop-site mode: " + JSON.stringify(invoice));
    assert(invoice.inputWidth >= invoice.invoiceWidth * .7 && invoice.colonDisplay === "none",
      "Invoice customer/payment fields did not stack to a readable phone layout: " + JSON.stringify(invoice));
    assert(invoice.documentWidth <= invoice.viewportWidth + 1,
      "Invoice causes horizontal page overflow in desktop-site mode: " + JSON.stringify(invoice));
    await assertInvoiceTablesUseMobileCards(page, "Physical mobile invoice");
    process.stdout.write("PASS physical-mobile responsive layout with a 980px desktop-site viewport\n");
  } finally {
    await context.close();
  }
}

async function testRateBoardPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await installApiMocks(page);

  try {
    await page.goto(BASE_URL + "/rate", { waitUntil: "domcontentloaded" });
    await page.locator(".nkj-rate-board-stage").waitFor({ state: "visible", timeout: 10000 });
    await page.locator(".nkj-rate-board-edit-hotspot").waitFor({ state: "visible", timeout: 5000 });
    await page.locator(".nkj-rate-board-fullscreen-hotspot").waitFor({ state: "visible", timeout: 5000 });

    const board = await page.evaluate(() => {
      const values = [...document.querySelectorAll(".nkj-rate-board-stage svg[aria-label]")]
        .find((element) => (element.getAttribute("aria-label") || "").includes("Nandikishor Jewellery Works"));
      const edit = document.querySelector(".nkj-rate-board-edit-hotspot");
      const fullscreen = document.querySelector(".nkj-rate-board-fullscreen-hotspot");
      const footer = document.querySelector(".jewellery-footer");
      return {
        dateTimeAndRates: values?.getAttribute("aria-label") || "",
        editHref: edit ? new URL(edit.href).pathname : "",
        fullscreenLabel: fullscreen?.getAttribute("aria-label") || "",
        footerVisible: Boolean(footer && getComputedStyle(footer).display !== "none"
          && footer.getBoundingClientRect().height > 0),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });

    assert(board.dateTimeAndRates.includes("Date ")
      && board.dateTimeAndRates.includes("time ")
      && board.dateTimeAndRates.includes("Gold 22K")
      && board.dateTimeAndRates.includes("Silver"),
      "Rate Board must expose Kolkata date/time and Gold/Silver values: " + JSON.stringify(board));
    assert(board.dateTimeAndRates.includes("1,25,400")
      && board.dateTimeAndRates.includes("1,560"),
      "Rate Board must display demo defaults until verified ERP rates arrive: " + JSON.stringify(board));
    assert(board.editHref === "/rates", "Rate Board Edit hotspot must open ERP rate management.");
    assert(board.fullscreenLabel === "Full Screen", "Rate Board must expose a Full Screen control.");
    assert(!board.footerVisible, "Rate Board must not render the global footer.");
    assert(!board.horizontalOverflow, "Rate Board causes horizontal overflow at 1440x900.");

    await page.locator(".nkj-rate-board-fullscreen-hotspot").click();
    await page.waitForFunction(() => Boolean(document.fullscreenElement), { timeout: 5000 });
    await page.keyboard.press("f");
    await page.waitForFunction(() => !document.fullscreenElement, { timeout: 5000 });
    await page.keyboard.press("f");
    await page.waitForFunction(() => Boolean(document.fullscreenElement), { timeout: 5000 });
    await page.keyboard.press("f");
    await page.waitForFunction(() => !document.fullscreenElement, { timeout: 5000 });

    process.stdout.write("PASS Rate Board defaults, Kolkata clock, Edit, Full Screen/F key and footer suppression\\n");
  } finally {
    await context.close();
  }
}

async function testManualCalculatorEqualsGate(page) {
  await page.goto(BASE_URL + "/calculator", { waitUntil: "domcontentloaded" });
  await page.locator('[data-calculator-mode="manual"]').click();

  const result = page.locator(".nkj-calc-result");
  const expression = page.locator(".nkj-calc-expression");
  await result.waitFor({ state: "visible", timeout: 5000 });

  // Clear persisted drafts first so a result from an earlier test/session
  // cannot make this assertion pass or fail nondeterministically.
  await page.getByRole("button", { name: "AC", exact: true }).click();
  assert((await result.textContent()).trim() === "",
    "Manual calculator result area must be empty before any explicit calculation.");

  for (const key of ["9", "9", "×", "8", "8"]) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
  assert((await expression.textContent()).trim() === "99*88",
    "Manual calculator expression should show 99*88 while the user is typing.");
  assert((await result.textContent()).trim() === "",
    "Manual calculator must not calculate 99*88 while entering keys, before equals.");

  await page.getByRole("button", { name: "=", exact: true }).click();
  assert((await result.textContent()).trim() === "= 8,712.00",
    "Manual calculator should show 8,712.00 only after the equals button is pressed.");

  await page.getByRole("button", { name: "AC", exact: true }).click();
  for (const key of ["9", "9", "×", "8", "8"]) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
  assert((await result.textContent()).trim() === "",
    "Manual calculator must keep the result blank before keyboard Enter.");
  await page.keyboard.press("Enter");
  assert((await result.textContent()).trim() === "= 8,712.00",
    "Manual calculator should calculate 99*88 when Enter is pressed.");

  await page.getByRole("button", { name: "4", exact: true }).click();
  assert((await result.textContent()).trim() === "",
    "Manual calculator must clear the previous result as soon as a new input is entered.");

  process.stdout.write("PASS manual calculator shows 99*88 only after equals or Enter\\n");
}

async function testHomeCollectionNavigation(browser) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  await installApiRouteMocks(page);
  const collections = [
    { slug: "necklaces", title: "Necklaces" },
    { slug: "earrings", title: "Earrings" },
    { slug: "bangles", title: "Bangles" },
    { slug: "rings", title: "Rings" },
  ];

  try {
    for (const collection of collections) {
      await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
      const card = page.locator(
        'a.nkj-public-collection-card[href="/designs?collection=' + collection.slug + '"]'
      );
      await card.waitFor({ state: "visible", timeout: 10000 });
      await card.click();
      await page.waitForURL("**/designs?collection=" + collection.slug);
      await page.waitForFunction((expected) => {
        return document.querySelector(".nkj-designs-gallery-heading h2")?.textContent?.trim() === expected;
      }, collection.title, { timeout: 10000 });
    }

    await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
    await page.locator(".nkj-public-collection-view-more").click();
    await page.waitForURL((url) => url.pathname === "/designs", { timeout: 10000 });
    process.stdout.write("PASS homepage collection cards open their matching catalogue categories and View More opens all designs\\n");
  } finally {
    await context.close();
  }
}

async function testOwnerLoginSingleClick(browser) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  await installApiRouteMocks(page);
  const loginRequests = [];
  const verifyRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/auth/login" && request.method() === "POST") {
      loginRequests.push(request.postDataJSON());
    }
    if (url.pathname === "/api/auth/verify" && request.method() === "POST") {
      verifyRequests.push(request.postDataJSON());
    }
  });

  try {
    await page.goto(BASE_URL + "/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[autocomplete="username"]').fill("admin2026");
    await page.locator('input[autocomplete="current-password"]').fill("test-password");
    await page.locator('input[autocomplete="one-time-code"]').fill("123456");
    await page.locator(".nkj-login-submit").click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 10000 });

    assert(loginRequests.length === 1,
      "A single Login click must issue exactly one /auth/login request; got " + loginRequests.length + ".");
    assert(verifyRequests.length === 1,
      "A single Login click must issue exactly one /auth/verify request; got " + verifyRequests.length + ".");
    assert(verifyRequests[0].challengeId === "responsive-login-challenge",
      "Login verification must use the challenge returned by the same /auth/login request.");
    const storedToken = await page.evaluate(() => localStorage.getItem("nkj_token"));
    assert(storedToken === "responsive-relogin-token",
      "A single Login click did not store the authenticated session token.");
    process.stdout.write("PASS owner login completes from one click using the returned challenge ID\\n");
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
    await assertMobileHeaderAlignment(
      page, ".nkj-public-topbar", ".nkj-public-menu-button",
      ".nkj-public-topbar > .brand", "Public"
    );
    await page.locator(".nkj-public-menu-button").click();
    await page.locator(".nkj-public-topbar > nav.is-open").waitFor({ state: "visible", timeout: 5000 });
    await page.locator('.nkj-public-topbar a[href="/designs"]').click();
    await page.waitForURL("**/designs");
    await page.locator(".nkj-public-topbar > nav:not(.is-open)").waitFor({ state: "attached", timeout: 5000 });
    process.stdout.write("PASS public mobile menu opens, navigates, and closes\n");
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

    // Run the Ctrl+P page-count regression first so failures surface before
    // the much larger all-routes responsive sweep.
    await testNewInvoiceNativePrintSinglePage(browser);

    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await installApiMocks(page);
      try {
        for (const path of ownerRoutes) {
          process.stdout.write("CHECK " + viewport.name + " " + path + "\n");
          await checkViewport(page, path, viewport);
        }
        if (viewport.width === 390) {
          await testOwnerSidebar(browser);
        }
      } finally {
        await context.close();
      }
      process.stdout.write("PASS all " + ownerRoutes.length + " owner routes at " + viewport.name + " " + viewport.width + "x" + viewport.height + "\n");
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
          body: ": responsive-smoke-connected\n\n",
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
      await testManualCalculatorEqualsGate(publicPage);
      await testRateBoardPage(browser);
    } finally {
      await publicContext.close();
    }

    for (const width of [360, 390, 430]) {
      await testNewInvoiceMobile(browser, width);
    }
    await testInvoiceMakingChargeModes(browser);
    await testInvoiceToolbarAndDeleteControls(browser);
    await testInvoiceSavePinGate(browser);
    await testInvoiceDraftRecoveryAndReset(browser);
    await testTenMinuteInactivityLogoutAcrossTabs(browser);
    // Verify public navbar placement before the independent saved-invoice print fixture.
    await testPublicNavigation(browser);
    await testHomeCollectionNavigation(browser);
    await testOwnerLoginSingleClick(browser);
    await testPhysicalMobileLayout(browser);
    await testSavedInvoiceMobile(browser);
    process.stdout.write("PASS New Invoice at 360/390/430, draft recovery/reset, inactivity logout, saved invoice view and print/PDF layout.\n");
    process.stdout.write("All owner/public page responsive smoke checks passed.\n");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
})();
