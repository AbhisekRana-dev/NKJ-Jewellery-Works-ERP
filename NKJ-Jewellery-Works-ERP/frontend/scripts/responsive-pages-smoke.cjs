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
  if (path === "/api/auth/login") return { challengeId: "qa-login-challenge", requiresTotp: true };
  if (path === "/api/auth/verify") return { token: "qa-reauthenticated-token", username: "admin2026" };
  if (path === "/api/auth/activity") return { success: true };
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
    const maxScroll = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
    wrap.scrollLeft = 0;
    const leftEdge = wrap.scrollLeft;
    wrap.scrollLeft = maxScroll;
    const rightEdge = wrap.scrollLeft;
    return {
      tableClass: wrap.querySelector(".items-table")?.className || "",
      clientWidth: wrap.clientWidth,
      scrollWidth: wrap.scrollWidth,
      overflowX: getComputedStyle(wrap).overflowX,
      maxScroll,
      leftEdge,
      rightEdge,
    };
  }));
  assert(results.length >= 2, invoiceKind + " must render both new and old ornament table regions.");
  for (const result of results) {
    assert(["auto", "scroll"].includes(result.overflowX),
      invoiceKind + " table is not independently scrollable: " + JSON.stringify(result));
    assert(
      result.scrollWidth > result.clientWidth &&
      result.maxScroll > 0 &&
      result.leftEdge === 0 &&
      result.rightEdge >= result.maxScroll - 1,
      invoiceKind + " ornament table columns are not reachable from both horizontal edges: " + JSON.stringify(result)
    );
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

  const printGeometry = await page.evaluate(() => {
    const rect = (element) => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return {
        className: typeof element.className === "string" ? element.className : element.tagName,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        display: getComputedStyle(element).display,
        visibility: getComputedStyle(element).visibility,
      };
    };
    const main = document.querySelector("main.container");
    return {
      pageHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
      mainHeight: main?.scrollHeight || 0,
      mainChildren: Array.from(main?.children || []).map(rect),
      overlay: rect(document.querySelector(".nkj-invoice-detail-overlay")),
      dialog: rect(document.querySelector(".nkj-invoice-detail-sheet")),
      invoice: rect(document.querySelector("#invoice-print")),
    };
  });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  assert(
    pdf.length > 1000 && pdf.subarray(0, 5).toString("ascii") === "%PDF-",
    invoiceKind + " print/PDF output was not a valid PDF."
  );
  const pdfText = pdf.toString("latin1");
  const pageCount = (pdfText.match(/\/Type\s*\/Page\b/g) || []).length;
  assert(pageCount === 1, invoiceKind + " browser print produced " + pageCount +
    " pages; expected one page for the controlled fixture. Print geometry: " + JSON.stringify(printGeometry));
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
    await page.waitForFunction(
      () => localStorage.getItem("nkj.invoice.draft.v1.v2.guest") === null,
      { timeout: 5000 }
    );
    assert(
      await page.locator(".nkj-invoice-reset-button").isDisabled(),
      "Reset must not be able to clear an already saved invoice."
    );

    await page.locator(".invoice-actions button.secondary").click();
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
const INVOICE_DRAFT_TEST_KEY = "nkj.invoice.draft.v1.v2.admin2026";
const IDLE_ACTIVITY_TEST_KEY = "nkj.session.last-user-activity.v1:admin2026";

async function pushClientRoute(page, path) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await page.waitForURL("**" + path);
}

