import { useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_BASE_URL || "/api";
const CLIENT_ID_KEY = "nkj-realtime-client-id";
const subscribers = new Set();

function createClientId() {
  try {
    let id = window.sessionStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `nkj-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return `nkj-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

const CLIENT_ID = createClientId();

export function getRealtimeClientId() {
  return CLIENT_ID;
}

export function subscribeRealtime(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function emitRealtime(event) {
  for (const listener of subscribers) {
    try {
      listener(event);
    } catch (error) {
      console.error("ERP real-time subscriber failed:", error);
    }
  }
}


/**
 * Re-fetches only the active page's data when a remote mutation affects one of
 * its topics. The originating tab is skipped because its mutation handler is
 * already responsible for updating its own local form/list state.
 */
export function useRealtimeRefresh(load, topics = ["*"]) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const topicKey = Array.isArray(topics) ? topics.join("|") : String(topics || "*");

  useEffect(() => {
    let timer = null;
    const acceptedTopics = topicKey.split("|").filter(Boolean);
    const unsubscribe = subscribeRealtime((event) => {
      if (event?.originClientId && event.originClientId === CLIENT_ID) return;

      const changedTopics = Array.isArray(event?.topics) && event.topics.length
        ? event.topics
        : ["*"];
      const shouldRefresh = acceptedTopics.includes("*")
        || changedTopics.includes("*")
        || changedTopics.some((topic) => acceptedTopics.includes(topic));

      if (!shouldRefresh || document.visibilityState === "hidden") return;

      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        Promise.resolve(loadRef.current()).catch((error) => {
          console.error("ERP real-time data refresh failed:", error);
        });
      }, 160);
    });

    return () => {
      if (timer) window.clearTimeout(timer);
      unsubscribe();
    };
  }, [topicKey]);
}

/**
 * Authenticated fetch-based SSE client. Fetch is used instead of native
 * EventSource so the existing bearer token can be sent in an Authorization
 * header rather than exposed in a URL query parameter.
 */
export function connectRealtimeStream(publicOnly = false) {
  let stopped = false;
  let activeController = null;
  let retryTimer = null;
  let retryDelay = 1000;
  let connectedOnce = false;

  const scheduleReconnect = () => {
    if (stopped || retryTimer) return;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      connect();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  };

  const processFrame = (frame) => {
    let eventName = "message";
    const dataLines = [];

    for (const rawLine of frame.split(/\r?\n/)) {
      if (rawLine.startsWith("event:")) eventName = rawLine.slice(6).trim();
      if (rawLine.startsWith("data:")) dataLines.push(rawLine.slice(5).trimStart());
    }

    if (eventName !== "data-changed" || dataLines.length === 0) return;
    try {
      const event = JSON.parse(dataLines.join("\n"));
      emitRealtime(event);
    } catch (error) {
      console.error("Could not parse ERP real-time event:", error);
    }
  };

  const connect = async () => {
    if (stopped) return;
    const token = window.localStorage.getItem("nkj_token");
    if (!publicOnly && !token) return;

    const controller = new AbortController();
    activeController = controller;

    try {
      const headers = { Accept: "text/event-stream" };
      if (!publicOnly) headers.Authorization = `Bearer ${token}`;
      const endpoint = publicOnly ? "/events/public" : "/events";
      const response = await fetch(`${API}${endpoint}`, {
        method: "GET",
        headers,
        cache: "no-store",
        signal: controller.signal,
      });

      if (!publicOnly && response.status === 401) {
        window.dispatchEvent(new Event("nkj:session-expired"));
        return;
      }
      if (!response.ok || !response.body) {
        throw new Error(`Real-time connection failed (${response.status}).`);
      }

      retryDelay = 1000;
      if (connectedOnce) {
        emitRealtime({ topics: publicOnly ? ["rates"] : ["*"], reason: "reconnected", originClientId: "" });
      }
      connectedOnce = true;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!stopped && !controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          processFrame(frame);
          boundary = buffer.indexOf("\n\n");
        }
      }

      if (!stopped && !controller.signal.aborted) {
        throw new Error("Real-time connection closed.");
      }
    } catch (error) {
      if (!stopped && error?.name !== "AbortError") {
        scheduleReconnect();
      }
    }
  };

  const onOnline = () => {
    if (stopped) return;
    if (retryTimer) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
    activeController?.abort();
    connect();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      emitRealtime({ topics: publicOnly ? ["rates"] : ["*"], reason: "tab-visible", originClientId: "" });
    }
  };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibilityChange);
  connect();

  return () => {
    stopped = true;
    if (retryTimer) window.clearTimeout(retryTimer);
    activeController?.abort();
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
