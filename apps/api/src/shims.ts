// Minimal module shims used by TypeScript builds.
//
// We intentionally avoid adding extra @types/* packages to keep lockfile churn low,
// and because these modules are used in a limited way in this repo.
// If you later want stronger typing, replace these with proper types packages.

declare module 'sql.js' {
  const initSqlJs: any;
  export default initSqlJs;
}

declare module 'bcryptjs' {
  const bcrypt: any;
  export default bcrypt;
  export const hash: any;
  export const compare: any;
  export const genSalt: any;
}