async function testInvoiceDraftRecoveryAndReset(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await installApiMocks(page);
  try {
    await page.goto(BASE_URL + "/invoice", { waitUntil: "domcontentloaded" });
    await page.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });

    const customerInputs = page.locator("#invoice-print .inv-two .inv-panel").first()
      .locator(".form-grid label input");
    await customerInputs.nth(0).fill("Draft Recovery QA Customer");
    await customerInputs.nth(1).fill("9876543210");
    await customerInputs.nth(2).fill("Draft recovery address, Jhargram, West Bengal");
    await page.locator("#invoice-print .new-items-table tbody tr:first-child td input")
      .nth(0).fill("22K Gold Ring - Draft Recovery");
    await page.locator("#invoice-print .new-items-table tbody tr:first-child td input")
      .nth(2).fill("2.5");

    await page.waitForFunction((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const draft = JSON.parse(raw);
      return draft.customer?.name === "Draft Recovery QA Customer" &&
        draft.customer?.mobile === "9876543210" &&
        draft.customer?.address.includes("Jhargram") &&
        draft.newItems?.[0]?.description === "22K Gold Ring - Draft Recovery" &&
        Number(draft.newItems?.[0]?.netWeight) === 2.5;
    }, INVOICE_DRAFT_TEST_KEY, { timeout: 5000 });

    // Escape must close the calculator popup, not trigger invoice reset.
    await page.getByRole("button", { name: "Open manual calculator" }).click();
    await page.locator(".nkj-invoice-calculator-popup").waitFor({ state: "visible", timeout: 5000 });
    await page.keyboard.press("Escape");
    await page.locator(".nkj-invoice-calculator-popup").waitFor({ state: "hidden", timeout: 5000 });
    assert(
      await page.getByRole("dialog").count() === 0,
      "Escape from the calculator incorrectly opened the invoice reset confirmation."
    );

    const storedDraft = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), INVOICE_DRAFT_TEST_KEY);
    const draftKeys = Object.keys(storedDraft).join(",").toLowerCase();
    assert(!/(password|token|pin)/.test(draftKeys),
      "Invoice draft storage must not contain credentials, session tokens or invoice PIN fields.");

    await pushClientRoute(page, "/");
    await pushClientRoute(page, "/invoice");
    assert(
      await page.locator("#invoice-print .inv-two .inv-panel").first()
        .locator(".form-grid label input").first().inputValue() === "Draft Recovery QA Customer",
      "The draft was not restored after navigating Home and returning to New Invoice."
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });
    assert(
      await page.locator("#invoice-print .inv-two .inv-panel").first()
        .locator(".form-grid label input").first().inputValue() === "Draft Recovery QA Customer",
      "The invoice draft was lost after a full browser refresh."
    );

    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
    assert(
      (await page.getByRole("dialog").innerText()).includes(
        "Are you sure you want to reset this invoice? All unsaved data will be deleted."
      ),
      "The reset confirmation did not show the required warning text."
    );
    await page.getByRole("button", { name: "Cancel" }).click();
    assert(
      await page.locator("#invoice-print .inv-two .inv-panel").first()
        .locator(".form-grid label input").first().inputValue() === "Draft Recovery QA Customer",
      "Cancelling Escape reset changed the existing invoice data."
    );

    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
    await page.getByRole("button", { name: "Confirm Reset" }).click();
    await page.waitForFunction((key) => localStorage.getItem(key) === null, INVOICE_DRAFT_TEST_KEY, { timeout: 5000 });
    assert(
      await page.locator("#invoice-print .inv-two .inv-panel").first()
        .locator(".form-grid label input").first().inputValue() === "",
      "Confirming Escape reset did not clear the form fields."
    );

    await customerInputs.nth(0).fill("Reset Button QA Customer");
    await page.waitForFunction((key) => {
      const value = localStorage.getItem(key);
      return Boolean(value && JSON.parse(value).customer?.name === "Reset Button QA Customer");
    }, INVOICE_DRAFT_TEST_KEY, { timeout: 5000 });
    await page.locator(".nkj-invoice-reset-button").click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
    await page.getByRole("button", { name: "Cancel" }).click();
    assert(
      await customerInputs.nth(0).inputValue() === "Reset Button QA Customer",
      "Cancelling the Reset button confirmation changed the invoice data."
    );
    await page.locator(".nkj-invoice-reset-button").click();
    await page.getByRole("button", { name: "Confirm Reset" }).click();
    await page.waitForFunction((key) => localStorage.getItem(key) === null, INVOICE_DRAFT_TEST_KEY, { timeout: 5000 });
    assert(
      await customerInputs.nth(0).inputValue() === "",
      "Confirming the Reset button did not clear the current invoice."
    );
    process.stdout.write("PASS user-scoped draft, SPA navigation, browser refresh, Escape cancel/confirm and Reset cancel/confirm\n");
  } finally {
    await context.close();
  }
}

