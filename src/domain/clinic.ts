export type VisitStatus = "REQUESTED" | "ASSIGNED" | "CONFIRMED" | "EN_ROUTE" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type PatientVisitFilter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export const patientVisitFilterLabel: Record<PatientVisitFilter, string> = {
  ALL: "الكل",
  ACTIVE: "النشطة",
  COMPLETED: "المكتملة",
  CANCELLED: "الملغاة",
};

export type ClinicVisit = {
  id: string;
  clinicName: string;
  serviceName: string;
  status: VisitStatus;
  createdAt: number;
  scheduledStart?: number;
  districtLabel?: string;
  source?: "LOCAL" | "REMOTE";
};

export const visitStatusLabel: Record<VisitStatus, string> = {
  REQUESTED: "طلب جديد",
  ASSIGNED: "تم التعيين",
  CONFIRMED: "تم التأكيد",
  EN_ROUTE: "في الطريق",
  ARRIVED: "تم الوصول",
  IN_PROGRESS: "قيد التنفيذ",
  COMPLETED: "مكتملة",
  CANCELLED: "ملغاة",
};

export const nextVisitStatus: Record<VisitStatus, VisitStatus | null> = {
  REQUESTED: "ASSIGNED",
  ASSIGNED: "EN_ROUTE",
  CONFIRMED: "EN_ROUTE",
  EN_ROUTE: "IN_PROGRESS",
  ARRIVED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED: null,
  CANCELLED: null,
};

export function createLocalVisit(input: Pick<ClinicVisit, "clinicName" | "serviceName">, now = Date.now()): ClinicVisit {
  const normalizedClinic = input.clinicName.trim();
  const normalizedService = input.serviceName.trim();

  if (!normalizedClinic || !normalizedService) {
    throw new Error("Clinic and service names are required");
  }

  return {
    id: `V-${now.toString(36).toUpperCase()}`,
    clinicName: normalizedClinic,
    serviceName: normalizedService,
    status: "REQUESTED",
    createdAt: now,
    source: "LOCAL",
  };
}

export function advanceVisit(visit: ClinicVisit): ClinicVisit {
  const nextStatus = nextVisitStatus[visit.status];
  return nextStatus ? { ...visit, status: nextStatus } : visit;
}

export function getVisitSummary(visits: ClinicVisit[]) {
  return {
    total: visits.length,
    active: visits.filter(visit => visit.status !== "COMPLETED").length,
    inProgress: visits.filter(visit => visit.status === "IN_PROGRESS").length,
    completed: visits.filter(visit => visit.status === "COMPLETED").length,
  };
}

export function getUpcomingVisit(visits: ClinicVisit[], now = Date.now()): ClinicVisit | null {
  return visits
    .filter(visit => typeof visit.scheduledStart === "number" && Number.isFinite(visit.scheduledStart) && visit.scheduledStart >= now && visit.status !== "COMPLETED" && visit.status !== "CANCELLED")
    .sort((left, right) => (left.scheduledStart ?? 0) - (right.scheduledStart ?? 0))[0] ?? null;
}

export function filterPatientVisits(visits: ClinicVisit[], filter: PatientVisitFilter): ClinicVisit[] {
  if (filter === "ALL") return visits;
  if (filter === "ACTIVE") return visits.filter(visit => visit.status !== "COMPLETED" && visit.status !== "CANCELLED");
  return visits.filter(visit => visit.status === filter);
}

export function searchPatientVisits(visits: ClinicVisit[], query: string): ClinicVisit[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("ar-SA");
  if (!normalizedQuery) return visits;
  return visits.filter(visit => [visit.clinicName, visit.serviceName].some(value => value.toLocaleLowerCase("ar-SA").includes(normalizedQuery)));
}

export function sortPatientVisits(visits: ClinicVisit[], now = Date.now()): ClinicVisit[] {
  const isFutureScheduled = (visit: ClinicVisit) => typeof visit.scheduledStart === "number" && Number.isFinite(visit.scheduledStart) && visit.scheduledStart >= now;
  return [...visits].sort((left, right) => {
    const leftIsUpcoming = isFutureScheduled(left);
    const rightIsUpcoming = isFutureScheduled(right);
    if (leftIsUpcoming !== rightIsUpcoming) return leftIsUpcoming ? -1 : 1;
    if (leftIsUpcoming && rightIsUpcoming) return (left.scheduledStart as number) - (right.scheduledStart as number);
    return right.createdAt - left.createdAt;
  });
}
