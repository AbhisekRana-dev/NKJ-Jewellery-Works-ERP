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

const publicRoutes = ["/", "/invoice", "/designs", "/calculator", "/mobile-design-upload/mobile-responsive-smoke-token", "/login", "/setup-totp"];

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
    result.tableWrap && ["auto", "scroll"].includes(result.tableOverflowX),
    invoiceKind + " ornament table is not contained in its own horizontal swipe region at " + viewport.name + "."
  );
}

async function assertInvoiceTablesAreScrollable(page, invoiceKind) {
  const results = await page.evaluate(() => Array.from(
    document.querySelectorAll("#invoice-print .table-wrap")
  ).map((wrap) => {
    const before = wrap.scrollLeft;
    wrap.scrollLeft = Math.min(180, Math.max(0, wrap.scrollWidth - wrap.clientWidth));
    return {
      tableClass: wrap.querySelector(".items-table")?.className || "",
      clientWidth: wrap.clientWidth,
      scrollWidth: wrap.scrollWidth,
      overflowX: getComputedStyle(wrap).overflowX,
      scrollBefore: before,
      scrollAfter: wrap.scrollLeft,
    };
  }));
  assert(results.length >= 2, invoiceKind + " must render both new and old ornament table regions.");
  for (const result of results) {
    assert(["auto", "scroll"].includes(result.overflowX),
      invoiceKind + " table is not independently scrollable: " + JSON.stringify(result));
    assert(result.scrollWidth > result.clientWidth && result.scrollAfter > result.scrollBefore,
      invoiceKind + " ornament table columns are not reachable by horizontal swipe: " + JSON.stringify(result));
  }
}

async function fillNewInvoiceForMobile(page, width) {
  const customerPanel = page.locator("#invoice-print .inv-two .inv-panel").nth(0);
  const customerInputs = customerPanel.locator(".form-grid label input");
  await customerInputs.nth(0).fill("Mobile QA Customer With A Long Full Name");
  await customerInputs.nth(1).fill("9876543210");
  await customerInputs.nth(2).fill("Sasra, Gopiballavpur, Jhargram, Paschim Medinipur, West Bengal — PIN 721506, India");

  const paymentPanel = page.locator("#invoice-print .inv-two .inv-panel").nth(1);
  await paymentPanel.locator(".form-grid label select").selectOption("UPI");
  await paymentPanel.locator(".form-grid label input").fill("UPI-TEST-20261117-001");

  const table = page.locator("#invoice-print .new-items-table");
  const fillRow = async (rowIndex, values) => {
    const inputs = table.locator("tbody tr").nth(rowIndex).locator("td input");
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
      name: invoice?.querySelector(".inv-two .inv-panel:first-child input")?.value || "",
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

  assert(values.name.includes("Long Full Name"), "New Invoice did not retain the long customer name.");
  assert(values.address.includes("PIN 721506"), "New Invoice did not retain the long customer address.");
  assert(values.rows === 2, "New Invoice did not add the second ornament row.");
  assert(Math.abs(values.firstAmount - 36975) < 0.01,
    "New ornament row amount is incorrect: " + JSON.stringify(values));
  assert(Math.abs(values.totalNumber - 45425) < 0.01,
    "New ornament subtotal is incorrect: " + JSON.stringify(values));
  assert(values.tableScrollWidth > values.tableClientWidth,
    "The New Invoice ornament table is not wider than its scroll viewport.");
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

  await shareButton.click();
  await page.waitForFunction(() => Boolean(window.__nkjSharedPdfCapture), { timeout: 10000 });
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

  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  assert(
    pdf.length > 1000 && pdf.subarray(0, 5).toString("ascii") === "%PDF-",
    invoiceKind + " print/PDF output was not a valid PDF."
  );
  const pdfText = pdf.toString("latin1");
  const pageCount = (pdfText.match(/\/Type\s*\/Page\b/g) || []).length;
  assert(pageCount === 1, invoiceKind + " browser print produced " + pageCount + " pages; expected one page for the controlled fixture.");
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
    await assertInvoiceTablesAreScrollable(page, "New Invoice");
    if (width === 390) await verifyInvoicePrintPdf(page, "New Invoice");
    process.stdout.write("PASS populated New Invoice layout, calculations and table swipe at " + width + "px\n");
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
    await assertInvoiceTablesAreScrollable(page, "Old/Saved Invoice");
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
      brandCenterY: b.top + b.height / 2,
      headerWidth: header.getBoundingClientRect().width,
    };
  }, { headerSelector, menuSelector, brandSelector });

  assert(result, label + " mobile header/menu/brand element was missing.");
  assert(
    result.menuLeft < result.brandLeft && result.menuRight <= result.brandLeft + 2,
    label + " hamburger is not positioned to the left of the shop name: " + JSON.stringify(result)
  );
  assert(
    Math.abs(result.menuCenterY - result.brandCenterY) <= 14,
    label + " hamburger and shop name are not aligned on one header row: " + JSON.stringify(result)
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
    await assertMobileHeaderAlignment(
      page, ".nkj-owner-topbar.nkj-reference-navbar", ".nkj-mobile-menu-button",
      ".nkj-owner-topbar.nkj-reference-navbar > .brand", "Owner"
    );
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
    } finally {
      await publicContext.close();
    }

    for (const width of [360, 390, 430]) {
      await testNewInvoiceMobile(browser, width);
    }
    await testSavedInvoiceMobile(browser);
    await testPublicNavigation(browser);
    process.stdout.write("PASS New Invoice at 360/390/430, saved invoice view, and print/PDF layout.\n");
    process.stdout.write("All owner/public page responsive smoke checks passed.\n");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
})();
