"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

export function TrackNotFound() {
  useEffect(() => {
    track("not_found");
  }, []);
  return null;
}
