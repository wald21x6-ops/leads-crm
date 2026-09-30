# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
A small agency or solo founder selling to local small businesses. Works the lead list in a short daily session,
on laptop or phone. Decides from what the screen says in plain words.

## Product Purpose
A private sales CRM, one copy per agency, each with its own database. It holds researched small businesses, tells
the user who to call, message or test next, and makes sure no lead is forgotten.

## Positioning
Built around outside-in proof: every lead carries observed facts (website, chat tools, ads, complaints) and an
enquiry-speed test the user runs as a customer would. The first line they send is made only of observed facts.

## Operating Context
- Daily session: open → work today's calls/WhatsApps/tests top to bottom → log outcome → set next step.
- Tap-to-call (E.164) and wa.me links prefilled with the first line; the user sends by hand.
- A local research robot (`../robot`) fills new leads; the user's AI agent runs it. The CRM never sends anything itself.
- Stages: Found → Researched → Tested → Contacted → Replied → Call booked → Won / Lost.
- Red rule: next step overdue OR no touch in 7 days. Amber: no next step.

## Capabilities and Constraints
Atomic CRM fork (React, ra-core, shadcn, Tailwind v4, Supabase). Desktop and mobile layouts split at 768px.
Public signups disabled after the first admin; the admin adds teammates. Demo mode (fake data) exists for
verification. Score = sum of research points, higher is better, no fixed maximum. Tasks link to contacts, not companies.

## Brand Commitments
Soft lime→peach wash behind the lead being worked on, pill tabs and buttons, round outlined icon buttons,
Urbanist, lime / teal / black / light grey. Light look.

## Evidence on Hand
No photos of leads or owners — never fabricate faces.

## Product Principles
- The next action is always obvious; the screen answers "what do I do now?".
- Facts only: nothing shown about a lead that the research did not observe.
- Phone is a first-class device, not a squeezed desktop.
- Nothing is forgotten: every lead is either scheduled or visibly flagged.

## Accessibility & Inclusion
WCAG AA contrast (text ≥4.5:1); thumb-reachable main actions on phone; keyboard focus visible.
