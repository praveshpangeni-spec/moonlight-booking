import { redirect } from "next/navigation";

// The original single-business booking page lived at "/". It now redirects to
// Moonlight's per-business page so existing links and QR codes keep working.
export default function Home() {
  redirect("/b/moonlight");
}
