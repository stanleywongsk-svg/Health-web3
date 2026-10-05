# HealthLoop Business Proposal Research Report

English presentation completed from the supplied 17-slide template, with two additional backup slides.
Evidence reviewed 5 October 2026. Application records are dated 24–28 September and 5 October; this proposal session did not rerun those tests.

## Slide 1 HEALTHLOOP BUSINESS PROPOSAL

### Slide text

HEALTHLOOP
BUSINESS PROPOSAL

Research report on an iPhone health habit service

COMM7115  ·  AI Media Entrepreneurship Workshop

HealthLoop team · A / B / C / D · Evidence reviewed 5 October 2026

20 MIN PRESENTATION  +  5 MIN Q&A

### Speaker notes

Opening, about 30 seconds. HealthLoop is an iOS-first health habit service for Hong Kong adults. We have enough technical work to discuss a concrete product, but we still need evidence that people will use it repeatedly and that a buyer will pay for operating support. The proposal is to test those questions in a bounded pilot after native and privacy readiness gates pass. The app uses Simplified Chinese; this research presentation follows the English template. The date is the evidence review date, not a promised launch or presentation date. Team letters are the project’s existing role labels, not invented member names. There is no in-app AI doctor or chatbot; Codex is a development tool. The main presentation uses the template’s 20-minute allocation, including this opening, followed by five minutes of questions.

Sources and evidence scope

E1 — HealthLoop implementation brief and requirement register
MEGA_PROMPT.md; docs/requirements.md
Local repository inspected 5 October 2026. Preserves 58 IDs and B/C ownership. Product rules are not medical recommendations.

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

## Slide 2 The proposal at a glance

### Slide text

RESEARCH REPORT

The proposal at a glance

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

02   /   1:00

TARGET USER

Hong Kong adults with an iPhone. Initial focus: desk-based workers willing to try a Simplified Chinese app.

PAIN HYPOTHESIS

A busy day makes it hard to turn activity records into a manageable, repeatable routine.

CURRENT PROJECT DIRECTION

HealthLoop pairs optional health reads with clear daily missions and traceable, noncash points.

Evidence: public research and a tested prototype [S1, E2–E3].
Open question: will people keep returning without cash rewards?

### Speaker notes

Lead with the decision: continue a narrow noncash habit proposition and test repeat use before expanding incentives or building a broad commercial platform. The segment and pain statement are working hypotheses, not interview findings. The initial Hong Kong focus and iPhone platform come from the approved implementation brief. There is no market-size estimate because the available evidence does not establish the eligible, reachable or paying audience. Health reads, cloud synchronisation, marketing and reminders have separate choices. A person can decline optional choices and still access the basic app. No wallet, NFT purchase, ad interaction or insurance policy is required. Core points cannot be transferred, redeemed for cash or promised conversion to future tokens. The proposal must stand on the usefulness of the experience rather than speculative reward value.

Sources and evidence scope

S1 — Hong Kong Department of Health, Health Behaviour Survey 2023
https://www.chp.gov.hk/files/pdf/dh_hbs_2023_report_eng.pdf
2023 fieldwork; report published 2025. Executive summary pp. v–vi, printed pp. 22–29. Adult figures are for ages 18+. Population context, not a HealthLoop demand or effect estimate.

E1 — HealthLoop implementation brief and requirement register
MEGA_PROMPT.md; docs/requirements.md
Local repository inspected 5 October 2026. Preserves 58 IDs and B/C ownership. Product rules are not medical recommendations.

E2 — HealthLoop implementation status and executed test evidence
docs/IMPLEMENTATION_STATUS.md; docs/TEST_EVIDENCE.md
Includes dated 24–28 September and 5 October 2026 engineering records. The October tests were run in a separate application session, not this proposal session. Current UI interaction and physical-device acceptance remain unverified.

E3 — HealthLoop simulator walkthrough and redacted recording
docs/SIMULATOR_WALKTHROUGH_20260928.md; docs/evidence/recordings/HealthLoop-simulator-walkthrough.mp4
28 September 2026. Local test account and real local Auth/Edge/database. No real health readings, awards, merchant redemption or physical-device acceptance.

## Slide 3 Team responsibilities and field choice

### Slide text

RESEARCH REPORT

Team responsibilities and field choice

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

03   /   1:30

MEMBER

ASSIGNED RESPONSIBILITY

PROJECT CONTRIBUTION

A · Product / business

Commercial and scope coordination

Buyer research, partner evidence and legal coordination

B · Mobile

iOS experience and native delivery

HealthKit adapter and app flow; C reviews technical work

C · Backend

Data, accounting and security

Auth, points and admin controls; B reviews technical work

D · Research / QA

Design, research and QA support

Recruitment, synthesis, usability and black-box QA support

FIELD SELECTED

Daily habit support: build on a working prototype and test customer demand.

Roles are assignments, not CV claims. B/C human acceptance remains pending. [E1–E3]

### Speaker notes

This is a responsibility map, not a biography slide. The repository does not supply member names, qualifications or verified access to recruitment partners, so no credentials or institutional relationships are invented. B owns mobile and native delivery; C owns server rules, data permissions and accounting. Only B and C own the 58 technical requirements and review one another. Their human acceptance is still pending; generated code and passing tests do not confer approval. A coordinates product, commercial research and legal review, without replacing a qualified adviser. D supports research, design, recruitment and black-box QA. The concrete team asset is an existing implementation and a recorded simulator flow. Those assets make a prototype study feasible, but neither is evidence of an unmet customer need.

