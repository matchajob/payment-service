const DATABASE_URL_ENV = 'DATABASE_URL';

export const readDatabaseUrl = (): string => {
  const url = process.env[DATABASE_URL_ENV];
  if (url === undefined) throw new Error(`${DATABASE_URL_ENV} is not set`);
  return url;
};