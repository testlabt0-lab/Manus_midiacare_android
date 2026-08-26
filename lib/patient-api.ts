import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

import { createReviewRequiredAvailability, type BookingAvailability, type PatientBookingAddress, type PatientBookingClinic, type PatientBookingService } from "@/lib/booking-availability";
import type { ClinicNotification, ClinicVisit, VisitStatus } from "@/lib/medicare-domain";

WebBrowser.maybeCompleteAuthSession();

const DEFAULT_API_ORIGIN = "https://medicarepro-myvdwgyk.manus.space";
const SESSION_KEY = "medicare-pro-patient-session-v1";
const MOBILE_CLIENT_ID = "medicare-pro-mobile-android";
const REDIRECT_URI = "medicarepro://auth";
export const PATIENT_BOOKING_AVAILABILITY_ENABLED = false;

type TrpcEnvelope<T> = {
  result?: { data?: { json?: T } };
  error?: { json?: { message?: string } };
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

export type RemoteVisit = {
  id: number;
  reference: string;
  clinicName: string;
  serviceName: string;
  districtLabel: string;
  scheduledStart: string | Date;
  state: string;
  createdAt: string | Date;
};

type RemoteNotification = {
  id: number;
  visitId: number | null;
  kind: "VISIT_CREATED" | "VISIT_STATUS_CHANGED";
  title: string;
  body: string;
  readAt: string | Date | null;
  createdAt: string | Date;
};

export type PatientSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type PatientReport = {
  visitId: number;
  summary: string;
  finalizedAt?: string | Date;
};

export type PatientInvoice = {
  visitId: number;
  invoiceNo: string;
  totalHalalas: number;
  status: "DUE" | "PAID";
};

type RemoteBookingAvailability = {
  clinics: PatientBookingClinic[];
  services: PatientBookingService[];
  addresses: PatientBookingAddress[];
};

function resolveApiOrigin(configuredOrigin = process.env.EXPO_PUBLIC_PATIENT_API_ORIGIN) {
  const candidate = configuredOrigin?.trim();
  if (!candidate) return DEFAULT_API_ORIGIN;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" && parsed.pathname === "/" && !parsed.search && !parsed.hash
      ? parsed.origin
      : DEFAULT_API_ORIGIN;
  } catch {
    return DEFAULT_API_ORIGIN;
  }
}

export const PATIENT_API_ORIGIN = resolveApiOrigin();

function toTimestamp(value: string | Date) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function toSession(payload: TokenResponse): PatientSession {
  if (!payload.access_token || !payload.refresh_token || !payload.expires_in) {
    throw new Error(payload.error || "تعذر إتمام جلسة المريض.");
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
}

function mapRemoteVisit(visit: RemoteVisit): ClinicVisit {
  const statuses: VisitStatus[] = ["REQUESTED", "ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
  const status = statuses.includes(visit.state as VisitStatus) ? (visit.state as VisitStatus) : "REQUESTED";
  return {
    id: visit.reference || `WEB-${visit.id}`,
    remoteId: visit.id,
    reference: visit.reference,
    clinicName: visit.clinicName,
    serviceName: visit.serviceName,
    districtLabel: visit.districtLabel,
    scheduledStart: toTimestamp(visit.scheduledStart),
    status,
    createdAt: toTimestamp(visit.createdAt),
    source: "REMOTE",
  };
}

function mapRemoteNotification(notification: RemoteNotification): ClinicNotification {
  return {
    id: `WEB-N-${notification.id}`,
    visitRemoteId: notification.visitId ?? undefined,
    category: notification.kind === "VISIT_CREATED" ? "APPOINTMENT" : "MEDICAL",
    title: notification.title,
    body: notification.body,
    createdAt: toTimestamp(notification.createdAt),
    read: Boolean(notification.readAt),
    source: "REMOTE",
  };
}

async function persistSession(session: PatientSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

async function callTrpc<T>(path: string, token: string, input?: Record<string, unknown>, method: "GET" | "POST" = "GET") {
  const encoded = encodeURIComponent(JSON.stringify({ json: input ?? null }));
  const url = method === "GET"
    ? `${PATIENT_API_ORIGIN}/api/trpc/${path}?input=${encoded}`
    : `${PATIENT_API_ORIGIN}/api/trpc/${path}`;
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
    body: method === "POST" ? JSON.stringify({ json: input ?? null }) : undefined,
  });
  const payload = (await response.json()) as TrpcEnvelope<T>;
  if (!response.ok || payload.error || payload.result?.data?.json === undefined) {
    throw new Error(payload.error?.json?.message || "تعذر الاتصال بخدمة MediCare Pro.");
  }
  return payload.result.data.json;
}

export async function loadPatientSession(): Promise<PatientSession | null> {
  try {
    const value = await SecureStore.getItemAsync(SESSION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as PatientSession;
    return parsed.accessToken && parsed.refreshToken ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearPatientSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
}

export async function startPatientLogin(): Promise<PatientSession> {
  const request = new AuthSession.AuthRequest({
    clientId: MOBILE_CLIENT_ID,
    responseType: AuthSession.ResponseType.Code,
    redirectUri: REDIRECT_URI,
    usePKCE: true,
    extraParams: { web_origin: PATIENT_API_ORIGIN },
  });
  const result = await request.promptAsync({ authorizationEndpoint: `${PATIENT_API_ORIGIN}/api/mobile-auth/start` });
  if (result.type !== "success" || !result.params.code || !request.codeVerifier) {
    throw new Error(result.type === "cancel" ? "تم إلغاء تسجيل الدخول." : "لم يكتمل تسجيل الدخول الآمن.");
  }

  const response = await fetch(`${PATIENT_API_ORIGIN}/api/mobile-auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: result.params.code, code_verifier: request.codeVerifier, client_id: MOBILE_CLIENT_ID }),
  });
  const payload = (await response.json()) as TokenResponse;
  if (!response.ok) throw new Error(payload.error || "تعذر إتمام تسجيل الدخول.");
  const session = toSession(payload);
  await persistSession(session);
  return session;
}

export async function renewPatientSession(session: PatientSession): Promise<PatientSession> {
  if (session.expiresAt > Date.now() + 60_000) return session;
  const response = await fetch(`${PATIENT_API_ORIGIN}/api/mobile-auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: MOBILE_CLIENT_ID, refresh_token: session.refreshToken }),
  });
  const payload = (await response.json()) as TokenResponse;
  if (!response.ok) {
    await clearPatientSession();
    throw new Error(payload.error || "انتهت جلسة الحساب. سجّل الدخول من جديد.");
  }
  const renewed = toSession(payload);
  await persistSession(renewed);
  return renewed;
}

