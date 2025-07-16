export const logger = (message: string, ...optionalParams: unknown[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `%c ${message}`,
      "background: #222; color: #a65cf0",
      ...optionalParams
    );
  }
};