Sources and evidence scope

E1 — HealthLoop implementation brief and requirement register
MEGA_PROMPT.md; docs/requirements.md
Local repository inspected 5 October 2026. Preserves 58 IDs and B/C ownership. Product rules are not medical recommendations.

E2 — HealthLoop implementation status and executed test evidence
docs/IMPLEMENTATION_STATUS.md; docs/TEST_EVIDENCE.md
Includes dated 24–28 September and 5 October 2026 engineering records. The October tests were run in a separate application session, not this proposal session. Current UI interaction and physical-device acceptance remain unverified.

E3 — HealthLoop simulator walkthrough and redacted recording
docs/SIMULATOR_WALKTHROUGH_20260928.md; docs/evidence/recordings/HealthLoop-simulator-walkthrough.mp4
28 September 2026. Local test account and real local Auth/Edge/database. No real health readings, awards, merchant redemption or physical-device acceptance.

## Slide 4 Problem space and target user

### Slide text

RESEARCH REPORT

Problem space and target user

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

04   /   1:30

USER AND SETTING

Adults fitting activity around desk work and commuting. iPhone access and language fit are recruitment criteria, not proven demand.

JOB TO BE DONE

Build a manageable routine and understand progress without adding much manual tracking. This job is a hypothesis to test.

CURRENT WORKAROUND

Apple Health already records steps [S2]. Interviews will test use of existing trackers, reminders, walking groups or no tool.

WHY IT MATTERS

Public data supports investigating daily activity [S1]. The time, effort and frustration costs for our segment remain unmeasured.

### Speaker notes

Explain the job without assuming that another health app is the answer. We want to understand how adults fit activity into ordinary workdays, what they already do, and what would count as a better outcome. Desk-based adults are a proposed first recruitment segment rather than a measured market. Initial research can compare ages 25–44 and 45–64 as exploratory strata; the product’s general audience remains adults aged 18 or older. We must check the suitability of Simplified Chinese for the Hong Kong participants we can actually reach. Traditional Chinese support has not been implemented. Apple Health is a credible existing option. We should include participants who say it is already sufficient, and people who prefer no app. The proposed service does not offer rehabilitation, diagnosis or a prescription for how much exercise someone should do.

Sources and evidence scope

S1 — Hong Kong Department of Health, Health Behaviour Survey 2023
https://www.chp.gov.hk/files/pdf/dh_hbs_2023_report_eng.pdf
2023 fieldwork; report published 2025. Executive summary pp. v–vi, printed pp. 22–29. Adult figures are for ages 18+. Population context, not a HealthLoop demand or effect estimate.

S2 — Apple Support, Use the Health app on your iPhone or iPad
https://support.apple.com/en-hk/104997
Official product description checked 5 October 2026. Does not demonstrate comparative retention.

E1 — HealthLoop implementation brief and requirement register
MEGA_PROMPT.md; docs/requirements.md
Local repository inspected 5 October 2026. Preserves 58 IDs and B/C ownership. Product rules are not medical recommendations.

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

## Slide 5 Research questions and methods

### Slide text

RESEARCH REPORT

Research questions and methods

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

05   /   1:30

QUESTION

METHOD AND WHY IT FITS

What value could a routine add beyond existing activity trackers?

Done: official-source review [S1–S4]. Next: 12 contextual interviews to understand actual workarounds.

Can users explain the mission, points and privacy choices unaided?

Next: 8 moderated task sessions, then a cohort with 100 matured activations to test repeat use.

Will organisations fund delivery without buying health profiles?

Next: 5 budget-holder interviews to test a defined service, price, procurement and delivery capacity.

Desk review: 5 October 2026 · Fieldwork proposed, not conducted.
Decision: refine the segment and approve a bounded pilot only when readiness gates pass.

### Speaker notes

Separate the completed method from the proposed method. Completed work for this deck consists of an official-source desk review and an inspection of the project brief, existing commercial proposal, implementation status and recorded technical evidence. There are no user interviews, survey responses or buyer conversations in the material reviewed. Proposed research proceeds by dependencies: approve the minimal research protocol; interview twelve adults; include eight of them in task-based usability sessions; then, after device readiness and first-party measurement are in place, observe a cohort with at least one hundred matured activations. Separately, interview five people with budget responsibility. Use recent specific behaviour before describing the concept. This sequence informs the segment, onboarding language and commercial scope rather than claiming validation from stated enthusiasm alone.

Sources and evidence scope

S1 — Hong Kong Department of Health, Health Behaviour Survey 2023
https://www.chp.gov.hk/files/pdf/dh_hbs_2023_report_eng.pdf
2023 fieldwork; report published 2025. Executive summary pp. v–vi, printed pp. 22–29. Adult figures are for ages 18+. Population context, not a HealthLoop demand or effect estimate.

S2 — Apple Support, Use the Health app on your iPhone or iPad
https://support.apple.com/en-hk/104997
Official product description checked 5 October 2026. Does not demonstrate comparative retention.

