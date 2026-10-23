# Pre-launch checklist

The step by step for the server is in [DEPLOYMENT.md](DEPLOYMENT.md), this is the list to tick off.

## Decided (12 October 2026)

- [x] Hosting: Hetzner Online GmbH, Germany. Confirm the server location (Nuremberg or Falkenstein) matches
      `legal.hosting.server_location`, change it if you pick Helsinki
- [x] Email: Proton Mail (Proton AG, Switzerland), Bridge or SMTP tokens
- [x] Cloudflare in front, named in the privacy policy (`legal.cdn`)
- [x] Third country text written (Switzerland adequacy decision, Cloudflare under the EU-US Data Privacy Framework)
- [x] Phone on the impressum (`show_phone: true`, the number goes in `.env` as `LEGAL_PHONE`)
- [x] GitHub profile linked
- [x] No Bible quotations on the site any more (the Genesis verse and the RSV notice were taken out in October 2026)
- [x] Lawyer review done

## Accounts and agreements

- [ ] Hetzner data processing agreement (AVV) concluded
- [ ] Cloudflare data processing addendum applies to the account
- [ ] Proton data processing agreement (Proton's DPA covers business accounts, keep a copy)
- [ ] `website@reece.page` exists on the Proton account, SPF, DKIM, DMARC set in Cloudflare (DNS only)

## Server

- [ ] Steps 1 to 7 of DEPLOYMENT.md, `.env` complete, `npm run db:migrate` done
- [ ] `npm run mail:verify -- --send` and the test email arrived, not in spam
- [ ] GlitchTip running, `ERROR_DSN` set, a test error shows up, uptime monitor on /health/ready
- [ ] SimpleLogin app made and `ADMIN_SIMPLELOGIN_ID` set, /admin signs in, a passkey added under Account
- [ ] `GITHUB_SYNC_TOKEN` set, a save in the admin shows up as a commit on GitHub
- [ ] Introduction video added with its captions and marked featured (DEPLOYMENT.md step 11)
- [ ] nginx logs rotate after 7 days, nightly database dump, media folder backed up off the server, one restore tried

## Content

- [ ] Fill or delete every `todo` (`npm run content:check` lists them, 21 in projects)
- [ ] Read and edit "How this site is built", it was drafted from the code
- [ ] Real photos through /admin/library, placed in the project write ups or articles
- [ ] Update `content/data/now.yml` and its date
- [ ] `legal.updated` set to the date the legal texts were last changed
- [ ] `npm run images:og` after the last content change

## Final checks

- [ ] `npm run check` passes
- [ ] `npm run build:dev && npm run test:e2e` passes
- [ ] `npm run build` then `npm run site:check` and `npm run perf:check` show no errors
- [ ] The going live list at the end of DEPLOYMENT.md
