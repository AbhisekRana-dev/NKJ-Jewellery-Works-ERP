import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { request } from "../api/client";

const AuthContext = createContext(null);
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const ACTIVITY_KEY = "nkj_last_activity";
const EXPIRY_MESSAGE = "Your session has expired due to 30 minutes of inactivity. Please log in again.";

function readLastActivity() {
  const value = Number(localStorage.getItem(ACTIVITY_KEY));
  return Number.isFinite(value) && value > 0 ? value : Date.now();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState("");
  const [pending, setPending] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const pendingRef = useRef("");
  const lastActivityRef = useRef(0);
  const lastServerActivityRef = useRef(0);
  const logoutStartedRef = useRef(false);

  const clearLocalSession = (message = "") => {
    if (message) sessionStorage.setItem("nkj_login_notice", message);
    localStorage.removeItem("nkj_token");
    localStorage.removeItem("nkj_user");
    localStorage.removeItem(ACTIVITY_KEY);
    setUser("");
    setPending("");
    pendingRef.current = "";
    setAuthReady(true);
    window.dispatchEvent(new Event("nkj:session-expired"));
  };

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("nkj_token");
    const lastActivity = readLastActivity();
    lastActivityRef.current = lastActivity;

    const onSessionExpired = () => {
      if (!active) return;
      setUser("");
      setPending("");
      setAuthReady(true);
    };
    const onStorage = (event) => {
      if (event.key === "nkj_token" && !event.newValue) onSessionExpired();
      if (event.key === ACTIVITY_KEY && event.newValue) {
        const timestamp = Number(event.newValue);
        if (Number.isFinite(timestamp)) lastActivityRef.current = Math.max(lastActivityRef.current, timestamp);
      }
    };
    window.addEventListener("nkj:session-expired", onSessionExpired);
    window.addEventListener("storage", onStorage);

    if (!token) {
      localStorage.removeItem("nkj_user");
      setAuthReady(true);
    } else if (Date.now() - lastActivity >= IDLE_LIMIT_MS) {
      sessionStorage.setItem("nkj_login_notice", EXPIRY_MESSAGE);
      request("/auth/logout", {
        method: "POST",
        headers: { "X-Logout-Reason": "INACTIVITY_TIMEOUT" },
        suppressSessionExpiry: true,
      }).catch(() => {}).finally(() => {
        if (active) clearLocalSession();
      });
    } else {
      request("/auth/session")
        .then((result) => {
          if (!active) return;
          const username = result?.username || "";
          setUser(username);
          if (username) localStorage.setItem("nkj_user", username);
          else clearLocalSession();
        })
        .catch(() => {
          localStorage.removeItem("nkj_token");
          localStorage.removeItem("nkj_user");
          if (active) setUser("");
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

  useEffect(() => {
    if (!user) return undefined;
    logoutStartedRef.current = false;
    lastActivityRef.current = readLastActivity();
    lastServerActivityRef.current = 0;

    const publishActivity = (force = false) => {
      const now = Date.now();
      lastActivityRef.current = now;
      const previousStored = Number(localStorage.getItem(ACTIVITY_KEY) || 0);
      if (force || now - previousStored >= 1000) localStorage.setItem(ACTIVITY_KEY, String(now));

      if (force || now - lastServerActivityRef.current >= 15_000) {
        lastServerActivityRef.current = now;
        request("/auth/activity", { method: "POST", suppressSessionExpiry: false }).catch(() => {
          // A 401 is handled by the shared API client and clears all tabs.
        });
      }
    };

    const onUserActivity = () => publishActivity(false);
    const onStorageActivity = (event) => {
      if (event.key === ACTIVITY_KEY && event.newValue) {
        const timestamp = Number(event.newValue);
        if (Number.isFinite(timestamp)) lastActivityRef.current = Math.max(lastActivityRef.current, timestamp);
      }
    };

    const events = ["pointerdown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach((name) => window.addEventListener(name, onUserActivity, { passive: true }));
    window.addEventListener("storage", onStorageActivity);

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_LIMIT_MS && !logoutStartedRef.current) {
        logoutStartedRef.current = true;
        sessionStorage.setItem("nkj_login_notice", EXPIRY_MESSAGE);
        request("/auth/logout", {
          method: "POST",
          headers: { "X-Logout-Reason": "INACTIVITY_TIMEOUT" },
          suppressSessionExpiry: true,
        }).catch(() => {}).finally(() => clearLocalSession());
      }
    }, 1000);

    const heartbeat = window.setInterval(() => {
      request("/auth/session").catch(() => {});
    }, 15_000);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(heartbeat);
      events.forEach((name) => window.removeEventListener(name, onUserActivity));
      window.removeEventListener("storage", onStorageActivity);
    };
  }, [user]);

  async function begin(username, password) {
    const result = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    pendingRef.current = result.challengeId;
    setPending(result.challengeId);
    return result;
  }

  async function verify(code) {
    const challengeId = pendingRef.current || pending;
    if (!challengeId) throw new Error("Your login challenge expired. Please sign in again.");
    const result = await request("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ challengeId, code }),
    });
    localStorage.setItem("nkj_token", result.token);
    localStorage.setItem("nkj_user", result.username);
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    lastActivityRef.current = Date.now();
    lastServerActivityRef.current = Date.now();
    logoutStartedRef.current = false;
    setUser(result.username);
    setPending("");
    pendingRef.current = "";
    setAuthReady(true);
    return result;
  }

  async function logout(reason = "MANUAL_LOGOUT") {
    try {
      await request("/auth/logout", {
        method: "POST",
        headers: { "X-Logout-Reason": reason },
        suppressSessionExpiry: true,
      });
    } catch {
      // Always clear the local credential even if the server is unreachable.
    } finally {
      clearLocalSession();
    }
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin: Boolean(user), authReady, begin, verify, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
