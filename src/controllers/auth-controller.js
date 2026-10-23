// The sign in page, the SimpleLogin round trip, passkeys and signing out. The account page (passkeys and the list
// of signed in browsers) is in here too because it is all the same service
import { AuthError, safeReturnTo } from "../services/admin-auth-service.js";
import { buildAdminNav } from "./admin-controller.js";

const METHOD_LABELS = { simplelogin: "SimpleLogin", passkey: "a passkey", dev: "the development sign in" };

/** "Chrome on macOS" out of a user agent string, good enough to tell your own browsers apart */
export function describeBrowser(userAgent) {
  const ua = String(userAgent || "");
  if (!ua) return "A browser";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /HeadlessChrome/.test(ua) ? "Headless Chrome"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const system = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return system ? `${browser} on ${system}` : browser;
}

/**
 * @param {object} deps
 * @param {import("../services/admin-auth-service.js").AdminAuthService} deps.auth
 * @param {import("../services/seo-service.js").SeoService} deps.seo
 * @param {object} deps.config
 */
export function createAuthController({ auth, seo, config }) {
  const meta = (title) => seo.build({ title, description: "reece.page admin", path: "/admin", noindex: true });

  async function showLogin(req, res, { error = null, status = 200, setupId = null } = {}) {
    // Already signed in, nothing to do here
    if (!error && auth.available && (await auth.readSession(req).catch(() => null))) return res.redirect(303, safeReturnTo(req.query.next));
    const methods = auth.methods;
    const passkeys = auth.available ? await auth.hasPasskeys().catch(() => false) : false;
    res.status(status).render("pages/admin/login", {
      layout: "admin",
      meta: meta("Sign in"),
      bodyClass: "admin-login-page",
      next: safeReturnTo(req.query.next),
      error,
      setupId,
      simplelogin: methods.simplelogin,
      passkeys,
      dev: methods.dev,
      nothingSetUp: !methods.simplelogin && !methods.dev && !passkeys,
      noDatabase: !auth.available,
      scripts: ["js/admin-login.js"],
      vendorScripts: passkeys ? ["vendor/simplewebauthn-browser-14.0.0/index.umd.min.js"] : []
    });
  }

  function jsonError(res, error) {
    if (error instanceof AuthError) return res.status(error.status).json({ ok: false, error: error.message, code: error.code });
    res.status(500).json({ ok: false, error: "Something went wrong on the server, it has been logged." });
  }

  return {
    login: (req, res, next) => showLogin(req, res).catch(next),

    async startSimpleLogin(req, res, next) {
      try {
        res.redirect(303, await auth.simpleLoginUrl(res, req.body?.next));
      } catch (error) {
        if (error instanceof AuthError) return showLogin(req, res, { error: error.message, status: error.status }).catch(next);
        next(error);
      }
    },

    async simpleLoginCallback(req, res, next) {
      try {
        res.redirect(303, await auth.finishSimpleLogin(req, res));
      } catch (error) {
        if (error instanceof AuthError) {
          req.log?.warn({ code: error.code }, "simplelogin sign in refused");
          return showLogin(req, res, { error: error.message, status: error.status === 502 ? 502 : 403 }).catch(next);
        }
        next(error);
      }
    },

    async passkeyOptions(req, res) {
      try {
        res.json({ ok: true, options: await auth.authenticationOptions(res, req.body?.next) });
      } catch (error) { jsonError(res, error); }
    },

    async passkeySignIn(req, res) {
      try {
        const returnTo = await auth.finishAuthentication(req, res, req.body?.response);
        res.json({ ok: true, redirect: returnTo });
      } catch (error) { jsonError(res, error); }
    },

    async devSignIn(req, res, next) {
      if (!config.admin.devLogin) return next();
      try {
        await auth.createSession(res, { method: "dev", userAgent: req.get("user-agent") });
        res.redirect(303, safeReturnTo(req.body?.next));
      } catch (error) { next(error); }
    },

    async logout(req, res, next) {
      try {
        await auth.endSession(req, res);
        res.redirect(303, "/admin/login?signedout=1");
      } catch (error) { next(error); }
    },

    async account(req, res, next) {
      try {
        const [passkeys, sessions] = await Promise.all([auth.passkeys(), auth.listSessions()]);
        res.render("pages/admin/account", {
          layout: "admin",
          meta: meta("Account | Admin"),
          nav: buildAdminNav(config, "account"),
          section: "account",
          pageTitle: "Account",
          passkeys: passkeys.map((key) => ({ id: key.credentialId, name: key.name, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt, backedUp: key.backedUp })),
          sessions: sessions
            .map((s) => ({ current: s.idHash === req.admin.idHash, method: METHOD_LABELS[s.method] || s.method, browser: describeBrowser(s.userAgent), createdAt: s.createdAt, lastSeenAt: s.lastSeenAt }))
            .sort((a, b) => Number(b.current) - Number(a.current)),
          simplelogin: auth.methods.simplelogin,
          allowedId: config.admin.simplelogin.allowedId,
          notice: req.query.notice,
          scripts: ["js/admin-account.js"],
          vendorScripts: ["vendor/simplewebauthn-browser-14.0.0/index.umd.min.js"]
        });
      } catch (error) { next(error); }
    },

    async passkeyAddOptions(req, res) {
      try {
        res.json({ ok: true, options: await auth.registrationOptions(res) });
      } catch (error) { jsonError(res, error); }
    },

    async passkeyAdd(req, res) {
      try {
        await auth.finishRegistration(req, res, { response: req.body?.response, name: req.body?.name });
        res.json({ ok: true });
      } catch (error) { jsonError(res, error); }
    },

    async passkeyRename(req, res, next) {
      try {
        await auth.renamePasskey(req.params.key, req.body?.name);
        res.redirect(303, "/admin/account?notice=renamed");
      } catch (error) {
        if (error instanceof AuthError) return res.redirect(303, "/admin/account?notice=rename-failed");
        next(error);
      }
    },

    async passkeyRemove(req, res, next) {
      try {
        await auth.removePasskey(req.params.key);
        res.redirect(303, "/admin/account?notice=removed");
      } catch (error) {
        if (error instanceof AuthError) return res.redirect(303, "/admin/account?notice=remove-failed");
        next(error);
      }
    },

    async signOutOthers(req, res, next) {
      try {
        await auth.endOtherSessions(req.admin.idHash);
        res.redirect(303, "/admin/account?notice=others-signed-out");
      } catch (error) { next(error); }
    }
  };
}