async function testInvoiceDraftPerUserIsolation(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ownerPage = await context.newPage();
  await installApiMocks(ownerPage);
  try {
    await ownerPage.goto(BASE_URL + "/invoice", { waitUntil: "domcontentloaded" });
    await ownerPage.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });
    await ownerPage.locator("#invoice-print .inv-two .inv-panel").first()
      .locator(".form-grid label input").first().fill("Owner-Only Draft");
    await ownerPage.waitForFunction((key) => {
      const raw = localStorage.getItem(key);
      return raw && JSON.parse(raw).customer?.name === "Owner-Only Draft";
    }, INVOICE_DRAFT_TEST_KEY, { timeout: 5000 });

    const staffPage = await context.newPage();
    await installApiRouteMocks(staffPage);
    await staffPage.addInitScript(() => {
      localStorage.setItem("nkj_token", "secondary-user-test-token");
      localStorage.setItem("nkj_user", "staff-qa");
    });
    await staffPage.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ username: "staff-qa" }),
      });
    });
    await staffPage.goto(BASE_URL + "/invoice", { waitUntil: "domcontentloaded" });
    await staffPage.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });

    const staffDraftKey = "nkj.invoice.draft.v1.v2.staff-qa";
    await staffPage.locator("#invoice-print .inv-two .inv-panel").first()
      .locator(".form-grid label input").first().fill("Staff-Only Draft");
    await staffPage.waitForFunction((key) => {
      const raw = localStorage.getItem(key);
      return raw && JSON.parse(raw).customer?.name === "Staff-Only Draft";
    }, staffDraftKey, { timeout: 5000 });

    const drafts = await ownerPage.evaluate(({ ownerKey, staffKey }) => ({
      owner: JSON.parse(localStorage.getItem(ownerKey) || "null"),
      staff: JSON.parse(localStorage.getItem(staffKey) || "null"),
    }), { ownerKey: INVOICE_DRAFT_TEST_KEY, staffKey: staffDraftKey });
    assert(drafts.owner?.customer?.name === "Owner-Only Draft",
      "The second user's form changed the first user's invoice draft.");
    assert(drafts.staff?.customer?.name === "Staff-Only Draft",
      "The second user's invoice draft was not saved in its own storage namespace.");

    process.stdout.write("PASS invoice drafts remain isolated between distinct authenticated usernames\\n");
  } finally {
    await context.close();
  }
}

