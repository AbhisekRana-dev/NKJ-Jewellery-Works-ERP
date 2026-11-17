import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { request } from "../api/client";

const AuthContext = createContext(null);
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const ACTIVITY_SYNC_INTERVAL_MS = 30 * 1000;
const LAST_ACTIVITY_KEY = "nkj.auth.last-activity.v1";
const LAST_SERVER_ACTIVITY_SYNC_KEY = "nkj.auth.last-server-activity-sync.v1";
const LOGOUT_BROADCAST_KEY = "nkj.auth.logout-event.v1";

function readLogoutReason() {
  const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
  return lastActivity > 0 && Date.now() - lastActivity >= IDLE_TIMEOUT_MS
    ? "inactivity"
    : "expired";
}

function isUnauthorizedSessionError(error) {
  const message = String(error?.message || "");
  return /401|administrator session is not valid|session expired due to inactivity|administrator login required/i.test(message);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState("");
  const [pending, setPending] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const logoutInProgressRef = useRef(false);

  function publishLogout(reason) {
    try {
      localStorage.setItem(LOGOUT_BROADCAST_KEY, JSON.stringify({
        reason,
        at: Date.now(),
      }));
    } catch {
      // The current tab still clears its own session if storage is unavailable.
    }
  }

  function clearLocalSession(reason = "expired", broadcast = false, notifyApp = false) {
    if (broadcast) publishLogout(reason);
    localStorage.removeItem("nkj_token");
    localStorage.removeItem("nkj_user");
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(LAST_SERVER_ACTIVITY_SYNC_KEY);
    setUser("");
    setPending("");
    setAuthReady(true);
    if (notifyApp) {
      window.dispatchEvent(new CustomEvent("nkj:session-expired", {
        detail: { reason },
      }));
    }
  }

  useEffect(() => {
    let active = true;

    const handleApiSessionExpired = (event) => {
      const reason = event?.detail?.reason || readLogoutReason();
      // The API client already dispatched this event; do not dispatch it again.
      clearLocalSession(reason, true, false);
    };

    const handleStorage = (event) => {
      if (event.key === LOGOUT_BROADCAST_KEY && event.newValue) {
        let reason = "expired";
        try {
          reason = JSON.parse(event.newValue)?.reason || reason;
        } catch {}
        clearLocalSession(reason, false, true);
        return;
      }

      if (event.key === "nkj_token" && event.newValue === null) {
        clearLocalSession(readLogoutReason(), false, true);
        return;
      }

      // A login in another tab shares the same browser session token.
      if (event.key === "nkj_token" && event.newValue) {
        request("/auth/session", { suppressSessionExpiry: true })
          .then((result) => {
            if (!active) return;
            const username = result?.username || "";
            if (username) {
              setUser(username);
              localStorage.setItem("nkj_user", username);
              const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
              if (!lastActivity) localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
            }
          })
          .catch(() => {
            if (active) clearLocalSession(readLogoutReason(), false, true);
          });
      }
    };

    window.addEventListener("nkj:session-expired", handleApiSessionExpired);
    window.addEventListener("storage", handleStorage);

    const restoreSession = async () => {
      const token = localStorage.getItem("nkj_token");
      if (!token) {
        localStorage.removeItem("nkj_user");
        if (active) setAuthReady(true);
        return;
      }

      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
      if (!lastActivity) {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      } else if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
        // Attempt server-side invalidation before removing the bearer token.
        try {
          await request("/auth/logout", {
            method: "POST",
            suppressSessionExpiry: true,
          });
        } catch {}
        if (active) clearLocalSession("inactivity", true, true);
        return;
      }

      try {
        const result = await request("/auth/session", { suppressSessionExpiry: true });
        if (!active) return;
        const username = result?.username || "";
        if (username) {
          setUser(username);
          localStorage.setItem("nkj_user", username);
        } else {
          clearLocalSession("expired", true, true);
        }
      } catch (error) {
        if (active) {
          const reason = isUnauthorizedSessionError(error) ? readLogoutReason() : "expired";
          clearLocalSession(reason, true, true);
        }
      } finally {
        if (active) setAuthReady(true);
      }
    };

    restoreSession();

    return () => {
      active = false;
      window.removeEventListener("nkj:session-expired", handleApiSessionExpired);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Only direct human input updates the shared activity timestamp. API polling,
  // realtime refreshes, focus changes and visibility changes are intentionally
  // excluded. All open tabs read the same timestamp, so activity in one tab
  // keeps the authenticated browser session alive in the others.
  useEffect(() => {
    if (!user) return undefined;

    let lastLocalWrite = 0;
    const recordActivity = () => {
      const now = Date.now();
      const sharedLastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
      if (now - Math.max(sharedLastActivity, lastLocalWrite) >= 750) {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
        lastLocalWrite = now;
      }

      const sharedLastSync = Number(localStorage.getItem(LAST_SERVER_ACTIVITY_SYNC_KEY) || 0);
      if (now - sharedLastSync >= ACTIVITY_SYNC_INTERVAL_MS) {
        // Set before the request to avoid duplicate activity writes from
        // multiple tabs reacting to the same burst of input.
        localStorage.setItem(LAST_SERVER_ACTIVITY_SYNC_KEY, String(now));
        request("/auth/activity", { method: "POST" }).catch(() => {
          // A 401 dispatches nkj:session-expired centrally. Transient network
          // failures do not turn an otherwise active session into a logout.
        });
      }
    };

    const activityEvents = ["pointermove", "pointerdown", "keydown", "click", "wheel", "scroll", "touchstart"];
    activityEvents.forEach((name) => window.addEventListener(name, recordActivity, { passive: true }));

    const checkInactivity = () => {
      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
      if (lastActivity > 0 && Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
        void logout("inactivity");
      }
    };
    const timer = window.setInterval(checkInactivity, 1000);

    return () => {
      window.clearInterval(timer);
      activityEvents.forEach((name) => window.removeEventListener(name, recordActivity));
    };
  }, [user]);

  // Revalidate the server-side session while the app is open. This heartbeat
  // does not call /auth/activity and therefore never extends the idle timeout.
  useEffect(() => {
    if (!user) return undefined;

    const validateSession = async () => {
      try {
        await request("/auth/session", { suppressSessionExpiry: true });
      } catch (error) {
        if (isUnauthorizedSessionError(error)) {
          await logout(readLogoutReason());
        }
      }
    };

    const timer = window.setInterval(validateSession, 15_000);
    const onFocus = () => validateSession();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") validateSession();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user]);

  async function begin(username, password) {
    const result = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setPending(result.challengeId);
    return result;
  }

  async function verify(code) {
    if (!pending) throw new Error("Your login challenge expired. Please sign in again.");
    const result = await request("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ challengeId: pending, code }),
    });
    localStorage.setItem("nkj_token", result.token);
    localStorage.setItem("nkj_user", result.username);
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    localStorage.removeItem(LAST_SERVER_ACTIVITY_SYNC_KEY);
    logoutInProgressRef.current = false;
    setUser(result.username);
    setPending("");
    setAuthReady(true);
    return result;
  }

  async function logout(reason = "manual") {
    if (logoutInProgressRef.current) return;
    logoutInProgressRef.current = true;

    // Capture the token in the request before broadcasting/removing it from
    // localStorage. Other tabs receive the logout event and clear their state.
    let invalidationRequest = null;
    if (localStorage.getItem("nkj_token")) {
      invalidationRequest = request("/auth/logout", {
        method: "POST",
        suppressSessionExpiry: true,
      }).catch(() => {
        // Local/browser logout still completes if the server is unavailable.
      });
    }

    try {
      if (invalidationRequest) await invalidationRequest;
    } finally {
      clearLocalSession(reason, true, true);
      logoutInProgressRef.current = false;
    }
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin: Boolean(user), authReady, begin, verify, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