S3 — Sweatcoin Terms of Use, sections 7–8
https://sweatco.in/tnc
Official description of movement-based units and a third-party benefits marketplace, checked 5 October 2026. No claim about Hong Kong offer availability or HealthLoop partnerships.

S4 — Apple App Review Guidelines, 5.1.2(vi) and 5.1.3(i)
https://developer.apple.com/app-store/review/guidelines/#health-and-health-research
Checked 5 October 2026. Platform policy informs product design; it is not legal advice or evidence of approval.

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

## Slide 6 Participants, recruitment and limits

### Slide text

RESEARCH REPORT

Participants, recruitment and limits

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

06   /   1:00

SAMPLE STATUS

External research participants recorded: 0.
Proposed: 12 adults and 5 budget holders; 8 adults also complete usability tasks.

PROPOSED RECRUITMENT AND SESSIONS

Two community or workplace channels; 30–45 minute interviews and 20 minute task sessions. Recruitment has not begun.

COVERAGE AND BIAS

A small volunteer sample cannot represent Hong Kong. Include sceptics and consent refusers; test language fit and report exclusions.

ETHICS

Plain-language consent, optional recording and participant codes. No raw health uploads. Set withdrawal and deletion procedures before recruitment.

### Speaker notes

The count of zero refers to external primary-research participants documented in the reviewed repository. Synthetic accounts, automated test cases and an operator’s simulator walkthrough are not participants. Recruitment through two independent community or workplace channels is proposed; no access or partner permission is assumed. D can support recruitment and notes, with A coordinating scope and consent. A twelve-person qualitative sample helps discover friction but cannot estimate population prevalence. Include disconfirming participants, different levels of app familiarity and people who refuse optional cloud or marketing consent. Keep employer participation voluntary and avoid supervisor access to individual records. Obtain separate permission for recording, define storage, withdrawal and deletion before starting, and keep any real health records out of the coding session. A device study must never write invented samples into HealthKit.

Sources and evidence scope

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

## Slide 7 Existing evidence and alternatives

### Slide text

RESEARCH REPORT

Existing evidence and alternatives

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

07   /   1:30

SIGNAL

SOURCE / DATE

WHAT IT MEANS FOR OUR QUESTION

14.8% insufficient activity;
33.9% sit or recline ≥8 hours on a typical day.

S1 · Hong Kong DH
2023 survey; 2025 report
Adults aged 18+

A relevant activity context. Self-report data; neither a market-size estimate nor evidence of app demand.

Apple Health already counts steps and brings health records together.

S2 · Apple Support
Official product guide
Checked 5 October 2026

A strong existing alternative. HealthLoop must add value beyond a second step-count screen.

Sweatcoin links verified movement to in-app units and a benefits marketplace.

S3 · Sweatcoin
Terms, sections 7–8
Checked 5 October 2026

Activity incentives already compete for attention. HealthLoop has no signed merchant network to claim.

### Speaker notes

S1 is the Hong Kong Department of Health’s Health Behaviour Survey 2023, published in 2025. The displayed statistics refer to adults aged eighteen or above. The overall survey enumerated 4,839 people aged fifteen or above from 2,145 households between July and November 2023; that overall sample is not the adult analytic denominator. Sitting or reclining excludes sleep. The data describe a population context and cannot be multiplied into HealthLoop revenue or taken as evidence that the app works. S2 confirms that Apple Health already performs basic tracking and aggregation. S3 describes Sweatcoin’s movement-based units and marketplace. These alternatives make our central test harder: does clear, localised mission feedback add enough value to be worth using? We make no comparison of clinical outcomes, retention or local merchant availability.

Sources and evidence scope

S1 — Hong Kong Department of Health, Health Behaviour Survey 2023
https://www.chp.gov.hk/files/pdf/dh_hbs_2023_report_eng.pdf
2023 fieldwork; report published 2025. Executive summary pp. v–vi, printed pp. 22–29. Adult figures are for ages 18+. Population context, not a HealthLoop demand or effect estimate.

S2 — Apple Support, Use the Health app on your iPhone or iPad
https://support.apple.com/en-hk/104997
Official product description checked 5 October 2026. Does not demonstrate comparative retention.

S3 — Sweatcoin Terms of Use, sections 7–8
https://sweatco.in/tnc
Official description of movement-based units and a third-party benefits marketplace, checked 5 October 2026. No claim about Hong Kong offer availability or HealthLoop partnerships.

## Slide 8 Findings from current evidence

### Slide text

RESEARCH REPORT

Findings from current evidence

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

08   /   2:00

01

A local problem context exists; demand is unproven.

EVIDENCE

The public survey supports investigating activity habits. It does not explain our segment’s unmet needs. [S1]

02

Step counting and activity incentives are already served.

EVIDENCE

Apple Health and Sweatcoin are existing alternatives; mission clarity and trust still need testing. [S2–S3]

03

Technical feasibility has progressed; adoption is unmeasured.

EVIDENCE

355 tests logged on 5 October; September’s simulator flow was recorded. Current UI and two-iPhone checks remain open. [E2–E3]

Desk and technical findings · Primary user research remains pending.

### Speaker notes

