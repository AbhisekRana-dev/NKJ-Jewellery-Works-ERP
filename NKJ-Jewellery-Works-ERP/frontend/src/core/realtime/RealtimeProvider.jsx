import React, { useEffect } from "react";
import { useAuth } from "../auth/AuthProvider";
import { connectRealtimeStream } from "./realtime";

export default function RealtimeProvider({ children }) {
  const { isAdmin, authReady } = useAuth();

  useEffect(() => {
    if (!authReady || !isAdmin) return undefined;
    return connectRealtimeStream();
  }, [authReady, isAdmin]);

  return children;
}