export async function listRemoteVisits(session: PatientSession) {
  const visits = await callTrpc<RemoteVisit[]>("visits.listMine", session.accessToken);
  return visits.map(mapRemoteVisit);
}

export async function getRemoteBookingAvailability(session: PatientSession): Promise<BookingAvailability> {
  if (!PATIENT_BOOKING_AVAILABILITY_ENABLED) return createReviewRequiredAvailability();
  const options = await callTrpc<RemoteBookingAvailability>("patientBooking.options", session.accessToken);
  return {
    mode: "REMOTE",
    clinics: options.clinics,
    services: options.services,
    addresses: options.addresses,
    slots: [],
    notice: "تعرض الخيارات الحالية من حسابك الصحي. يتحقق الخادم من الفترة النهائية عند التأكيد.",
  };
}

export async function getRemoteVisit(session: PatientSession, visitId: number) {
  const visit = await callTrpc<RemoteVisit>("visits.getMine", session.accessToken, { visitId });
  return mapRemoteVisit(visit);
}

export async function createRemoteVisit(session: PatientSession, input: { clinicName: string; serviceName: string; districtLabel: string; scheduledStart: string }) {
  const scheduled = new Date(input.scheduledStart);
  if (!Number.isFinite(scheduled.getTime())) throw new Error("أدخل موعداً صالحاً بصيغة YYYY-MM-DDTHH:MM.");
  const visit = await callTrpc<RemoteVisit>("visits.create", session.accessToken, {
    clinicName: input.clinicName.trim(),
    serviceName: input.serviceName.trim(),
    districtLabel: input.districtLabel.trim(),
    scheduledStart: scheduled.toISOString(),
  }, "POST");
  return mapRemoteVisit(visit);
}

export async function listRemoteNotifications(session: PatientSession) {
  const notifications = await callTrpc<RemoteNotification[]>("patientNotifications.listMine", session.accessToken);
  return notifications.map(mapRemoteNotification);
}

export async function markRemoteNotificationRead(session: PatientSession, notificationId: string) {
  const id = Number(notificationId.replace("WEB-N-", ""));
  if (!Number.isInteger(id) || id <= 0) return;
  await callTrpc<{ success: true }>("patientNotifications.markRead", session.accessToken, { notificationId: id }, "POST");
}

export async function registerRemotePushToken(session: PatientSession, expoPushToken: string) {
  await callTrpc<{ success: true }>("patientDevices.register", session.accessToken, { expoPushToken, platform: "expo" }, "POST");
}

export async function getRemoteReport(session: PatientSession, visitId: number) {
  return callTrpc<PatientReport>("outputs.reportMine", session.accessToken, { visitId });
}

export async function getRemoteInvoice(session: PatientSession, visitId: number) {
  return callTrpc<PatientInvoice>("outputs.invoiceMine", session.accessToken, { visitId });
}

export async function recordRemoteDemoPayment(session: PatientSession, visitId: number) {
  return callTrpc<PatientInvoice>("outputs.recordDemoPayment", session.accessToken, { visitId }, "POST");
}