These are desk and technical findings, not completed fieldwork. Public context and established alternatives justify investigating the problem while leaving demand unproven. The 5 October application record reports a revised walk-to-points experience, server mission progress and recovery of accepted-summary claims after restart. Its logged checks passed: 355 unit/guard tests in 20 files, lint/types, 34 client-file boundaries, all 58 requirement assignments, 68 SQL groups, 25 cross-layer tests, 34 Edge/worker tests and one real local HTTP scenario with six groups. iOS export and native simulator compilation also passed. Those checks were run by the separate application session, not this proposal session. The current UI walkthrough was blocked by a locked Mac, so September’s successful recording remains evidence of the earlier interface only. No two-iPhone acceptance, retention cohort or human sign-off is established.

Sources and evidence scope

S1 — Hong Kong Department of Health, Health Behaviour Survey 2023
https://www.chp.gov.hk/files/pdf/dh_hbs_2023_report_eng.pdf
2023 fieldwork; report published 2025. Executive summary pp. v–vi, printed pp. 22–29. Adult figures are for ages 18+. Population context, not a HealthLoop demand or effect estimate.

S2 — Apple Support, Use the Health app on your iPhone or iPad
https://support.apple.com/en-hk/104997
Official product description checked 5 October 2026. Does not demonstrate comparative retention.

S3 — Sweatcoin Terms of Use, sections 7–8
https://sweatco.in/tnc
Official description of movement-based units and a third-party benefits marketplace, checked 5 October 2026. No claim about Hong Kong offer availability or HealthLoop partnerships.

E2 — HealthLoop implementation status and executed test evidence
docs/IMPLEMENTATION_STATUS.md; docs/TEST_EVIDENCE.md
Includes dated 24–28 September and 5 October 2026 engineering records. The October tests were run in a separate application session, not this proposal session. Current UI interaction and physical-device acceptance remain unverified.

E3 — HealthLoop simulator walkthrough and redacted recording
docs/SIMULATOR_WALKTHROUGH_20260928.md; docs/evidence/recordings/HealthLoop-simulator-walkthrough.mp4
28 September 2026. Local test account and real local Auth/Edge/database. No real health readings, awards, merchant redemption or physical-device acceptance.

## Slide 9 Provisional persona to test

### Slide text

RESEARCH REPORT

Provisional persona to test

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

09   /   1:30

Hong Kong desk-based iPhone user

Recruitment hypothesis from the product brief; no interview-derived persona yet. [E1, E4]

GOAL

Keep a manageable activity routine and see what happened today without treating rest as failure.

ASSUMED CONTEXT AND BEHAVIOUR

Fits activity around work and commuting; already has an iPhone. App language and routine fit require validation.

ASSUMED PAIN AND WORKAROUND

May check a tracker occasionally yet struggle to return consistently. Interviews must confirm or reject this pattern.

DESIGN IMPLICATION

Test one clear next action, an honest data state and optional consent before adding more incentives.

### Speaker notes

The original template asks for an evidence-based persona. At the current stage, labelling an invented person as research-derived would overstate the evidence. We therefore use a provisional segment profile and explicitly identify the assumptions to test. The goal is to learn whether people actually experience a gap between viewing records and maintaining a routine. We do not know their income, exact age, health status, shopping behaviour or emotional response. Do not add those details for realism. The first design implication is modest: a person should understand the next action, the available data and the consequence of their consent choices. Research should either replace this profile with a traceable synthesis or reject it. A non-user who says the existing tracker is enough is useful evidence, not a failed recruit.

Sources and evidence scope

E1 — HealthLoop implementation brief and requirement register
MEGA_PROMPT.md; docs/requirements.md
Local repository inspected 5 October 2026. Preserves 58 IDs and B/C ownership. Product rules are not medical recommendations.

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

## Slide 10 Proposed scenario and customer journey

### Slide text

RESEARCH REPORT

Proposed scenario and customer journey

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

10   /   2:00

HYPOTHESIS · A desk-based adult wants to restart a walking routine during a workday break.

TRIGGER

Action
Notices a break after a long desk session.

Test assumption
Does time pressure disrupt the routine?

SEARCH

Action
Checks an existing activity record and today’s goal.

Test assumption
Is another app worth opening?

ATTEMPT

Action
Reads a mission; chooses whether to read and sync data.

Test assumption
Are data choices and point rules clear?

OUTCOME

Action
Sees posted or pending points; decides whether to return.

Test assumption
Does feedback matter without cash value?

PRIORITY TOUCHPOINT

Make the first mission and consent consequences understandable; test without coaching.

### Speaker notes

Walk through this as a future scenario to test, not a witnessed customer journey. The trigger is a workday break. The person checks an existing activity record, encounters a HealthLoop mission and decides whether to allow the relevant reads and minimum cloud summary. Only a server-confirmed result becomes available points. Empty or unavailable data must remain honest; it must not be interpreted as zero activity or proven refusal of HealthKit read access. During a task session, ask the participant to explain each screen in their own words. Observe where they hesitate and whether the first action is obvious. Do not coach the person through a confusing permission decision. The outcome we want to learn is whether understandable feedback provides enough value for a later voluntary return. Feelings and friction remain hypotheses until observed.

Sources and evidence scope

E1 — HealthLoop implementation brief and requirement register
MEGA_PROMPT.md; docs/requirements.md
Local repository inspected 5 October 2026. Preserves 58 IDs and B/C ownership. Product rules are not medical recommendations.

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

## Slide 11 Pain hypotheses and opportunity choice

