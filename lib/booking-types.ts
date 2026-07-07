import type { ServiceType } from "@/lib/database.types";

// Shared types for the public booking flow (moved out of app/page.tsx so the
// flow can be mounted per business at /b/[slug]).

export type Lang = "en" | "ne";

export interface BookingData {
  service: ServiceType | null;
  date: Date | null;
  startTime: string | null;      // business-tz HH:mm — stored in DB
  dbDate: string | null;         // business-tz yyyy-MM-dd — stored in DB
  localStartTime: string | null; // User's local HH:mm — display only
  userTz: string;                // User's detected/selected timezone
  durationMinutes: number;
  amount: number;
  name: string;
  phone: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  gender: string;
  currentLocation: string;
  country: string;
  notes: string;
}

export const INITIAL_BOOKING: BookingData = {
  service: null,
  date: null,
  startTime: null,
  dbDate: null,
  localStartTime: null,
  userTz: "UTC",
  durationMinutes: 60,
  amount: 0,
  name: "",
  phone: "",
  birthDate: "",
  birthTime: "",
  birthPlace: "",
  gender: "",
  currentLocation: "",
  country: "Nepal",
  notes: "",
};
