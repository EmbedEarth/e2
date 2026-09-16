export class E2Error extends Error {
  constructor(message: string, readonly code = "E2_ERROR") {
    super(message);
    this.name = "E2Error";
  }
}

export class InvalidCellError extends E2Error {
  constructor(message: string) {
    super(message, "INVALID_E2_CELL");
    this.name = "InvalidCellError";
  }
}
