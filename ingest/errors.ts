let error = false;

export const logError = (where: string, message: string | Error) => {
  if (!error) {
    console.log("\n** Errors **\n")
  }
  console.log(`${where}: ${message instanceof Error ? message.message : message}`);
  error = true;
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
