import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { API_ORIGIN, MOBILE_CLIENT_ID, MOBILE_REDIRECT_URI, mapRemotePatientNotification, mapRemoteVisit, type RemotePatientNotification, type RemoteVisit } from "./patientApiShared";

export { API_ORIGIN, MOBILE_CLIENT_ID, MOBILE_REDIRECT_URI, mapRemotePatientNotification, mapRemoteVisit } from "./patientApiShared";

WebBrowser.maybeCompleteAuthSession();

const SESSION_KEY = "medicare_pro_patient_session";

type TrpcEnvelope<T> = {
  result?: { data?: { json?: T } };
  error?: { json?: { message?: string } };
};

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };

export type PatientSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

function errorMessage(payload: TrpcEnvelope<unknown>, fallback: string) {
  return payload.error?.json?.message || fallback;
}

function toSession(payload: TokenResponse): PatientSession {
  if (!payload.access_token || !payload.refresh_token || !payload.expires_in) {
    throw new Error(payload.error || "تعذر تجديد جلسة الحساب.");
  }
  return { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresAt: Date.now() + payload.expires_in * 1000 };
}

async function persistPatientSession(session: PatientSession) {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  } catch {
    // The web preview may not expose secure storage; the in-memory session remains usable.
  }
}

async function callTrpc<T>(path: string, token: string, input?: Record<string, unknown>, method: "GET" | "POST" = "GET") {
  const encoded = encodeURIComponent(JSON.stringify({ json: input ?? null }));
  const url = method === "GET" ? `${API_ORIGIN}/api/trpc/${path}?input=${encoded}` : `${API_ORIGIN}/api/trpc/${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "POST" ? JSON.stringify({ json: input ?? null }) : undefined,
  });
  const payload = await response.json() as TrpcEnvelope<T>;
  if (!response.ok || payload.error || payload.result?.data?.json === undefined) {
    throw new Error(errorMessage(payload, "تعذر الاتصال بخدمة MediCare Pro."));
  }
  return payload.result.data.json;
}

export async function loadPatientSession(): Promise<PatientSession | null> {
  try {
    const encoded = await SecureStore.getItemAsync(SESSION_KEY);
    if (!encoded) return null;
    const session = JSON.parse(encoded) as PatientSession;
    return session.accessToken && session.refreshToken ? session : null;
  } catch {
    return null;
  }
}

export async function clearPatientSession() {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // On web previews secure storage can be unavailable; local session state is still cleared.
  }
}

export async function startPatientLogin(): Promise<PatientSession> {
  const request = new AuthSession.AuthRequest({
    clientId: MOBILE_CLIENT_ID,
    responseType: AuthSession.ResponseType.Code,
    redirectUri: MOBILE_REDIRECT_URI,
    usePKCE: true,
    extraParams: { web_origin: API_ORIGIN },
  });
  const result = await request.promptAsync({ authorizationEndpoint: `${API_ORIGIN}/api/mobile-auth/start` });
  if (result.type !== "success" || !result.params.code || !request.codeVerifier) {
    throw new Error(result.type === "cancel" ? "تم إلغاء تسجيل الدخول." : "لم يكتمل تسجيل الدخول الآمن.");
  }
  const response = await fetch(`${API_ORIGIN}/api/mobile-auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: result.params.code, code_verifier: request.codeVerifier, client_id: MOBILE_CLIENT_ID }),
  });
  const payload = await response.json() as TokenResponse;
  if (!response.ok) throw new Error(payload.error || "تعذر إتمام تسجيل الدخول.");
  const session = toSession(payload);
  await persistPatientSession(session);
  return session;
}

export async function ensurePatientSession(session: PatientSession): Promise<PatientSession> {
  if (session.expiresAt > Date.now() + 60_000) return session;
  const response = await fetch(`${API_ORIGIN}/api/mobile-auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: MOBILE_CLIENT_ID, refresh_token: session.refreshToken }),
  });
  const payload = await response.json() as TokenResponse;
  if (!response.ok) {
    await clearPatientSession();
    throw new Error(payload.error || "انتهت جلسة الحساب. سجّل الدخول من جديد.");
  }
  const renewed = toSession(payload);
  await persistPatientSession(renewed);
  return renewed;
}

export async function listPatientVisits(session: PatientSession) {
  const records = await callTrpc<RemoteVisit[]>("visits.listMine", session.accessToken);
  return records.map(mapRemoteVisit);
}

export async function createPatientVisit(session: PatientSession, input: { clinicName: string; serviceName: string; districtLabel: string; scheduledStart: string }) {
  const scheduledAt = new Date(input.scheduledStart);
  if (!Number.isFinite(scheduledAt.getTime())) throw new Error("أدخل موعداً صالحاً بصيغة التاريخ والوقت.");
  const record = await callTrpc<RemoteVisit>("visits.create", session.accessToken, {
    clinicName: input.clinicName.trim(),
    serviceName: input.serviceName.trim(),
    districtLabel: input.districtLabel.trim(),
    scheduledStart: scheduledAt.toISOString(),
  }, "POST");
  return mapRemoteVisit(record);
}

export async function listPatientNotifications(session: PatientSession) {
  const records = await callTrpc<RemotePatientNotification[]>("patientNotifications.listMine", session.accessToken);
  return records.map(mapRemotePatientNotification);
}

export async function markPatientNotificationRead(session: PatientSession, notificationId: string) {
  const id = Number(notificationId.replace("WEB-N-", ""));
  if (!Number.isInteger(id) || id <= 0) return false;
  await callTrpc<{ success: true }>("patientNotifications.markRead", session.accessToken, { notificationId: id }, "POST");
  return true;
}
