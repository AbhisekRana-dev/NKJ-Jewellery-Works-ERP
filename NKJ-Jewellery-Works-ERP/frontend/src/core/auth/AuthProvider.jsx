import React, { createContext, useContext, useEffect, useState } from "react";
import { request } from "../api/client";

const AuthContext = createContext(null);

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const ACTIVITY_WRITE_THROTTLE_MS = 2_000;
const SERVER_ACTIVITY_THROTTLE_MS = 15_000;
const ACTIVITY_STORAGE_PREFIX = "nkj.session.last-user-activity.v1";
const LOGOUT_SIGNAL_KEY = "nkj.session.logout.v1";
const IDLE_EXPIRATION_MESSAGE = "Your session expired due to inactivity. Please log in again.";
const EXPIRATION_REASON_KEY = "nkj.session.expiration-reason";

function getActivityStorageKey(username) {
  const scope = String(username || "").trim().toLowerCase();
  return `${ACTIVITY_STORAGE_PREFIX}:${encodeURIComponent(scope || "guest")}`;
}

function readActivityTimestamp(key) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeLogoutSignal(username, reason) {
  try {
    localStorage.setItem(LOGOUT_SIGNAL_KEY, JSON.stringify({
      username: String(username || ""),
      reason,
      at: Date.now(),
    }));
  } catch {
    // The current tab still clears its own credentials if storage is unavailable.
  }
}

function expirationReasonFromStorage() {
  try {
    return sessionStorage.getItem(EXPIRATION_REASON_KEY) || "expired";
  } catch {
    return "expired";
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState("");
  const [pending, setPending] = useState("");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    const clearSession = (reason = "expired", shouldRedirect = false) => {
      try {
        localStorage.removeItem("nkj_token");
        localStorage.removeItem("nkj_user");
      } catch {
        // State is still cleared even when browser storage is unavailable.
      }

      if (active) {
        setUser("");
        setPending("");
        setAuthReady(true);
      }

      if (reason === "idle") {
        try { sessionStorage.setItem(EXPIRATION_REASON_KEY, "idle"); } catch {}
      }

      if (shouldRedirect && typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.replace(reason === "idle" ? "/login?reason=idle" : "/login");
      }
    };

    const onSessionExpired = (event) => {
      const reason = event?.detail?.reason || expirationReasonFromStorage();
      clearSession(reason, true);
    };

    const onStorage = (event) => {
      if (event.key === LOGOUT_SIGNAL_KEY && event.newValue) {
        let signal = null;
        try { signal = JSON.parse(event.newValue); } catch {}
        if (signal?.reason) {
          clearSession(signal.reason, true);
          return;
        }
      }

      // A manual logout or a 401 in another tab clears the shared token.
      if (event.key === "nkj_token" && event.newValue === null) {
        clearSession("manual", true);
      }
    };

    window.addEventListener("nkj:session-expired", onSessionExpired);
    window.addEventListener("storage", onStorage);

    const token = localStorage.getItem("nkj_token");
    if (!token) {
      localStorage.removeItem("nkj_user");
      setAuthReady(true);
    } else {
      request("/auth/session")
        .then((result) => {
          if (!active) return;
          const username = result?.username || "";
          setUser(username);
          if (username) {
            localStorage.setItem("nkj_user", username);
          } else {
            clearSession("expired", true);
          }
        })
        .catch(() => {
          if (!active) return;
          clearSession("expired", Boolean(token));
        })
        .finally(() => {
          if (active) setAuthReady(true);
        });
    }

    return () => {
      active = false;
      window.removeEventListener("nkj:session-expired", onSessionExpired);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // The session endpoint is a validity check only. It intentionally does not
  // refresh the server's idle timestamp; only the interaction handler below does.
  useEffect(() => {
    if (!user) return undefined;

    const validateSession = () => {
      request("/auth/session").catch(() => {
        // A 401 is handled centrally by the shared API client.
      });
    };

    const timer = window.setInterval(validateSession, 15_000);
    const onFocus = () => checkIdle();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkIdle();
    };

    function checkIdle() {
      const lastActivityAt = readActivityTimestamp(activityKey) || fallbackLastActivityAt;
      if (Date.now() - lastActivityAt >= IDLE_TIMEOUT_MS) {
        void expireForInactivity();
      }
    }

    const activityKey = getActivityStorageKey(user);
    let fallbackLastActivityAt = readActivityTimestamp(activityKey);
    if (!fallbackLastActivityAt) {
      fallbackLastActivityAt = Date.now();
      try { localStorage.setItem(activityKey, String(fallbackLastActivityAt)); } catch {}
    }

    let lastServerActivityRequestAt = 0;
    let expiring = false;

    async function expireForInactivity() {
      if (expiring) return;
      expiring = true;

      try { sessionStorage.setItem(EXPIRATION_REASON_KEY, "idle"); } catch {}
      writeLogoutSignal(user, "idle");

      // Best-effort server revocation. Even if the network is unavailable,
      // removing the browser token and server-side idle enforcement protect the session.
      try {
        await request("/auth/logout", { method: "POST" });
      } catch {
        // The local logout must still complete.
      } finally {
        try {
          localStorage.removeItem("nkj_token");
          localStorage.removeItem("nkj_user");
        } catch {}
        setUser("");
        setPending("");
        setAuthReady(true);
        if (window.location.pathname !== "/login") {
          window.location.replace("/login?reason=idle");
        }
      }
    }

    function recordUserActivity() {
      if (expiring) return;
      const now = Date.now();
      const previous = readActivityTimestamp(activityKey) || fallbackLastActivityAt;

      // Do not let an interaction that occurs after the ten-minute limit revive
      // an already expired session, including after a suspended browser tab resumes.
      if (now - previous >= IDLE_TIMEOUT_MS) {
        void expireForInactivity();
        return;
      }

      if (now - previous < ACTIVITY_WRITE_THROTTLE_MS) return;

      fallbackLastActivityAt = now;
      try { localStorage.setItem(activityKey, String(now)); } catch {}

      if (now - lastServerActivityRequestAt >= SERVER_ACTIVITY_THROTTLE_MS) {
        lastServerActivityRequestAt = now;
        request("/auth/activity", { method: "POST" }).catch(() => {
          // A server-side expiry is handled centrally as a 401.
        });
      }
    }

    const activityEvents = [
      "pointerdown",
      "pointermove",
      "mousedown",
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ];
    const listenerOptions = { passive: true };
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, recordUserActivity, listenerOptions);
    });

    const idleTimer = window.setInterval(checkIdle, 1_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(idleTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, recordUserActivity, listenerOptions);
      });
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
    localStorage.setItem(getActivityStorageKey(result.username), String(Date.now()));
    try { sessionStorage.removeItem(EXPIRATION_REASON_KEY); } catch {}
    setUser(result.username);
    setPending("");
    setAuthReady(true);
    return result;
  }

  async function logout() {
    const currentUser = user || localStorage.getItem("nkj_user") || "";
    writeLogoutSignal(currentUser, "manual");
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {
      // Browser authorization is cleared even if the server cannot be reached.
    } finally {
      localStorage.removeItem("nkj_token");
      localStorage.removeItem("nkj_user");
      setUser("");
      setPending("");
      setAuthReady(true);
      window.dispatchEvent(new CustomEvent("nkj:session-expired", {
        detail: { reason: "manual" },
      }));
    }
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin: Boolean(user), authReady, begin, verify, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
