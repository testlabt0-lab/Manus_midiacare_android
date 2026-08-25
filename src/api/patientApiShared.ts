import type { ClinicVisit, VisitStatus } from "../domain/clinic";
import type { ClinicNotification } from "../domain/notifications";

export const API_ORIGIN = "https://medicarepro-myvdwgyk.manus.space";
export const MOBILE_REDIRECT_URI = "medicarepro://auth";
export const MOBILE_CLIENT_ID = "medicare-pro-mobile-android";

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

export type RemotePatientNotification = {
  id: number;
  visitId: number | null;
  kind: "VISIT_CREATED" | "VISIT_STATUS_CHANGED";
  title: string;
  body: string;
  readAt: string | Date | null;
  createdAt: string | Date;
};

const serverStates: VisitStatus[] = ["REQUESTED", "ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

function toTimestamp(value: string | Date) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

export function mapRemoteVisit(visit: RemoteVisit): ClinicVisit {
  const status = serverStates.includes(visit.state as VisitStatus) ? visit.state as VisitStatus : "REQUESTED";
  return {
    id: visit.reference || `WEB-${visit.id}`,
    clinicName: visit.clinicName,
    serviceName: visit.serviceName,
    status,
    createdAt: toTimestamp(visit.createdAt),
    scheduledStart: toTimestamp(visit.scheduledStart),
    districtLabel: visit.districtLabel,
    source: "REMOTE",
  };
}

export function mapRemotePatientNotification(notification: RemotePatientNotification): ClinicNotification {
  return {
    id: `WEB-N-${notification.id}`,
    visitId: notification.visitId ? `WEB-V-${notification.visitId}` : undefined,
    category: notification.kind === "VISIT_CREATED" ? "APPOINTMENT" : "MEDICAL",
    title: notification.title,
    body: notification.body,
    createdAt: toTimestamp(notification.createdAt),
    read: Boolean(notification.readAt),
  };
}
