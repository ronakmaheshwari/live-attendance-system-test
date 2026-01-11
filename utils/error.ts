const Defaul_Message: Record<number,string> = {
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Resource not found",
  409: "Conflict",
  422: "Unprocessable entity",
  500: "Internal server error",
}

class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(
    statusCode: number,
    message?: string,
    isOperational: boolean = true,
    stack: string = ""
  ) {
    super(message || Defaul_Message[statusCode] || "Error");

    this.statusCode = statusCode;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message?: string) {
    return new ApiError(400, message);
  }

  static unauthorized(message?: string) {
    return new ApiError(401, message);
  }

  static forbidden(message?: string) {
    return new ApiError(403, message);
  }

  static notFound(message?: string) {
    return new ApiError(404, message);
  }

  static conflict(message?: string) {
    return new ApiError(409, message);
  }

  static unprocessableEntity(message?: string) {
    return new ApiError(422, message);
  }

  static internal(message?: string) {
    return new ApiError(500, message);
  }
}

export default ApiError;