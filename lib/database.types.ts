export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ServiceType =
  | "birth_chart"
  | "career_finance"
  | "love_relationship"
  | "compatibility"
  | "yearly_forecast"
  | "general";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type PaymentStatus = "unpaid" | "paid";
export type PaymentMethod = "esewa" | "khalti" | "cash" | "bank_transfer";
export type LeadSource = "whatsapp" | "facebook" | "instagram" | "tiktok" | "web" | "referral";

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          name_nepali: string | null;
          phone: string;
          birth_date: string;
          birth_time: string | null;
          birth_place: string;
          gender: string | null;
          source: LeadSource;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["clients"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
      };
      availability: {
        Row: {
          id: string;
          date: string;
          start_time: string;
          end_time: string;
          is_blocked: boolean;
          note: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["availability"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["availability"]["Insert"]>;
      };
      bookings: {
        Row: {
          id: string;
          client_id: string;
          service_type: ServiceType;
          date: string;
          start_time: string;
          duration_minutes: number;
          status: BookingStatus;
          amount: number;
          payment_status: PaymentStatus;
          payment_method: PaymentMethod | null;
          payment_reference: string | null;
          source: LeadSource;
          client_notes: string | null;
          admin_notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["bookings"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
      };
    };
  };
}

export const SERVICE_LABELS: Record<ServiceType, { en: string; ne: string; duration: number; price: number }> = {
  general: { en: "General Consultation", ne: "सामान्य परामर्श", duration: 30, price: 1500 },
  birth_chart: { en: "Detailed Consultation", ne: "विस्तृत परामर्श", duration: 60, price: 2500 },
  compatibility: { en: "Kundali Milan", ne: "कुण्डली मिलान", duration: 60, price: 2500 },
  // kept for DB compatibility, not shown in UI
  career_finance: { en: "Career & Finance", ne: "करियर र आर्थिक", duration: 45, price: 1500 },
  love_relationship: { en: "Love & Relationship", ne: "प्रेम र सम्बन्ध", duration: 45, price: 1500 },
  yearly_forecast: { en: "Yearly Forecast", ne: "वार्षिक भविष्यफल", duration: 60, price: 2000 },
};
