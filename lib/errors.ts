export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message)
    this.name = "AppError"
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "No autorizado") {
    super(401, message, "UNAUTHORIZED")
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acceso denegado") {
    super(403, message, "FORBIDDEN")
  }
}

export class NotFoundError extends AppError {
  constructor(message = "No encontrado") {
    super(404, message, "NOT_FOUND")
  }
}

export class ValidationError extends AppError {
  constructor(message = "Error de validación") {
    super(400, message, "VALIDATION_ERROR")
  }
}

export function handleError(error: unknown) {
  if (error instanceof AppError) {
    return { error: { message: error.message, code: error.code } }
  }

  if (error instanceof Error) {
    console.error("Unhandled error:", error.message)
    return { error: { message: "Error interno del servidor", code: "INTERNAL_ERROR" } }
  }

  console.error("Unknown error:", error)
  return { error: { message: "Error desconocido", code: "UNKNOWN_ERROR" } }
}
