// Signing in to the admin. Theres no users table becuase theres one user: a session is a random token in an
// httpOnly cookie, the database only ever sees its sha256 hash, so a leaked backup cant be used to sign in.
//
// Two ways in:
// - Sign in with SimpleLogin (OAuth code flow). SimpleLogin shows a Log in with Proton button, so a Proton
//   account works. Only the SimpleLogin account id in ADMIN_SIMPLELOGIN_ID is let in, anyone else gets told no.
// - Passkeys, added from the admin once you're signed in, as the backup for when SimpleLogin is down.
// On your own computer theres also a development sign in, so working on the admin doesnt need any of the above.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Op } from "sequelize";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const token = (bytes = 32) => randomBytes(bytes).toString("base64url");
const DAY = 24 * 60 * 60 * 1000;
// Updating last seen on every click would be a write per page view, once every few minutes is plenty
const TOUCH_EVERY = 5 * 60 * 1000;
const ATTEMPT_MINUTES = 10;
// Fixed, so the passkey always belongs to the same "user" of this site. Not personal data, just a constant
const PASSKEY_USER_ID = new TextEncoder().encode("reece.page-admin");

export class AuthError extends Error {
  constructor(message, { status = 400, code = "auth" } = {}) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

function sameText(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Only paths inside the admin are allowed as somewhere to go back to after signing in */
export function safeReturnTo(value) {
  const path = String(value || "");
  return /^\/admin(\/[\w\-/.]*)?(\?[\w\-=&%.]*)?$/.test(path) && !path.includes("//") && !path.startsWith("/admin/login") ? path : "/admin";
}

export class AdminAuthService {
  /**
   * @param {object} deps
   * @param {object} deps.config
   * @param {object} deps.models
   * @param {object} [deps.logger]
   * @param {typeof fetch} [deps.fetch] swapped in the tests so they never talk to SimpleLogin
   */
  constructor({ config, models, logger, fetch: fetchImpl = globalThis.fetch }) {
    this.config = config;
    this.models = models;
    this.logger = logger;
    this.fetch = fetchImpl;
    const base = new URL(config.baseUrl);
    this.origin = base.origin;
    this.rpID = base.hostname;
    this.cookieName = config.isProduction ? "__Host-rp.admin" : "rp.admin";
    this.attemptCookie = config.isProduction ? "__Host-rp.signin" : "rp.signin";
  }

  get available() { return Boolean(this.models); }

  get methods() {
    return {
      simplelogin: this.config.admin.simplelogin.configured,
      dev: this.config.admin.devLogin
    };
  }

  cookieOptions(maxAgeMs) {
    return { httpOnly: true, secure: this.config.isProduction, sameSite: "lax", path: "/", ...(maxAgeMs ? { maxAge: maxAgeMs } : {}) };
  }

  // Sessions

  async createSession(res, { method, userAgent = "" }) {
    const raw = token();
    const now = new Date();
    const lifetime = this.config.admin.sessionDays * DAY;
    await this.models.AdminSession.create({ idHash: sha256(raw), method, userAgent: String(userAgent).slice(0, 200), expiresAt: new Date(now.getTime() + lifetime), lastSeenAt: now });
    res.cookie(this.cookieName, raw, this.cookieOptions(lifetime));
    this.logger?.info({ method }, "admin signed in");
    // Old sessions are cleared out here instead of on a timer, signing in is rare enough
    await this.models.AdminSession.destroy({ where: { expiresAt: { [Op.lt]: now } } });
    await this.models.SignInAttempt.destroy({ where: { expiresAt: { [Op.lt]: now } } });
  }

  /** The session for this request, or null. Expired and idle ones are deleted on the way */
  async readSession(req) {
    const raw = req.cookies?.[this.cookieName];
    if (!raw || typeof raw !== "string" || raw.length > 100) return null;
    const session = await this.models.AdminSession.findByPk(sha256(raw));
    if (!session) return null;
    const now = Date.now();
    const idleLimit = this.config.admin.idleDays * DAY;
    if (new Date(session.expiresAt).getTime() < now || now - new Date(session.lastSeenAt).getTime() > idleLimit) {
      await session.destroy();
      return null;
    }
    if (now - new Date(session.lastSeenAt).getTime() > TOUCH_EVERY) await session.update({ lastSeenAt: new Date(now) });
    return { idHash: session.idHash, method: session.method, createdAt: session.createdAt, lastSeenAt: session.lastSeenAt };
  }

  async endSession(req, res) {
    const raw = req.cookies?.[this.cookieName];
    if (raw && typeof raw === "string") await this.models.AdminSession.destroy({ where: { idHash: sha256(raw) } });
    res.clearCookie(this.cookieName, this.cookieOptions());
  }

  async listSessions() {
    return this.models.AdminSession.findAll({ where: { expiresAt: { [Op.gt]: new Date() } }, order: [["lastSeenAt", "DESC"]] });
  }

  /** Signs out every other browser, keeps this one */
  async endOtherSessions(currentHash) {
    return this.models.AdminSession.destroy({ where: { idHash: { [Op.ne]: currentHash } } });
  }

  // Short lived sign in attempts, tied to the browser by a cookie

  async startAttempt(res, { kind, secret, returnTo }) {
    const state = token();
    await this.models.SignInAttempt.create({ stateHash: sha256(state), kind, secret, returnTo: safeReturnTo(returnTo), expiresAt: new Date(Date.now() + ATTEMPT_MINUTES * 60000) });
    res.cookie(this.attemptCookie, state, this.cookieOptions(ATTEMPT_MINUTES * 60000));
    return state;
  }

  /** Reads and deletes the attempt, an attempt can only ever be used once */
  async takeAttempt(req, res, kind, { state } = {}) {
    const fromCookie = req.cookies?.[this.attemptCookie];
    res.clearCookie(this.attemptCookie, this.cookieOptions());
    if (!fromCookie || typeof fromCookie !== "string") throw new AuthError("The sign in took too long or was started in another browser, please try again.", { code: "expired" });
    if (state !== undefined && !sameText(state, fromCookie)) throw new AuthError("The sign in didnt match the one this browser started, please try again.", { code: "state" });
    const attempt = await this.models.SignInAttempt.findByPk(sha256(fromCookie));
    if (!attempt) throw new AuthError("The sign in took too long or was already used, please try again.", { code: "expired" });
    await attempt.destroy();
    if (attempt.kind !== kind || new Date(attempt.expiresAt).getTime() < Date.now()) throw new AuthError("The sign in took too long, please try again.", { code: "expired" });
    return { secret: attempt.secret, returnTo: attempt.returnTo };
  }

  // Sign in with SimpleLogin

  get redirectUri() { return `${this.config.baseUrl}/admin/login/simplelogin/callback`; }

  /** Where to send the browser to sign in. The state ties the answer that comes back to this browser */
  async simpleLoginUrl(res, returnTo) {
    const sl = this.config.admin.simplelogin;
    if (!sl.configured) throw new AuthError("Sign in with SimpleLogin isnt set up on this server yet.", { status: 404 });
    const state = await this.startAttempt(res, { kind: "simplelogin", secret: "-", returnTo });
    const url = new URL(`${sl.issuer}/oauth2/authorize`);
    url.search = new URLSearchParams({ response_type: "code", client_id: sl.clientId, redirect_uri: this.redirectUri, scope: "profile", state }).toString();
    return url.toString();
  }

  /**
   * The browser is back from SimpleLogin with a code. Swaps the code for the account details over a direct https
   * call (with the client secret, so nobody else can do this swap), then checks its the allowed account
   */
  async finishSimpleLogin(req, res) {
    const sl = this.config.admin.simplelogin;
    if (!sl.configured) throw new AuthError("Sign in with SimpleLogin isnt set up on this server yet.", { status: 404 });
    const { code, state, error } = req.query;
    if (error) {
      await this.takeAttempt(req, res, "simplelogin").catch(() => {});
      throw new AuthError(error === "access_denied" ? "Sign in was cancelled on SimpleLogin." : "SimpleLogin didnt sign you in, please try again.", { code: "denied" });
    }
    if (typeof code !== "string" || typeof state !== "string" || code.length > 500 || state.length > 100) throw new AuthError("That sign in link is incomplete, please start again.", { code: "state" });
    const { returnTo } = await this.takeAttempt(req, res, "simplelogin", { state });

    const tokens = await this.callSimpleLogin(`${sl.issuer}/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: this.redirectUri, client_id: sl.clientId, client_secret: sl.clientSecret }).toString()
    });
    let user = tokens.user;
    if (!user && tokens.access_token) {
      user = await this.callSimpleLogin(`${sl.issuer}/oauth2/userinfo`, { headers: { authorization: `Bearer ${tokens.access_token}`, accept: "application/json" } });
    }
    const id = String(user?.sub ?? user?.id ?? "");
    if (!id) throw new AuthError("SimpleLogin didnt say which account signed in, please try again.", { code: "denied" });
    if (!sl.allowedId) {
      this.logger?.warn({ id }, "simplelogin sign in while ADMIN_SIMPLELOGIN_ID is not set");
      throw new AuthError(`Signed in to SimpleLogin as ${user.email || "an account"} with the id ${id}. If that's you, add ADMIN_SIMPLELOGIN_ID=${id} to .env on the server, restart the site and sign in again.`, { status: 403, code: "setup" });
    }
    if (!sameText(id, sl.allowedId)) {
      this.logger?.warn("simplelogin sign in by an account that isnt allowed");
      throw new AuthError("That SimpleLogin account isnt allowed into this admin.", { status: 403, code: "forbidden" });
    }
    await this.createSession(res, { method: "simplelogin", userAgent: req.get("user-agent") });
    return returnTo;
  }

  async callSimpleLogin(url, init) {
    let response;
    try {
      response = await this.fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
    } catch (error) {
      this.logger?.error({ err: { message: error.message } }, "simplelogin not reachable");
      throw new AuthError("SimpleLogin couldnt be reached, try again in a moment or use a passkey.", { status: 502, code: "unreachable" });
    }
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = {}; }
    if (!response.ok) {
      this.logger?.warn({ status: response.status, error: body.error }, "simplelogin answered with an error");
      throw new AuthError("SimpleLogin didnt accept the sign in, please start again.", { status: 502, code: "denied" });
    }
    return body;
  }

  // Passkeys

  async passkeys() {
    return this.models.AdminPasskey.findAll({ order: [["createdAt", "ASC"]] });
  }

  async hasPasskeys() {
    return (await this.models.AdminPasskey.count()) > 0;
  }

  /** Options for adding a passkey, only called by someone who is already signed in */
  async registrationOptions(res) {
    const existing = await this.passkeys();
    const options = await generateRegistrationOptions({
      rpName: "reece.page admin",
      rpID: this.rpID,
      userName: "reece",
      userDisplayName: "Reece (reece.page admin)",
      userID: PASSKEY_USER_ID,
      attestationType: "none",
      excludeCredentials: existing.map((key) => ({ id: key.credentialId, transports: key.transports ? key.transports.split(",") : undefined })),
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" }
    });
    await this.startAttempt(res, { kind: "passkey-add", secret: options.challenge, returnTo: "/admin/account" });
    return options;
  }

  async finishRegistration(req, res, { response, name }) {
    const { secret: challenge } = await this.takeAttempt(req, res, "passkey-add");
    let verification;
    try {
      verification = await verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: this.origin, expectedRPID: this.rpID, requireUserVerification: false });
    } catch (error) {
      throw new AuthError(`The passkey couldnt be checked: ${error.message}`);
    }
    if (!verification.verified) throw new AuthError("The passkey couldnt be checked, please try again.");
    const { credential, credentialBackedUp } = verification.registrationInfo;
    await this.models.AdminPasskey.create({
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64"),
      counter: credential.counter,
      transports: (credential.transports || []).join(","),
      name: String(name || "Passkey").trim().slice(0, 80) || "Passkey",
      backedUp: Boolean(credentialBackedUp)
    });
    this.logger?.info("passkey added to the admin");
  }

  /** Options for signing in with a passkey. No list of keys is sent, the browser offers the ones it has for this site */
  async authenticationOptions(res, returnTo) {
    if (!(await this.hasPasskeys())) throw new AuthError("No passkeys have been added yet. Sign in with SimpleLogin first, then add one under Account.", { status: 404, code: "nopasskeys" });
    const options = await generateAuthenticationOptions({ rpID: this.rpID, userVerification: "preferred" });
    await this.startAttempt(res, { kind: "passkey-signin", secret: options.challenge, returnTo });
    return options;
  }

  async finishAuthentication(req, res, response) {
    const { secret: challenge, returnTo } = await this.takeAttempt(req, res, "passkey-signin");
    const key = typeof response?.id === "string" ? await this.models.AdminPasskey.findByPk(response.id) : null;
    if (!key) throw new AuthError("That passkey isnt one of the ones added to this admin.", { status: 403, code: "forbidden" });
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential: { id: key.credentialId, publicKey: new Uint8Array(Buffer.from(key.publicKey, "base64")), counter: Number(key.counter), transports: key.transports ? key.transports.split(",") : undefined },
        requireUserVerification: false
      });
    } catch (error) {
      throw new AuthError(`The passkey couldnt be checked: ${error.message}`, { status: 403 });
    }
    if (!verification.verified) throw new AuthError("The passkey couldnt be checked, please try again.", { status: 403 });
    await key.update({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date(), backedUp: verification.authenticationInfo.credentialBackedUp });
    await this.createSession(res, { method: "passkey", userAgent: req.get("user-agent") });
    return returnTo;
  }

  async renamePasskey(id, name) {
    const clean = String(name || "").trim().slice(0, 80);
    if (!clean) throw new AuthError("A passkey needs a name.");
    const [count] = await this.models.AdminPasskey.update({ name: clean }, { where: { credentialId: String(id) } });
    if (!count) throw new AuthError("That passkey doesnt exist.", { status: 404 });
  }

  async removePasskey(id) {
    const count = await this.models.AdminPasskey.destroy({ where: { credentialId: String(id) } });
    if (!count) throw new AuthError("That passkey doesnt exist.", { status: 404 });
    this.logger?.info("passkey removed from the admin");
  }
}