### Slide text

RESEARCH REPORT

Pain hypotheses and opportunity choice

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

11   /   1:30

PAIN HYPOTHESIS

RESEARCH BASIS

OPPORTUNITY

Activity records may not create a repeatable routine.

S1–S2 provide context; no interview confirmation yet.

Small daily choices and a weekly progress view.

Users may misunderstand points or data permissions.

E1 rules and E3 walkthrough; comprehension untested.

Explain sources, pending states and separate consent.

Organisers may lack capacity to run habit programmes.

E4 business hypothesis; no buyer interviews recorded.

Test a fixed content, onboarding and support package.

PRIORITY RULE

Prioritise comprehension and repeat use; proceed only if buyer value fits the data boundary.

### Speaker notes

The three rows separate possible pains, the strength of evidence and possible interventions. The first row has public context but no direct user confirmation. The second has real product rules and an existing interface, but no participant comprehension test. The third is a business hypothesis from the earlier proposal, with no recorded buyer interview. Prioritise research that could overturn the product decision: whether users understand the mission and whether they return when points have no cash value. Then test a buyer’s actual need for programme delivery. Do not assume that an organisation wants an employee health dashboard. If buyers require personal health profiles or health-based advertising, that demand does not fit the current product boundary. Human acceptance and commercial approval remain separate from B/C’s implementation work.

Sources and evidence scope

S1 — Hong Kong Department of Health, Health Behaviour Survey 2023
https://www.chp.gov.hk/files/pdf/dh_hbs_2023_report_eng.pdf
2023 fieldwork; report published 2025. Executive summary pp. v–vi, printed pp. 22–29. Adult figures are for ages 18+. Population context, not a HealthLoop demand or effect estimate.

S2 — Apple Support, Use the Health app on your iPhone or iPad
https://support.apple.com/en-hk/104997
Official product description checked 5 October 2026. Does not demonstrate comparative retention.

E1 — HealthLoop implementation brief and requirement register
MEGA_PROMPT.md; docs/requirements.md
Local repository inspected 5 October 2026. Preserves 58 IDs and B/C ownership. Product rules are not medical recommendations.

E3 — HealthLoop simulator walkthrough and redacted recording
docs/SIMULATOR_WALKTHROUGH_20260928.md; docs/evidence/recordings/HealthLoop-simulator-walkthrough.mp4
28 September 2026. Local test account and real local Auth/Edge/database. No real health readings, awards, merchant redemption or physical-device acceptance.

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

## Slide 12 Proposed service direction

### Slide text

RESEARCH REPORT

Proposed service direction

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

12   /   1:30

WE PROPOSE

An iPhone habit app that turns permitted activity summaries into understandable missions and noncash points.

FIRST USE CASE

3,000 / 5,000 / 7,000 eligible steps earn 10 / 20 / 30 points. Highest tier only; upgrades add the difference. Rest has no penalty.

MAIN TOUCHPOINTS

Email login → separate consent → read-only HealthKit → missions → ledger → privacy controls.

SCOPE NOW

Native prototype; two-iPhone tests, admin, sponsor isolation and cohort reports remain open. [E1–E3]

Points are nontransferable and noncash · No future-token rights, wallet requirement or ad rewards

### Speaker notes

Explain the core flow in product language. A person signs in by email code, confirms adulthood and saves separate consent choices. On a capable device, read-only HealthKit provides available activity data; raw sleep and heart-rate series remain on-device. With cloud consent, only the minimum activity summary reaches the server. Daily tiers award the highest entitlement: 3,000 eligible steps earns 10 points; 5,000 earns 20; 7,000 earns 30. An upgrade from 10 to 20 grants only another 10. A weekly mission awards 20 once for at least three distinct days meeting the pinned goal, 3,000 by default. Rules use Asia/Hong_Kong and a next-day noon late-sync cutoff. These are product rules, not medical advice. Current reward codes are demonstrations without merchant redemption rights. No wallet, cash conversion, future-token rights or reward for ad interactions belongs to the core.

Sources and evidence scope

E1 — HealthLoop implementation brief and requirement register
MEGA_PROMPT.md; docs/requirements.md
Local repository inspected 5 October 2026. Preserves 58 IDs and B/C ownership. Product rules are not medical recommendations.

E2 — HealthLoop implementation status and executed test evidence
docs/IMPLEMENTATION_STATUS.md; docs/TEST_EVIDENCE.md
Includes dated 24–28 September and 5 October 2026 engineering records. The October tests were run in a separate application session, not this proposal session. Current UI interaction and physical-device acceptance remain unverified.

E3 — HealthLoop simulator walkthrough and redacted recording
docs/SIMULATOR_WALKTHROUGH_20260928.md; docs/evidence/recordings/HealthLoop-simulator-walkthrough.mp4
28 September 2026. Local test account and real local Auth/Edge/database. No real health readings, awards, merchant redemption or physical-device acceptance.

## Slide 13 User value and a testable business model

### Slide text

RESEARCH REPORT

User value and a testable business model

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

13   /   1:30

VALUE FOR THE USER

Understand progress with less manual effort. Measure task success and matured D7 / D28 return rates.

CUSTOMER AND PAYER

Adults use it free. Organisations may fund voluntary programmes; sponsors may buy generic placements.

