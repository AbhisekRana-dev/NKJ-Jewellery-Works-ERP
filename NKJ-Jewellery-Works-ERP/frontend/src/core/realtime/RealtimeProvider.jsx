import React, { useEffect } from "react";
import { useAuth } from "../auth/AuthProvider";
import { connectRealtimeStream } from "./realtime";

export default function RealtimeProvider({ children }) {
  const { isAdmin, authReady } = useAuth();

  useEffect(() => {
    if (!authReady) return undefined;
    return connectRealtimeStream(!isAdmin);
  }, [authReady, isAdmin]);

  return children;
}
