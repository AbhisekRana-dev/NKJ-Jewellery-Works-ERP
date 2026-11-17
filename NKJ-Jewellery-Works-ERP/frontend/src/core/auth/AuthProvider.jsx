import React, { createContext, useContext, useEffect, useState } from "react";
import { request } from "../api/client";

const AuthContext = createContext(null);

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
const SERVER_ACTIVITY_MIN_INTERVAL_MS = 30 * 1000;
const LOCAL_ACTIVITY_MIN_INTERVAL_MS = 500;
const SESSION_ACTIVITY_PREFIX = "nkj.session.activity.";
const SESSION_LOGOUT_PREFIX = "nkj.session.logout.";

function sessionStorageKey(prefix, username) {
  return prefix + encodeURIComponent(String(username || "").trim());
}

function parseLogoutEvent(value) {
  try {
    const parsed = JSON.parse(value || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState("");
  const [pending, setPending] = useState("");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    const clearSession = (event) => {
      const detail = event?.detail || {};
      const username = detail.username || localStorage.getItem("nkj_user") || "";
      const reason = detail.reason || "session";
      const remote = detail.remote === true;

      if (!remote && username) {
        try {
          localStorage.setItem(
            sessionStorageKey(SESSION_LOGOUT_PREFIX, username),
            JSON.stringify({ username, reason, at: Date.now() }),
          );
        } catch {
          // The current tab still clears authentication when storage is unavailable.
        }
      }

      localStorage.removeItem("nkj_token");
      localStorage.removeItem("nkj_user");
      if (active) {
        setUser("");
        setPending("");
        setAuthReady(true);
      }

      if (reason === "inactivity" && window.location.pathname !== "/login") {
        window.location.replace("/login?reason=inactivity");
      }
    };

    const onStorage = (event) => {
      if (!event.key || !event.newValue) return;
      if (event.key.startsWith(SESSION_LOGOUT_PREFIX)) {
        const payload = parseLogoutEvent(event.newValue);
        if (payload) {
          clearSession({
            detail: {
              ...payload,
              reason: payload.reason || "session",
              remote: true,
            },
          });
        }
      }
    };

    window.addEventListener("nkj:session-expired", clearSession);
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
          if (username) localStorage.setItem("nkj_user", username);
          else clearSession();
        })
        .catch(() => {
          if (active) {
            localStorage.removeItem("nkj_token");
            localStorage.removeItem("nkj_user");
            setUser("");
          }
        })
        .finally(() => {
          if (active) setAuthReady(true);
        });
    }

    return () => {
      active = false;
      window.removeEventListener("nkj:session-expired", clearSession);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Activity is only recorded from real user input. API polling, data refreshes,
  // focus changes and background requests never extend the server-side idle clock.
  useEffect(() => {
    if (!user) return undefined;

    const activityKey = sessionStorageKey(SESSION_ACTIVITY_PREFIX, user);
    let lastActivityAt = Number(localStorage.getItem(activityKey));
    if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) {
      lastActivityAt = Date.now();
      try { localStorage.setItem(activityKey, String(lastActivityAt)); } catch {}
    }

    let lastLocalEventAt = 0;
    let lastServerActivityAt = 0;
    let expiryTimer = null;
    let logoutStarted = false;

    const validateSession = () => {
      request("/auth/session").catch(() => {
        // A 401 is handled by the shared API client and synchronized to other tabs.
      });
    };

    const sendServerActivity = () => {
      const now = Date.now();
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      if (now - lastServerActivityAt < SERVER_ACTIVITY_MIN_INTERVAL_MS) return;
      lastServerActivityAt = now;
      request("/auth/activity", { method: "POST" }).catch(() => {
        // A network failure does not falsely extend the server-side session.
      });
    };

    const expireForInactivity = () => {
      if (logoutStarted) return;
      logoutStarted = true;

      // Start revocation before clearing the browser token. The API client reads
      // the bearer token synchronously when request() is called.
      request("/auth/logout", {
        method: "POST",
        suppressSessionExpiry: true,
      }).catch(() => {});

      window.dispatchEvent(new CustomEvent("nkj:session-expired", {
        detail: { username: user, reason: "inactivity" },
      }));
    };

    const scheduleExpiry = () => {
      if (expiryTimer !== null) window.clearTimeout(expiryTimer);
      const remaining = Math.max(0, INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityAt));
      expiryTimer = window.setTimeout(expireForInactivity, remaining + 20);
    };

    const acceptActivity = (timestamp, broadcast) => {
      if (!Number.isFinite(timestamp) || timestamp <= lastActivityAt) return;
      lastActivityAt = timestamp;
      if (broadcast) {
        try { localStorage.setItem(activityKey, String(timestamp)); } catch {}
      }
      scheduleExpiry();
      sendServerActivity();
    };

    const onUserActivity = () => {
      const now = Date.now();
      if (now - lastLocalEventAt < LOCAL_ACTIVITY_MIN_INTERVAL_MS) return;
      lastLocalEventAt = now;
      acceptActivity(now, true);
    };

    const onStorage = (event) => {
      if (event.key !== activityKey || !event.newValue) return;
      const timestamp = Number(event.newValue);
      acceptActivity(timestamp, false);
    };

    const onFocus = () => {
      if (Date.now() - lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
        expireForInactivity();
      } else {
        validateSession();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      onFocus();
    };

    const activityEvents = [
      "pointerdown",
      "pointermove",
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
      "touchmove",
      "wheel",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, onUserActivity, { passive: true });
    });
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    scheduleExpiry();

    return () => {
      if (expiryTimer !== null) window.clearTimeout(expiryTimer);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onUserActivity);
      });
      window.removeEventListener("storage", onStorage);
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
    const username = result.username || "";
    localStorage.setItem("nkj_token", result.token);
    localStorage.setItem("nkj_user", username);
    if (username) {
      localStorage.setItem(sessionStorageKey(SESSION_ACTIVITY_PREFIX, username), String(Date.now()));
      localStorage.removeItem(sessionStorageKey(SESSION_LOGOUT_PREFIX, username));
    }
    setUser(username);
    setPending("");
    setAuthReady(true);
    return result;
  }

  async function logout() {
    try {
      await request("/auth/logout", {
        method: "POST",
        suppressSessionExpiry: true,
      });
    } catch {
      // Browser authorization is still cleared if the server cannot be reached.
    } finally {
      window.dispatchEvent(new CustomEvent("nkj:session-expired", {
        detail: { username: user, reason: "manual" },
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
