export type BookingAvailabilityMode = "REVIEW_REQUIRED" | "REMOTE";

export type PatientBookingClinic = {
  id: number;
  label: string;
};

export type PatientBookingService = {
  id: number;
  clinicId: number;
  label: string;
};

export type PatientBookingAddress = {
  id: number;
  label: string;
  shortAddress: string;
};

export type PatientBookingSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
};

export type BookingAvailability = {
  mode: BookingAvailabilityMode;
  clinics: PatientBookingClinic[];
  services: PatientBookingService[];
  addresses: PatientBookingAddress[];
  slots: PatientBookingSlot[];
  notice: string;
};

export function resolveBookingAvailabilityMode(featureEnabled: boolean, hasPatientSession: boolean): BookingAvailabilityMode {
  return featureEnabled && hasPatientSession ? "REMOTE" : "REVIEW_REQUIRED";
}

export function createReviewRequiredAvailability(): BookingAvailability {
  return {
    mode: "REVIEW_REQUIRED",
    clinics: [],
    services: [],
    addresses: [],
    slots: [],
    notice: "سيُرسل اختيارك كتفضيل للعيادة. لا تتوفر فترات أو عناوين حساب مؤكدة حتى الآن.",
  };
}
