import { getRealtimeClientId } from "../realtime/realtime";

const API = import.meta.env.VITE_API_BASE_URL || "/api";
let pendingActivityRequest = Promise.resolve();

export function recordAuthenticatedActivity() {
  const token = localStorage.getItem("nkj_token");
  if (!token) return Promise.resolve();
  const activity = request("/auth/activity", {
    method: "POST",
    skipActivityBarrier: true,
  });
  pendingActivityRequest = activity.then(() => undefined, () => undefined);
  return activity;
}

export async function request(path, options = {}) {
  const {
    publicRequest = false,
    suppressSessionExpiry = false,
    skipActivityBarrier = false,
    ...fetchOptions
  } = options;
  const token = localStorage.getItem("nkj_token");
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  const method = String(fetchOptions.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    headers["X-NKJ-Client-Id"] = getRealtimeClientId();
  }

  if (token && !publicRequest) {
    headers.Authorization = `Bearer ${token}`;
  }

  // A capture-phase input listener starts /auth/activity before the page's
  // business handler runs. Wait for it so a click/key action is not rejected
  // against the previous idle timestamp.
  if (token && !publicRequest && !skipActivityBarrier) {
    await pendingActivityRequest;
  }

  let response;
  try {
    response = await fetch(`${API}${path}`, {
      ...fetchOptions,
      headers,
    });
  } catch (error) {
    throw new Error("Cannot connect to the server. Check that the backend is running.");
  }

  const raw = await response.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw };
    }
  }

  if (response.status === 401 && !suppressSessionExpiry) {
    // Preserve the account identity before clearing shared auth storage so
    // the first tab loading an already-expired session can still display the
    // correct inactivity-specific login notice.
    const expiredUsername = localStorage.getItem("nkj_user") || "";
    localStorage.removeItem("nkj_token");
    localStorage.removeItem("nkj_user");
    window.dispatchEvent(new CustomEvent("nkj:session-expired", {
      detail: {
        username: expiredUsername,
        reason: data.reason || "expired",
        message: data.message || "Your session expired. Please log in again.",
      },
    }));
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error ||
      `Request failed (${response.status})`,
    );
  }

  return data;
}