PROPOSED VALUE CAPTURE

Unvalidated monthly prices: HK$15,000 per organisation; HK$10,000 per sponsor unit. [E4]

DELIVERY ECONOMICS

Assumed fixed costs: HK$90,000 / month, plus user and delivery costs. At 8 clients + 1 sponsor: HK$5,000 surplus.*

SUSTAINABILITY QUESTION

Will noncash value retain users, and will fees cover delivery capacity? The illustrative model is in Appendix 18.

*Illustrative scenario. Enterprise and sponsor features need approval and implementation; no revenue is documented.

### Speaker notes

The existing business proposal prioritises an organisation service package: generic habit content, onboarding, participant support and administrative delivery. The organisation would buy that service, not employee health records. A separate hypothesis is clearly labelled, non-personalised sponsorship sold by placement. Sponsor events must exclude health values, health-derived groups, task outcomes, wallet identifiers and identifiers joinable to health records. These are proposed offerings: enterprise capability F03 requires separate scope approval; P23/P24 sponsorship and P30 measurement are not implemented. No contracts, customers or revenue are documented. The proposed prices and cost allocations are unvalidated inputs copied from E4. The small example surplus is not profit guidance: it excludes tax and other costs and assumes delivery capacity. Appendix 18 shows the model and adverse scenarios. Our immediate commercial task is buyer discovery, followed only by separately authorised pilots after readiness gates.

Sources and evidence scope

S4 — Apple App Review Guidelines, 5.1.2(vi) and 5.1.3(i)
https://developer.apple.com/app-store/review/guidelines/#health-and-health-research
Checked 5 October 2026. Platform policy informs product design; it is not legal advice or evidence of approval.

E1 — HealthLoop implementation brief and requirement register
MEGA_PROMPT.md; docs/requirements.md
Local repository inspected 5 October 2026. Preserves 58 IDs and B/C ownership. Product rules are not medical recommendations.

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

## Slide 14 Research decision and next tests

### Slide text

RESEARCH REPORT

Research decision and next tests

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

14   /   1:30

WHAT THE CURRENT EVIDENCE SUPPORTS

Continue with noncash habit support and buyer discovery.
Gate expansion on device reliability, retention and willingness to pay.

CRITICAL ASSUMPTION

NEXT TEST

DECISION RULE

Users return without cash rewards.

100 matured activations across two recruitment channels.

D7 ≥35%
D28 ≥20%

Buyers fund content and support.

5 budget interviews, then 2 authorised paid pilots after readiness gates.

2 paid pilots;
positive contribution

Proposed decision rules, not results. Native and privacy readiness precede pilots. [E1, E4]

### Speaker notes

The evidence has narrowed the next decision, not proved product-market fit. Start with usability: at least six of eight task participants should finish the mission/ledger/privacy walkthrough unaided, with no serious misunderstanding of cash value or consent; otherwise revise and retest. This criterion is proposed in this deck. For retention, E4 defines activation as login, adult confirmation, saved choices and a home or mission view within seven days of registration; optional health, marketing and notification consent are not conditions. Set activation as D0. D7 is a voluntary core-page view on D6–8; D28 is D26–30. Include only fully matured observation windows, report sample size, uncertainty and channel differences, and exclude synthetic accounts. The 35%/20% thresholds are proposed decisions, not benchmarks or results. Buyer validation requires actual budget and procurement evidence; two authorised paid pilots with positive direct contribution are a subsequent proposed gate, not a current commitment.

Sources and evidence scope

E1 — HealthLoop implementation brief and requirement register
MEGA_PROMPT.md; docs/requirements.md
Local repository inspected 5 October 2026. Preserves 58 IDs and B/C ownership. Product rules are not medical recommendations.

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

## Slide 15 Questions

### Slide text

Questions

5 minutes

HealthLoop · Hong Kong habit service · Team A / B / C / D

Which evidence should decide whether HealthLoop proceeds to a pilot?

### Speaker notes

Allow five minutes for questions. Keep the proposal’s decision clear: obtain evidence of device reliability, understandable interaction, voluntary return and a buyer who values service delivery within the privacy boundary. Refer to the appendix for model arithmetic, evidence sources and release dependencies. There is no signed commercial partner, measured retention cohort, clinical outcome or verified physical-device health flow to report. If asked about AI, explain that development uses Codex; an AI doctor, assistant subscription or chatbot is not an assumed product feature. If asked about Web3, explain that the independent synthetic-only Lab is unbuilt and does not provide a payout route for real health activity or core points. The next technical check is the updated simulator walkthrough once the Mac is unlocked, followed by the two-iPhone matrix when signing and devices are available. Admin and privacy-operation work remain independent dependencies.

Sources and evidence scope

E1 — HealthLoop implementation brief and requirement register
MEGA_PROMPT.md; docs/requirements.md
Local repository inspected 5 October 2026. Preserves 58 IDs and B/C ownership. Product rules are not medical recommendations.

E2 — HealthLoop implementation status and executed test evidence
docs/IMPLEMENTATION_STATUS.md; docs/TEST_EVIDENCE.md
Includes dated 24–28 September and 5 October 2026 engineering records. The October tests were run in a separate application session, not this proposal session. Current UI interaction and physical-device acceptance remain unverified.

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

## Slide 16 Appendix: evidence and source register

