import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { recordAuthenticatedActivity, request } from "../api/client";

const AuthContext = createContext(null);
const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
// A development-only override lets the Playwright smoke suite exercise expiry
// quickly. Production builds always use the required ten-minute timeout.
const testIdleTimeout = typeof window !== "undefined"
  ? Number(window.__NKJ_TEST_IDLE_TIMEOUT_MS)
  : 0;
const IDLE_TIMEOUT_MS = import.meta.env.DEV && Number.isFinite(testIdleTimeout) && testIdleTimeout > 0
  ? testIdleTimeout
  : DEFAULT_IDLE_TIMEOUT_MS;
const ACTIVITY_SYNC_KEY = "nkj.auth.activity.v1";
const LOGOUT_SYNC_KEY = "nkj.auth.logout.v1";
const INACTIVITY_MESSAGE = "Your session expired due to inactivity. Please log in again.";
const GENERIC_SESSION_MESSAGE = "Your session expired. Please log in again.";
const SERVER_ACTIVITY_THROTTLE_MS = 1000;
const LOCAL_ACTIVITY_THROTTLE_MS = 500;

function readJson(value) {
  try { return JSON.parse(value || "null"); } catch { return null; }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [pending, setPending] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const userRef = useRef("");
  const idleTimerRef = useRef(null);
  const lastActivityAtRef = useRef(0);
  const lastActivitySentAtRef = useRef(0);
  const lastLocalActivityAtRef = useRef(0);
  const lastLogoutEventAtRef = useRef(0);
  const logoutInProgressRef = useRef(false);

  const applyLocalLogout = useCallback((reason = "expired", message = "") => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    userRef.current = "";
    setUser("");
    setPending("");
    setAuthReady(true);
    localStorage.removeItem("nkj_token");
    localStorage.removeItem("nkj_user");

    if (reason === "inactivity") {
      navigate("/login", { replace: true, state: { sessionExpiredMessage: message || INACTIVITY_MESSAGE } });
    } else if (message) {
      navigate("/login", { replace: true, state: { sessionExpiredMessage: message } });
    }
  }, [navigate]);

  const broadcastLogout = useCallback((reason, username) => {
    const payload = {
      at: Date.now(),
      reason,
      username: String(username || ""),
    };
    try { localStorage.setItem(LOGOUT_SYNC_KEY, JSON.stringify(payload)); } catch {}
  }, []);

  const logout = useCallback(async ({ reason = "manual" } = {}) => {
    if (logoutInProgressRef.current) return;
    logoutInProgressRef.current = true;
    const username = userRef.current || localStorage.getItem("nkj_user") || "";

    try {
      await request("/auth/logout", {
        method: "POST",
        suppressSessionExpiry: true,
        skipActivityBarrier: true,
      });
    } catch {
      // Clear local access even when the network is unavailable. The server
      // also rejects idle sessions on every protected endpoint.
    } finally {
      broadcastLogout(reason, username);
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      userRef.current = "";
      localStorage.removeItem("nkj_token");
      localStorage.removeItem("nkj_user");
      setUser("");
      setPending("");
      setAuthReady(true);
      if (reason === "inactivity") {
        navigate("/login", { replace: true, state: { sessionExpiredMessage: INACTIVITY_MESSAGE } });
      }
      logoutInProgressRef.current = false;
    }
  }, [broadcastLogout, navigate]);

  useEffect(() => {
    let active = true;

    const handleSessionExpired = (event) => {
      const username = userRef.current || localStorage.getItem("nkj_user") || "";
      const reason = event?.detail?.reason || "expired";
      const message = event?.detail?.message || GENERIC_SESSION_MESSAGE;
      broadcastLogout(reason, username);
      applyLocalLogout(reason, message);
    };

    const handleStorage = (event) => {
      if (event.key === LOGOUT_SYNC_KEY && event.newValue) {
        const payload = readJson(event.newValue);
        if (!payload || !payload.at || payload.at <= lastLogoutEventAtRef.current) return;
        const activeUser = userRef.current || localStorage.getItem("nkj_user") || "";
        if (payload.username && activeUser
            && payload.username.toLowerCase() !== activeUser.toLowerCase()) return;
        lastLogoutEventAtRef.current = payload.at;
        applyLocalLogout(
          payload.reason || "manual",
          payload.reason === "inactivity" ? INACTIVITY_MESSAGE : "",
        );
        return;
      }

      if (event.key === "nkj_token" && event.newValue === null && userRef.current) {
        const payload = readJson(localStorage.getItem(LOGOUT_SYNC_KEY));
        applyLocalLogout(
          payload?.reason || "expired",
          payload?.reason === "inactivity" ? INACTIVITY_MESSAGE : GENERIC_SESSION_MESSAGE,
        );
      }
    };

    window.addEventListener("nkj:session-expired", handleSessionExpired);
    window.addEventListener("storage", handleStorage);

    const token = localStorage.getItem("nkj_token");
    if (!token) {
      localStorage.removeItem("nkj_user");
      setAuthReady(true);
    } else {
      request("/auth/session")
        .then((result) => {
          if (!active) return;
          const username = result?.username || "";
          userRef.current = username;
          setUser(username);
          if (username) {
            localStorage.setItem("nkj_user", username);
            const serverActivityAt = Number(result?.lastActivityAt);
            lastActivityAtRef.current = Number.isFinite(serverActivityAt) && serverActivityAt > 0
              ? serverActivityAt
              : Date.now();
          } else {
            applyLocalLogout("expired", GENERIC_SESSION_MESSAGE);
          }
        })
        .catch(() => {
          if (active) {
            applyLocalLogout(
              "expired",
              GENERIC_SESSION_MESSAGE,
            );
          }
        })
        .finally(() => {
          if (active) setAuthReady(true);
        });
    }

    return () => {
      active = false;
      window.removeEventListener("nkj:session-expired", handleSessionExpired);
      window.removeEventListener("storage", handleStorage);
    };
  }, [applyLocalLogout, broadcastLogout]);

  // Background API polling does not renew the session. Only genuine human
  // input events update the idle deadline and the server's activity timestamp.
  useEffect(() => {
    if (!user) return undefined;
    const owner = user;
    let disposed = false;

    const scheduleIdleLogout = (timestamp) => {
      lastActivityAtRef.current = timestamp;
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      const remaining = Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - timestamp));
      idleTimerRef.current = window.setTimeout(() => {
        if (disposed) return;
        if (Date.now() - lastActivityAtRef.current >= IDLE_TIMEOUT_MS) {
          logout({ reason: "inactivity" });
        } else {
          scheduleIdleLogout(lastActivityAtRef.current);
        }
      }, remaining);
    };

    const syncActivityAcrossTabs = (timestamp) => {
      try {
        localStorage.setItem(ACTIVITY_SYNC_KEY, JSON.stringify({
          username: owner,
          at: timestamp,
        }));
      } catch {
        // Local expiry continues to work if browser storage is blocked.
      }
    };

    const markActivity = (timestamp = Date.now()) => {
      if (disposed || userRef.current !== owner) return;
      if (Date.now() - lastActivityAtRef.current >= IDLE_TIMEOUT_MS) {
        logout({ reason: "inactivity" });
        return;
      }

      scheduleIdleLogout(timestamp);
      syncActivityAcrossTabs(timestamp);

      if (timestamp - lastActivitySentAtRef.current >= SERVER_ACTIVITY_THROTTLE_MS) {
        lastActivitySentAtRef.current = timestamp;
        recordAuthenticatedActivity().catch(() => {
          // A 401 is handled centrally and synchronized to the other tabs.
        });
      }
    };

    const onUserInput = (event) => {
      const now = Date.now();
      if ((event.type === "mousemove" || event.type === "scroll" || event.type === "wheel")
          && now - lastLocalActivityAtRef.current < LOCAL_ACTIVITY_THROTTLE_MS) return;
      lastLocalActivityAtRef.current = now;
      markActivity(now);
    };

    const onStorage = (event) => {
      if (event.key !== ACTIVITY_SYNC_KEY || !event.newValue) return;
      const payload = readJson(event.newValue);
      if (!payload || payload.username?.toLowerCase() !== owner.toLowerCase()) return;
      if (!Number.isFinite(payload.at) || payload.at <= lastActivityAtRef.current) return;
      scheduleIdleLogout(payload.at);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible"
          && Date.now() - lastActivityAtRef.current >= IDLE_TIMEOUT_MS) {
        logout({ reason: "inactivity" });
      }
    };

    const now = lastActivityAtRef.current || Date.now();
    lastActivitySentAtRef.current = now;
    lastLocalActivityAtRef.current = now;
    scheduleIdleLogout(now);

    const activityEvents = ["pointerdown", "click", "keydown", "mousemove", "wheel", "scroll", "touchstart"];
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, onUserInput, true);
    }
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, onUserInput, true);
      }
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user, logout]);

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
    const now = Date.now();
    localStorage.setItem("nkj_token", result.token);
    localStorage.setItem("nkj_user", result.username);
    userRef.current = result.username;
    lastActivityAtRef.current = now;
    lastActivitySentAtRef.current = now;
    setUser(result.username);
    setPending("");
    setAuthReady(true);
    return result;
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin: Boolean(user), authReady, begin, verify, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
