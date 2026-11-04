/**
 * Jerarquía de errores de dominio y aplicación para mapeo HTTP uniforme.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409);
    this.name = "ConflictError";
  }
}

export class ValidationError extends DomainError {
  constructor(message = "Error de validación en la solicitud.", details?: unknown) {
    super(message, 400, details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "No autenticado") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "No tienes permiso para realizar esta acción") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}
