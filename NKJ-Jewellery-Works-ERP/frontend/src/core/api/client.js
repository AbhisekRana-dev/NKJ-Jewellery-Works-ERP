import { getRealtimeClientId } from "../realtime/realtime";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

export async function request(path, options = {}) {
  const {
    publicRequest = false,
    suppressSessionExpiry = false,
    ...fetchOptions
  } = options;
  const token = localStorage.getItem("nkj_token");
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
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

  if (response.status === 401 && !suppressSessionExpiry) {
    localStorage.removeItem("nkj_token");
    localStorage.removeItem("nkj_user");
    window.dispatchEvent(new Event("nkj:session-expired"));
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
