/**
 * Maps Twilio WhatsApp error codes & error messages to clear, human-understandable failure reasons for school administrators.
 */
export function getTwilioFailureReason(
  errorCode?: string | number | null,
  errorMessage?: string | null
): string {
  const code = errorCode !== undefined && errorCode !== null ? String(errorCode).trim() : "";
  const msg = errorMessage ? errorMessage.trim() : "";
  const lowerMsg = msg.toLowerCase();

  // 1. Specific Twilio WhatsApp Error Codes & Messages
  if (
    code === "63024" ||
    msg.includes("63024") ||
    lowerMsg.includes("invalid message recipient") ||
    lowerMsg.includes("not a valid whatsapp user")
  ) {
    return "Invalid Mobile Number — Recipient number is wrong or not registered on WhatsApp.";
  }

  if (
    code === "63007" ||
    msg.includes("63007") ||
    lowerMsg.includes("sandbox") ||
    lowerMsg.includes("opted in")
  ) {
    return "Recipient Not Opted In — Handset has not joined or opted into WhatsApp sandbox channel.";
  }

  if (
    code === "63016" ||
    msg.includes("63016") ||
    lowerMsg.includes("template")
  ) {
    return "Template Parameter Error — Message template variables mismatch or invalid format.";
  }

  if (
    code === "63025" ||
    msg.includes("63025") ||
    lowerMsg.includes("inactive") ||
    lowerMsg.includes("blocked")
  ) {
    return "Number Inactive / Blocked — Recipient number is inactive or blocking messages on WhatsApp.";
  }

  if (
    code === "63003" ||
    msg.includes("63003") ||
    lowerMsg.includes("channel")
  ) {
    return "WhatsApp Channel Configuration Error — Check Twilio sender account settings.";
  }

  if (
    code === "63020" ||
    msg.includes("63020")
  ) {
    return "Daily Limit Reached — Twilio WhatsApp daily messaging quota exceeded.";
  }

  if (
    code === "21211" ||
    code === "21614" ||
    code === "30005" ||
    code === "30006" ||
    lowerMsg.includes("invalid phone number")
  ) {
    return "Invalid Phone Number — Phone number is incorrect, unallocated, or a landline number.";
  }

  if (
    code === "30003" ||
    code === "30008" ||
    lowerMsg.includes("unreachable")
  ) {
    return "Unreachable Mobile Number — Handset powered off or out of cellular coverage area.";
  }

  if (
    code === "30007" ||
    lowerMsg.includes("filtered")
  ) {
    return "Message Blocked — Blocked by telecom carrier or recipient preferences.";
  }

  // 2. Return Twilio error message if it's descriptive and not a raw stack trace
  if (msg && !msg.startsWith("Error Code") && !msg.includes("http")) {
    return msg;
  }

  // 3. Fallback with error code
  if (code) {
    return `Invalid Mobile Number / Undelivered — Number incorrect or not on WhatsApp (Twilio Code ${code}).`;
  }

  // 4. General fallback
  return "Invalid Mobile Number — Recipient number is wrong or not registered on WhatsApp.";
}
