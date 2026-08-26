export type VisitStatus =
  | "REQUESTED"
  | "ASSIGNED"
  | "EN_ROUTE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type VisitFilter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED";

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

export type ClinicNotification = {
  id: string;
  category: "APPOINTMENT" | "MEDICAL";
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  source?: "LOCAL" | "REMOTE";
};

export const visitStatusLabel: Record<VisitStatus, string> = {
  REQUESTED: "طلب جديد",
  ASSIGNED: "تم التعيين",
  EN_ROUTE: "في الطريق",
  IN_PROGRESS: "قيد التنفيذ",
  COMPLETED: "مكتملة",
  CANCELLED: "ملغاة",
};

export const filterLabel: Record<VisitFilter, string> = {
  ALL: "الكل",
  ACTIVE: "النشطة",
  COMPLETED: "المكتملة",
  CANCELLED: "الملغاة",
};

const nextStatus: Record<VisitStatus, VisitStatus | null> = {
  REQUESTED: "ASSIGNED",
  ASSIGNED: "EN_ROUTE",
  EN_ROUTE: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED: null,
  CANCELLED: null,
};

export function createVisit(clinicName: string, serviceName: string, now = Date.now()): ClinicVisit {
  const clinic = clinicName.trim();
  const service = serviceName.trim();

  if (!clinic || !service) {
    throw new Error("أدخل اسم العيادة ونوع الخدمة أولاً.");
  }

  return {
    id: `V-${now.toString(36).toUpperCase()}`,
    clinicName: clinic,
    serviceName: service,
    status: "REQUESTED",
    createdAt: now,
  };
}

export function advanceVisit(visit: ClinicVisit): ClinicVisit {
  const next = nextStatus[visit.status];
  return next ? { ...visit, status: next } : visit;
}

export function getNextStatus(visit: ClinicVisit): VisitStatus | null {
  return nextStatus[visit.status];
}

export function getVisitSummary(visits: ClinicVisit[]) {
  return {
    total: visits.length,
    active: visits.filter((visit) => !["COMPLETED", "CANCELLED"].includes(visit.status)).length,
    inProgress: visits.filter((visit) => visit.status === "IN_PROGRESS").length,
    completed: visits.filter((visit) => visit.status === "COMPLETED").length,
  };
}

export function filterAndSearchVisits(
  visits: ClinicVisit[],
  filter: VisitFilter,
  query: string,
): ClinicVisit[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("ar-SA");

  return visits
    .filter((visit) => {
      if (filter === "ACTIVE") return !["COMPLETED", "CANCELLED"].includes(visit.status);
      if (filter !== "ALL") return visit.status === filter;
      return true;
    })
    .filter((visit) => {
      if (!normalizedQuery) return true;
      return [visit.clinicName, visit.serviceName].some((value) =>
        value.toLocaleLowerCase("ar-SA").includes(normalizedQuery),
      );
    })
    .sort((left, right) => right.createdAt - left.createdAt);
}

export function createAppointmentNotification(visit: ClinicVisit): ClinicNotification {
  return {
    id: `N-${visit.id}`,
    category: "APPOINTMENT",
    title: "تم تسجيل زيارة جديدة",
    body: `${visit.serviceName} لدى ${visit.clinicName} بانتظار المتابعة.`,
    createdAt: visit.createdAt,
    read: false,
  };
}

export function createMedicalNotification(now = Date.now()): ClinicNotification {
  return {
    id: `M-${now.toString(36).toUpperCase()}`,
    category: "MEDICAL",
    title: "تذكير صحي",
    body: "احتفظ بسجل زياراتك محدثاً، وتواصل مع العيادة عند أي تغيير في موعدك.",
    createdAt: now,
    read: false,
  };
}
