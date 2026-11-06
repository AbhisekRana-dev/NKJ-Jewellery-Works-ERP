import React, { createContext, useContext, useEffect, useState } from "react";
import { request } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState("");
  const [pending, setPending] = useState("");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;
    const clearSession = () => {
      localStorage.removeItem("nkj_token");
      localStorage.removeItem("nkj_user");
      if (active) {
        setUser("");
        setPending("");
        setAuthReady(true);
      }
    };
    window.addEventListener("nkj:session-expired", clearSession);

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
      window.removeEventListener("nkj:session-expired", clearSession);
    };
  }, []);


  // Revalidate the owner session periodically. If the backend expires or revokes
  // the token, the API client dispatches nkj:session-expired and protected UI hides.
  useEffect(() => {
    if (!user) return undefined;
    const timer = window.setInterval(() => {
      request("/auth/session").catch(() => {
        // A 401 is handled centrally by the shared API client.
      });
    }, 60_000);
    return () => window.clearInterval(timer);
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
    setUser(result.username);
    setPending("");
    setAuthReady(true);
    return result;
  }

  async function logout() {
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
      window.dispatchEvent(new Event("nkj:session-expired"));
    }
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin: Boolean(user), authReady, begin, verify, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
