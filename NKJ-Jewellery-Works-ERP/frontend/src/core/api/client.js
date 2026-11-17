import { getRealtimeClientId } from "../realtime/realtime";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

export async function request(path, options = {}) {
  const {
    publicRequest = false,
    suppressSessionExpiry = false,
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

  if (response.status === 401 && !suppressSessionExpiry && token) {
    const username = localStorage.getItem("nkj_user") || "";
    const message = String(data.message || data.error || "");
    const reason = /inactivity|inactive|idle timeout/i.test(message)
      ? "inactivity"
      : "session";
    // AuthProvider broadcasts this event to every open tab, then removes the
    // bearer token. Include identity/reason before localStorage is cleared.
    window.dispatchEvent(new CustomEvent("nkj:session-expired", {
      detail: { username, reason },
    }));
  }

  if (!response.ok) {
    const error = new Error(
      data.message ||
      data.error ||
      `Request failed (${response.status})`,
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