### Slide text

APPENDIX

Appendix: evidence and source register

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

16   /   BACKUP

CLAIM / SLIDES

SOURCE ID / RECORD

DATE AND EVIDENCE LIMIT

Market and alternatives
Slides 4, 7–8

S1 · Hong Kong DH report
S2 · Apple; S3 · Sweatcoin

2023 survey / official product pages.
Checked 5 Oct 2026; no demand proof.

Data and sponsor boundary
Slides 12–14, 19

S4 · Apple review guidelines
E1 · Brief and requirements

Checked 5 Oct 2026.
No platform or legal approval claimed.

Prototype and acceptance
Slides 3, 8, 12, 19

E2 · Status and test evidence
E3 · Simulator walkthrough

Sep/Oct 2026 engineering records.
Real-device acceptance remains open.

Business and research plan
Slides 5–6, 9–11, 13–14, 17–18

E4 · Existing business proposal
Proposed research in this deck

28 Sep 2026 assumptions.
No customer, revenue or retention proof.

Source IDs are used throughout. Full links and evidence scope are included in the speaker notes.

### Speaker notes

Source register. S1–S4 are official external sources checked for this deck. E1–E4 are the repository records inspected locally. Full source locations and their limitations follow below. Slide references support their associated claims; they do not turn a proposed design into measured performance. September’s simulator recording describes the earlier interface. A concurrent 5 October application session added a newer engineering checkpoint, which this deck incorporates as recorded evidence; this proposal session did not rerun those tests. Other sessions’ application and instruction edits were preserved. Technical acceptance, legal approval, independent audit and platform approval remain open. No participant IDs or quotes are fabricated. The research instrument and additional study criteria are proposed design choices.

Sources and evidence scope

S1 — Hong Kong Department of Health, Health Behaviour Survey 2023
https://www.chp.gov.hk/files/pdf/dh_hbs_2023_report_eng.pdf
2023 fieldwork; report published 2025. Executive summary pp. v–vi, printed pp. 22–29. Adult figures are for ages 18+. Population context, not a HealthLoop demand or effect estimate.

S2 — Apple Support, Use the Health app on your iPhone or iPad
https://support.apple.com/en-hk/104997
Official product description checked 5 October 2026. Does not demonstrate comparative retention.

S3 — Sweatcoin Terms of Use, sections 7–8
https://sweatco.in/tnc
Official description of movement-based units and a third-party benefits marketplace, checked 5 October 2026. No claim about Hong Kong offer availability or HealthLoop partnerships.

S4 — Apple App Review Guidelines, 5.1.2(vi) and 5.1.3(i)
https://developer.apple.com/app-store/review/guidelines/#health-and-health-research
Checked 5 October 2026. Platform policy informs product design; it is not legal advice or evidence of approval.

E1 — HealthLoop implementation brief and requirement register
MEGA_PROMPT.md; docs/requirements.md
Local repository inspected 5 October 2026. Preserves 58 IDs and B/C ownership. Product rules are not medical recommendations.

E2 — HealthLoop implementation status and executed test evidence
docs/IMPLEMENTATION_STATUS.md; docs/TEST_EVIDENCE.md
Includes dated 24–28 September and 5 October 2026 engineering records. The October tests were run in a separate application session, not this proposal session. Current UI interaction and physical-device acceptance remain unverified.

E3 — HealthLoop simulator walkthrough and redacted recording
docs/SIMULATOR_WALKTHROUGH_20260928.md; docs/evidence/recordings/HealthLoop-simulator-walkthrough.mp4
28 September 2026. Local test account and real local Auth/Edge/database. No real health readings, awards, merchant redemption or physical-device acceptance.

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

## Slide 17 Appendix: proposed research instrument

### Slide text

APPENDIX

Appendix: proposed research instrument

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

17   /   BACKUP

SAMPLE NEUTRAL QUESTIONS

PLANNED ANALYSIS PROCESS

1. Tell me about the last time you tried to be more active.

2. Which tool did you use, and what happened next?

3. Where did the routine become difficult?

4. What would make you stop using an app like this?

5. How do you decide whether to share activity data?

Recruit across work, language and device contexts, including sceptics and people who decline consent.

Code trigger, workaround, friction, privacy and value. D synthesises; A checks interpretation. Link every claim to a participant code.

Actively test whether existing tools suffice, points add no value or buyers reject the price. Preserve contrary cases; no findings are claimed yet.

Proposed instrument and synthesis process; no participant quotes or coded findings exist yet.

### Speaker notes

Use the interview questions before pitching the solution. Ask for a recent concrete event rather than agreement with a benefit statement. Follow up with what happened, which tool was used and what the person did instead. Obtain separate permission before a usability task or recording. The prototype task can ask participants to find the mission, explain what a point is worth, identify why data is missing, change optional consent and locate export/deletion controls without submitting destructive actions. Do not expose real participant health data to the coding environment. For buyers, separately ask about the last programme funded, budget ownership, procurement, delivery burden and the reaction to a defined HK$15,000 monthly service package. D can group notes; A checks interpretation; B/C review technical implications. Retain participant-code links and contrary cases. No interviews, coding exercise or synthesis has yet been performed.

Sources and evidence scope

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

## Slide 18 Appendix: illustrative delivery economics

### Slide text

APPENDIX

