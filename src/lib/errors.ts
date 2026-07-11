/**
 * Domain error with an Arabic, user-facing message and a machine code.
 * Server actions translate these into form results; unexpected errors are
 * never surfaced verbatim to users.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = "APP_ERROR", status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "العنصر غير موجود") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "لا تملك صلاحية لتنفيذ هذا الإجراء") {
    super(message, "FORBIDDEN", 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = "يوجد تعارض في البيانات") {
    super(message, "CONFLICT", 409);
  }
}

export class ValidationError extends AppError {
  constructor(message = "البيانات المدخلة غير صحيحة") {
    super(message, "VALIDATION", 422);
  }
}