async function testIdleLogoutAndDraftRecovery(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await installApiMocks(page);
  try {
    await page.goto(BASE_URL + "/invoice", { waitUntil: "domcontentloaded" });
    await page.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#invoice-print .inv-two .inv-panel").first()
      .locator(".form-grid label input").first().fill("Draft Survives Automatic Logout");
    await page.waitForFunction((key) => {
      const raw = localStorage.getItem(key);
      return raw && JSON.parse(raw).customer?.name === "Draft Survives Automatic Logout";
    }, INVOICE_DRAFT_TEST_KEY, { timeout: 5000 });

    await page.evaluate((key) => {
      localStorage.setItem(key, String(Date.now() - 10 * 60 * 1000 - 1_000));
    }, IDLE_ACTIVITY_TEST_KEY);
    await page.waitForURL("**/login?reason=idle", { timeout: 8000 });
    await page.getByText("Your session expired due to inactivity. Please log in again.", { exact: true })
      .waitFor({ state: "visible", timeout: 5000 });
    assert(
      await page.evaluate((key) => Boolean(localStorage.getItem(key)), INVOICE_DRAFT_TEST_KEY),
      "Automatic logout deleted the unfinished invoice draft."
    );

    const loginFields = page.locator(".nkj-login-field input");
    await loginFields.nth(0).fill("admin2026");
    await loginFields.nth(1).fill("qa-password-not-stored");
    await loginFields.nth(2).fill("123456");
    await page.locator(".nkj-login-submit").click();
    await page.waitForURL("**/", { timeout: 10000 });
    await pushClientRoute(page, "/invoice");
    await page.locator("#invoice-print .inv-shop h1").waitFor({ state: "visible", timeout: 10000 });
    assert(
      await page.locator("#invoice-print .inv-two .inv-panel").first()
        .locator(".form-grid label input").first().inputValue() === "Draft Survives Automatic Logout",
      "The user's unfinished invoice draft was not restored after logging in again."
    );

    const previousActivity = await page.evaluate((key) => {
      const oldValue = Date.now() - 9 * 60 * 1000;
      localStorage.setItem(key, String(oldValue));
      return oldValue;
    }, IDLE_ACTIVITY_TEST_KEY);
    await page.locator("#invoice-print .inv-two .inv-panel").first()
      .locator(".form-grid label input").first().click();
    await page.waitForFunction((key, previous) => Number(localStorage.getItem(key)) > previous,
      IDLE_ACTIVITY_TEST_KEY, previousActivity, { timeout: 5000 });
    assert(
      await page.evaluate((key) => Date.now() - Number(localStorage.getItem(key)) < 10 * 60 * 1000,
        IDLE_ACTIVITY_TEST_KEY),
      "A user interaction did not reset the inactivity deadline."
    );
    process.stdout.write("PASS inactivity logout, exact login notice, draft preservation and same-user recovery\n");
  } finally {
    await context.close();
  }
}

async function testMultiTabLogoutSynchronization(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const firstTab = await context.newPage();
  const secondTab = await context.newPage();
  await installApiMocks(firstTab);
  await installApiMocks(secondTab);
  try {
    await firstTab.goto(BASE_URL + "/dashboard", { waitUntil: "domcontentloaded" });
    await secondTab.goto(BASE_URL + "/dashboard", { waitUntil: "domcontentloaded" });
    await firstTab.locator("#nkj-owner-sidebar").waitFor({ state: "attached", timeout: 10000 });
    await secondTab.locator("#nkj-owner-sidebar").waitFor({ state: "attached", timeout: 10000 });

    const oldActivity = await firstTab.evaluate((key) => {
      const value = Date.now() - 9 * 60 * 1000;
      localStorage.setItem(key, String(value));
      return value;
    }, IDLE_ACTIVITY_TEST_KEY);
    await secondTab.evaluate(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    });
    await firstTab.waitForFunction((key, oldValue) => Number(localStorage.getItem(key)) > oldValue,
      IDLE_ACTIVITY_TEST_KEY, oldActivity, { timeout: 5000 });
    assert(
      await firstTab.evaluate(() => window.location.pathname) === "/dashboard",
      "Activity in one tab did not keep the shared session active in another tab."
    );

    await firstTab.evaluate(() => {
      localStorage.removeItem("nkj_token");
      window.dispatchEvent(new CustomEvent("nkj:session-expired", { detail: { reason: "manual" } }));
    });
    await firstTab.waitForURL("**/login", { timeout: 5000 });
    await secondTab.waitForURL("**/login", { timeout: 5000 });
    process.stdout.write("PASS shared user activity and synchronized logout across browser tabs\n");
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
    await testInvoiceSavePinGate(browser);
    await testInvoiceDraftRecoveryAndReset(browser);
    await testInvoiceDraftPerUserIsolation(browser);
    await testIdleLogoutAndDraftRecovery(browser);
    await testMultiTabLogoutSynchronization(browser);
    await testSavedInvoiceMobile(browser);
    await testPublicNavigation(browser);
    process.stdout.write("PASS invoice PIN, user-scoped draft recovery/reset, 10-minute idle logout and multi-tab synchronization.\n");
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
