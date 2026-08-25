export type PatientSessionFailureKind = "EXPIRED" | "TEMPORARY";

export class PatientSessionFailure extends Error {
  constructor(public readonly kind: PatientSessionFailureKind, message: string) {
    super(message);
    this.name = "PatientSessionFailure";
  }
}

export function isPatientSessionExpiredFailure(error: unknown) {
  return error instanceof PatientSessionFailure && error.kind === "EXPIRED";
}
