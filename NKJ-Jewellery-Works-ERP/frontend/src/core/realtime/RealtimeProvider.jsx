import React, { useEffect } from "react";
import { useAuth } from "../auth/AuthProvider";
import { connectRealtimeStream } from "./realtime";

export default function RealtimeProvider({ children }) {
  const { isAdmin, authReady } = useAuth();

  useEffect(() => connectRealtimeStream(true), []);

  useEffect(() => {
    if (!authReady || !isAdmin) return undefined;
    return connectRealtimeStream(false);
  }, [authReady, isAdmin]);

  return children;
}
