import { test } from "node:test";
import assert from "node:assert/strict";
import { ConsentService } from "../../src/services/consent-service.js";

function service({ analytics = true, provider = "plausible", version = 1 } = {}) {
  return new ConsentService({
    config: {
      isProduction: false,
      features: { analytics },
      analytics: { provider },
      consent: { cookie_name: "rp_consent", version, max_age_days: 180 }
    }
  });
}

const req = (value) => ({ cookies: value === undefined ? {} : { rp_consent: value } });

test("nothing to ask when no optional service is switched on", () => {
  assert.equal(service({ analytics: false }).hasOptionalServices, false);
  assert.equal(service({ provider: "none" }).hasOptionalServices, false);
  assert.equal(service().hasOptionalServices, true);
});

test("reads yes, no and nothing", () => {
  const s = service();
  assert.deepEqual(s.read(req()), { decided: false, analytics: false });
  assert.deepEqual(s.read(req("1.analytics")), { decided: true, analytics: true });
  assert.deepEqual(s.read(req("1.none")), { decided: true, analytics: false });
});

test("an old version or a made up service counts as not decided or not allowed", () => {
  const s = service({ version: 2 });
  assert.deepEqual(s.read(req("1.analytics")), { decided: false, analytics: false });
  assert.deepEqual(s.read(req("2.marketing")), { decided: true, analytics: false });
});

test("writes a strictly necessary, http only cookie", () => {
  const calls = [];
  const res = { cookie: (...args) => calls.push(args) };
  assert.equal(service().write(res, { analytics: false }), "1.none");
  assert.equal(service().write(res, { analytics: true }), "1.analytics");
  const [name, , options] = calls[0];
  assert.equal(name, "rp_consent");
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.maxAge, 180 * 86400000);
});
