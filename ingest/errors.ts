let error = false;
const warnings: string[] = [];

export const logError = (where: string, message: string | Error) => {
  if (!error) {
    console.log("\n** Errors **\n")
  }
  console.log(`${where}: ${message instanceof Error ? message.message : message}`);
  error = true;
}

export const logWarning = (where: string, message: string | Error) => {
  const prefix = where ? `${where}: ` : "";
  warnings.push(`${prefix}${message instanceof Error ? message.message : message}`);
}

export const printWarnings = () => {
  if (warnings.length > 0) {
    console.log("\n** Warnings **\n");
    warnings.forEach((warning) => console.log(warning));
  }
}

export async function catchErrors<T>(
  where: string, func: () => Promise<T>
): Promise<T | undefined> {
  try {
    return await func();
  } catch (err) {
    logError(where, err instanceof Error ? err : new Error(String(err)));
  }
}

export function catchErrorsSync<T>(where: string, func: () => T): T | undefined {
  try {
    return func();
  } catch (err) {
    logError(where, err instanceof Error ? err : new Error(String(err)));
  }
}

export const hasError = () => error;

export const resetError = () => {
  error = false;
}