Appendix: illustrative delivery economics

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

18   /   BACKUP

Unvalidated HK$ per month · Planning assumptions, not a forecast [E4]

CLIENTS / SPONSORS

MAU

REVENUE

COST

RESULT

3 organisations / 0 sponsor

800

45,000

104,800

−59,800

6 organisations / 1 sponsor

1,100

100,000

117,800

−17,800

8 organisations / 1 sponsor

1,300

130,000

125,000

+5,000

MAU = 500 + 100N     Revenue = 15,000N + 10,000S

Cost = 90,000 + 8 × MAU + 2,500N + 2,000S + 2% × Revenue

Cost coverage: 9 organisations without sponsorship; 8 with one sponsor.

Sensitivity: HK$12,000 client price needs 11 clients + 1 sponsor; HK$16 / MAU turns the 8 + 1 case into a HK$5,400 loss.

Excludes tax, real-benefit procurement and fully costed staffing. Delivery capacity and willingness to pay remain unproven.

### Speaker notes

All financial figures below are illustrative planning assumptions from E4, not observed revenue, quotes, approved expenditure or a forecast. Let N be paying organisations, each with 100 monthly active users (MAU), S be sponsor units, and add 500 free MAU. Organisation price is HK$15,000 per month with HK$2,500 additional delivery cost; sponsor price is HK$10,000 with HK$2,000 content/review cost. Fixed monthly allocations of HK$90,000 consist of B/C technical resources 50,000, A/D operations/content/QA 20,000, privacy/security/legal support 7,000, base cloud/tools 8,000 and contingency 5,000. These are internal allocations, not quoted full-time staffing costs. Each MAU adds HK$8 and revenue carries a 2% collection/bad-debt allowance. Result = 11,400N + 7,800S − 94,000. Avoid double-counting fixed people and additional delivery. With one sponsor, a HK$12,000 client price lowers client contribution to HK$8,460 and requires eleven clients for cost coverage. At HK$16 per MAU, the eight-client/one-sponsor case loses HK$5,400. A zero-revenue stress case with 500 MAU uses HK$94,000 monthly; three billing cycles plus an assumed HK$60,000 one-off reserve imply HK$342,000, not an approved funding ask or a development schedule. Obtain quotes and prove capacity before relying on any figure.

Sources and evidence scope

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

## Slide 19 Appendix: readiness gates and ownership

### Slide text

APPENDIX

Appendix: readiness gates and ownership

COMM7115  ·  BUSINESS PROPOSAL RESEARCH

19   /   BACKUP

DEPENDENCY GATE

EVIDENCE REQUIRED

RESPONSIBILITY

1 · Native core

Two iPhones; real read → sync → claim; consent, accessibility and signing.

B owns mobile; C reviews. Physical-device acceptance is still open.

2 · Safe operation

Admin and MFA; deletion/restore; sponsor separation; cohort reporting.

C owns backend; B reviews. Relevant controls must pass before use.

3 · Commercial pilot

Approved scope; buyer budget; authorised contract, delivery and payment.

A coordinates; D supports. B/C retain technical ownership.

Lab remains unbuilt: separate identities/database, synthetic tasks, Base Sepolia 84532 only. No core-health-to-token path. [E1–E2]

### Speaker notes

Progress by dependencies and evidence, without a promised launch date. Gate one requires actual read-only HealthKit and source behaviour on at least two compatible iPhones, signing/installability, account and consent edge cases, accessibility and the real minimum-summary-to-ledger path. Gate two requires the remaining safe operations: administrator task publishing and live MFA, retention and deletion replay after restore, sponsorship isolation before offering placements and protected cohort measurement before claiming retention. Gate three requires an approved research/pilot scope, a buyer with budget, a clear service contract, actual delivery and payment, plus reviewed unit costs. B and C remain the only technical requirement owners and cross-reviewers. A coordinates business/product/legal work; D supports research/design/QA. External provisioning, spending, publication, deployment and transaction broadcasts still need explicit operator approval. The Lab is not implemented: it must have separate identities/database, synthetic tasks and Base Sepolia chain 84532 only. It is excluded from core revenue and there is no health-to-token or mainnet path in this proposal.

Sources and evidence scope

E1 — HealthLoop implementation brief and requirement register
MEGA_PROMPT.md; docs/requirements.md
Local repository inspected 5 October 2026. Preserves 58 IDs and B/C ownership. Product rules are not medical recommendations.

E2 — HealthLoop implementation status and executed test evidence
docs/IMPLEMENTATION_STATUS.md; docs/TEST_EVIDENCE.md
Includes dated 24–28 September and 5 October 2026 engineering records. The October tests were run in a separate application session, not this proposal session. Current UI interaction and physical-device acceptance remain unverified.

E4 — HealthLoop application and business proposal
docs/proposals/HealthLoop_应用说明与商业提案_简体中文.md
28 September 2026. Pricing, costs, cohort thresholds and funding scenarios are unvalidated planning assumptions. This deck proposes the 12-user, 8-task and 2-paid-pilot research details.

S4 — Apple App Review Guidelines, 5.1.2(vi) and 5.1.3(i)
https://developer.apple.com/app-store/review/guidelines/#health-and-health-research
Checked 5 October 2026. Platform policy informs product design; it is not legal advice or evidence of approval.
