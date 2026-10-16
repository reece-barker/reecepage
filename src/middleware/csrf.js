// CSRF protection for the two forms that change something (contact, cookie settings). There are no logins, so this
// uses the signed double submit pattern from csrf-csrf: a random value in an httpOnly cookie plus a signed copy in the
// form. Another site can make a browser post to us, but it cant read our cookie to build a matching token.
import { doubleCsrf } from "csrf-csrf";

export function createCsrf(config) {
  // __Host- cookies must be secure and path=/, browsers reject them on plain http, so only in production
  const cookieName = config.isProduction ? "__Host-rp.csrf" : "rp.csrf";
  const { doubleCsrfProtection, generateCsrfToken, invalidCsrfTokenError } = doubleCsrf({
    getSecret: () => config.appSecret,
    // No sessions exist, so the token is bound to the random cookie only, which is what makes it double submit
    getSessionIdentifier: () => "",
    cookieName,
    cookieOptions: { sameSite: "strict", secure: config.isProduction, httpOnly: true, path: "/" },
    getCsrfTokenFromRequest: (req) => req.body?._csrf || req.get("x-csrf-token")
  });

  return {
    protect: doubleCsrfProtection,
    /** Adds res.locals.csrfToken for the templates. Only used on pages that show a form, so other pages set no cookie */
    provideToken: (req, res, next) => {
      // Once per request. A second call would set a second cookie and the first form on the page would stop working
      // (this happened on /cookies, where the banner and the settings form both need a token)
      if (!res.locals.csrfToken) res.locals.csrfToken = generateCsrfToken(req, res);
      next();
    },
    isCsrfError: (error) => error === invalidCsrfTokenError || error?.code === "EBADCSRFTOKEN"
  };
}
