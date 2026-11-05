-- =====================================================================
-- Demo data — fictional, loaded by `bun run db:seed` after the migrations
--
-- 10 accounts, 36 tickets, 45 messages, 6 follow-ups, 42 timeline events.
-- Every date is relative to the day it is loaded, so the demo always looks
-- current. Fixed ids + ON CONFLICT DO NOTHING: loading it again inserts
-- nothing and never overwrites changes made in the app.
-- Column defaults fill the rest (no drafts, no AI summaries yet).
-- =====================================================================

insert into public.accounts (id, name, initials, owner, tier, user_count, arr, renewal_date, sentiment, risk, contact_name, summary) values
  ('atlas', 'Atlas Cold Chain', 'AC', 'You', 'Growth', 150, 58000, current_date + 75, 'Improving', 'Low', 'Ravi Shah', 'Cold-storage logistics using temperature monitoring alerts.'),
  ('cobalt', 'Cobalt Bulk Shipping', 'CB', 'You', 'Growth', 190, 64000, current_date + 98, 'Stable', 'Medium', 'Ines Duarte', 'Bulk shipping company using billing and port ETA feeds.'),
  ('harbor', 'Harborline Retail', 'HR', 'You', 'Enterprise', 910, 226000, current_date + 57, 'Declining', 'High', 'Tom Ellery', 'Retail chain with 120 stores relying on POS and inventory sync.'),
  ('lumen', 'Lumen Energy', 'LE', 'You', 'Starter', 60, 18000, current_date + 160, 'Stable', 'Low', 'Greta Lind', 'Utility start-up importing meter data.'),
  ('meridian', 'Meridian Freight Co.', 'MF', 'You', 'Enterprise', 520, 158000, current_date + 59, 'Declining', 'High', 'Carl Brandt', 'Road freight operator using route optimisation and the driver app.'),
  ('northstar', 'Northstar Logistics', 'NL', 'You', 'Enterprise', 640, 184000, current_date + 42, 'Declining', 'High', 'Priya Nair', 'Freight forwarder using reporting, TMS integration and dispatch modules across 4 regions.'),
  ('pinecrest', 'Pinecrest Clinics', 'PC', 'You', 'Starter', 45, 14000, current_date + 177, 'Improving', 'Low', 'Sam Okoro', 'Small clinic group using scheduling.'),
  ('quarry', 'Quarry & Co.', 'QC', 'You', 'Starter', 30, 12000, current_date + 216, 'Stable', 'Low', 'Mila Novak', 'Construction supplier using basic reporting.'),
  ('solano', 'Solano Foods', 'SF', 'You', 'Growth', 280, 72000, current_date + 53, 'Stable', 'Medium', 'Lucía Ortega', 'Food distributor using the order API and supplier portal.'),
  ('vireo', 'Vireo Health', 'VH', 'You', 'Growth', 340, 81000, current_date + 145, 'Stable', 'Low', 'Dr. Hana Mori', 'Clinic network using intake forms and audit logging.')
on conflict (id) do nothing;
--> statement-breakpoint

insert into public.tickets (id, account_id, title, category, priority, status, reopened, opened_on, summary, draft, knowledge, resolution_note) values
  ('4690', 'quarry', 'Password reset email delayed', 'Authentication', 'Low', 'Resolved', false, current_date - 24, 'Authentication issue: password reset email delayed.', '', array['Authentication troubleshooting guide']::text[], null),
  ('4702', 'cobalt', 'User invite link expired', 'Authentication', 'Low', 'Resolved', false, current_date - 21, 'Authentication issue: user invite link expired.', '', array['Authentication troubleshooting guide']::text[], null),
  ('4711', 'pinecrest', 'Reminder SMS duplicated', 'Notifications', 'Low', 'Resolved', false, current_date - 20, 'Notifications issue: reminder sms duplicated.', '', array['Notifications troubleshooting guide']::text[], null),
  ('4720', 'meridian', 'Fuel report rounding error', 'Reporting', 'Low', 'Resolved', false, current_date - 18, 'Reporting issue: fuel report rounding error.', '', array['Reporting troubleshooting guide']::text[], null),
  ('4733', 'atlas', 'Dashboard widget misaligned', 'UI', 'Low', 'Resolved', false, current_date - 15, 'UI issue: dashboard widget misaligned.', '', array['UI troubleshooting guide']::text[], null),
  ('4741', 'northstar', 'SSO login loop for dispatch team', 'Authentication', 'Low', 'Open', false, current_date - 12, 'Authentication issue: sso login loop for dispatch team.', '', array['Authentication troubleshooting guide']::text[], null),
  ('4745', 'solano', 'Invoice email bounced', 'Billing', 'Low', 'Resolved', false, current_date - 14, 'Billing issue: invoice email bounced.', '', array['Billing troubleshooting guide']::text[], null),
  ('4752', 'harbor', 'Promo pricing not applied', 'Billing', 'Medium', 'Open', true, current_date - 11, 'Billing issue: promo pricing not applied. Previously fixed, now reopened.', '', array['Billing troubleshooting guide']::text[], null),
  ('4760', 'vireo', 'Audit log export incomplete', 'Data export', 'Low', 'Open', false, current_date - 9, 'Data export issue: audit log export incomplete.', '', array['Data export troubleshooting guide']::text[], null),
  ('4766', 'northstar', 'CSV export missing shipment columns', 'Data export', 'Medium', 'Open', true, current_date - 7, 'Data export issue: csv export missing shipment columns. Previously fixed, now reopened.', '', array['Data export troubleshooting guide']::text[], null),
  ('4770', 'cobalt', 'Port ETA feed delayed', 'Integration', 'Medium', 'Open', true, current_date - 7, 'Integration issue: port eta feed delayed. Previously fixed, now reopened.', '', array['Integration troubleshooting guide']::text[], null),
  ('4776', 'quarry', 'Report logo appears blurry', 'Reporting', 'Low', 'Open', false, current_date - 7, 'Reporting issue: report logo appears blurry.', '', array['Reporting troubleshooting guide']::text[], null),
  ('4779', 'meridian', 'Driver app crashes on Android 15', 'Mobile', 'Medium', 'Open', true, current_date - 6, 'Mobile issue: driver app crashes on android 15. Previously fixed, now reopened.', '', array['Mobile troubleshooting guide']::text[], null),
  ('4781', 'lumen', 'User role permissions unclear', 'Admin', 'Low', 'Open', false, current_date - 6, 'Admin issue: user role permissions unclear.', '', array['Admin troubleshooting guide']::text[], null),
  ('4784', 'solano', 'Supplier portal login slow', 'Performance', 'Medium', 'Open', false, current_date - 6, 'Performance issue: supplier portal login slow.', '', array['Performance troubleshooting guide']::text[], null),
  ('4788', 'pinecrest', 'Calendar invites show wrong timezone', 'Scheduling', 'Low', 'Open', false, current_date - 6, 'Scheduling issue: calendar invites show wrong timezone.', '', array['Scheduling troubleshooting guide']::text[], null),
  ('4790', 'northstar', 'Webhook delivery failures', 'Integration', 'Medium', 'Open', true, current_date - 4, 'Integration issue: webhook delivery failures. Previously fixed, now reopened.', '', array['Integration troubleshooting guide']::text[], null),
  ('4795', 'harbor', 'Inventory counts mismatched', 'Data quality', 'Medium', 'Open', false, current_date - 5, 'Data quality issue: inventory counts mismatched.', '', array['Data quality troubleshooting guide']::text[], null),
  ('4799', 'atlas', 'Temperature alerts delayed', 'Alerts', 'Medium', 'Open', false, current_date - 5, 'Alerts issue: temperature alerts delayed.', '', array['Alerts troubleshooting guide']::text[], null),
  ('4801', 'vireo', 'Patient intake form loads slowly', 'Performance', 'Medium', 'Open', false, current_date - 4, 'Performance issue: patient intake form loads slowly.', '', array['Performance troubleshooting guide']::text[], null),
  ('4803', 'lumen', 'Meter data import failing', 'Integration', 'Medium', 'Open', false, current_date - 3, 'Integration issue: meter data import failing.', '', array['Integration troubleshooting guide']::text[], null),
  ('4805', 'meridian', 'Route optimizer timing out', 'Performance', 'Medium', 'Open', false, current_date - 2, 'Performance issue: route optimizer timing out.', '', array['Performance troubleshooting guide']::text[], null),
  ('4806', 'solano', 'Order API returning 500 errors', 'API', 'High', 'Resolved', false, current_date - 1, 'API issue: order api returning 500 errors.', '', array['API troubleshooting guide']::text[], 'Bug was found and it got fixed'),
  ('4808', 'cobalt', 'Invoice PDF shows wrong VAT', 'Billing', 'Medium', 'Open', false, current_date - 3, 'Billing issue: invoice pdf shows wrong vat.', '', array['Billing troubleshooting guide']::text[], null),
  ('4810', 'harbor', 'POS sync dropping orders', 'Integration', 'High', 'Open', false, current_date - 2, 'Integration issue: pos sync dropping orders.', '', array['Integration troubleshooting guide']::text[], null),
  ('4812', 'northstar', 'Reporting dashboard not syncing', 'Integration', 'High', 'Open', false, current_date - 1, 'Recurring integration failure blocking Northstar’s reporting workflow. Customer is frustrated and references a board review on Thursday.', '', array['Refreshing TMS connector tokens', 'Reporting sync recovery checklist']::text[], null),
  ('4813', 'harbor', 'Stores cannot take card payments after POS update', 'Integration', 'High', 'Escalated', false, current_date - 1, 'Integration issue: card payments failing in stores after the POS update.', '', array['Integration troubleshooting guide']::text[], null),
  ('4814', 'vireo', 'Patient intake submissions lost on submit', 'Data quality', 'High', 'Escalated', false, current_date - 1, 'Data quality issue: completed intake forms disappear on submit.', '', array['Data quality troubleshooting guide']::text[], null),
  ('4815', 'atlas', 'Temperature breach alerts not delivered overnight', 'Alerts', 'High', 'Open', false, current_date - 2, 'Alerts issue: overnight temperature breach alerts never arrived.', '', array['Alerts troubleshooting guide']::text[], null),
  ('4816', 'meridian', 'Drivers logged out of the app mid-route', 'Mobile', 'Medium', 'Open', true, current_date - 2, 'Mobile issue: drivers are signed out mid-route. Previously fixed, now reopened.', '', array['Mobile troubleshooting guide']::text[], null),
  ('4817', 'solano', 'Order API creating duplicate orders', 'API', 'Medium', 'Open', false, current_date - 1, 'API issue: retried order calls create duplicate orders.', '', array['API troubleshooting guide']::text[], null),
  ('4818', 'cobalt', 'Invoices sent with duplicate port charges', 'Billing', 'Medium', 'Open', false, current_date - 3, 'Billing issue: October invoices list port charges twice.', '', array['Billing troubleshooting guide']::text[], null),
  ('4819', 'northstar', 'Shipment ETA notifications show wrong times', 'Integration', 'Medium', 'Open', false, current_date, 'Integration issue: customer ETA notifications are hours off.', '', array['Integration troubleshooting guide']::text[], null),
  ('4820', 'lumen', 'Meter readings imported with wrong timestamps', 'Integration', 'Medium', 'Open', false, current_date - 2, 'Integration issue: imported meter readings are shifted by one hour.', '', array['Integration troubleshooting guide']::text[], null),
  ('4821', 'pinecrest', 'Appointments double-booked after calendar sync', 'Scheduling', 'Medium', 'Open', false, current_date - 1, 'Scheduling issue: calendar sync creates double bookings.', '', array['Scheduling troubleshooting guide']::text[], null),
  ('4822', 'quarry', 'Monthly invoice report missing October data', 'Reporting', 'Medium', 'Open', false, current_date, 'Reporting issue: the monthly invoice report stops at 30 September.', '', array['Reporting troubleshooting guide']::text[], null)
on conflict (id) do nothing;
--> statement-breakpoint

insert into public.ticket_messages (id, ticket_id, author_name, from_customer, body, sent_at) values
  ('m-4690-1', '4690', 'Mila Novak', true, 'Password reset emails are taking 10–15 minutes to arrive. Not urgent, just confusing for new staff.', now() - interval '24 days'),
  ('m-4702-1', '4702', 'Ines Duarte', true, 'An invite link we sent to a new colleague had expired by the time she tried it. Could you resend it, or tell us how long links stay valid?', now() - interval '21 days'),
  ('m-4711-1', '4711', 'Sam Okoro', true, 'Some patients received their appointment reminder SMS twice yesterday. No harm done, just letting you know.', now() - interval '20 days'),
  ('m-4720-1', '4720', 'Carl Brandt', true, 'The monthly fuel report rounds litres to whole numbers, so totals are a few litres off from our fuel cards. A small thing, but our auditor noticed.', now() - interval '18 days'),
  ('m-4733-1', '4733', 'Ravi Shah', true, 'On our wall screen the temperature widget slightly overlaps the map. Purely cosmetic.', now() - interval '15 days'),
  ('m-4741-1', '4741', 'Priya Nair', true, 'Two dispatchers on brand-new laptops get stuck in an SSO login loop. They can log in from a private browser window in the meantime, so it isn''t blocking anyone.', now() - interval '12 days'),
  ('m-4745-1', '4745', 'Lucía Ortega', true, 'Our invoice email bounced because we changed our accounts address. Please update it to the new address we sent to billing.', now() - interval '14 days'),
  ('m-4752-1', '4752', 'Tom Ellery', true, 'The 20% autumn promotion isn''t being applied at the till in about a third of our stores again, the same problem as last month. Cashiers are applying it by hand, which is slowing down queues.', now() - interval '11 days'),
  ('m-4760-1', '4760', 'Dr. Hana Mori', true, 'The audit log export only includes the last 30 days. We need the full year for our annual review in December, so no rush.', now() - interval '9 days'),
  ('m-4766-1', '4766', 'Priya Nair', true, 'The CSV export is missing the carrier and delivery-date columns again. Our analysts can rebuild them from the dashboard, but it adds a couple of hours to the weekly report.', now() - interval '7 days'),
  ('m-4770-1', '4770', 'Ines Duarte', true, 'Port ETA updates for Rotterdam and Antwerp are arriving 2–3 hours late again. Our planners can still check the port websites, but it''s double work.', now() - interval '7 days'),
  ('m-4776-1', '4776', 'Mila Novak', true, 'Our logo looks a bit blurry on the PDF reports. Could we upload a higher-resolution version at some point?', now() - interval '7 days'),
  ('m-4779-1', '4779', 'Carl Brandt', true, 'The driver app has started crashing again on phones updated to Android 15, about 12 of our 200 drivers. They can keep working on spare devices for now, but we''re running out of spares.', now() - interval '6 days'),
  ('m-4781-1', '4781', 'Greta Lind', true, 'We''re not sure what the difference is between the ''Editor'' and ''Manager'' roles. Is there documentation we can share with our team?', now() - interval '6 days'),
  ('m-4784-1', '4784', 'Lucía Ortega', true, 'Logging in to the supplier portal takes 30–40 seconds for our suppliers since last week. Once they''re in, everything works normally.', now() - interval '6 days'),
  ('m-4788-1', '4788', 'Sam Okoro', true, 'Calendar invites for staff training show times in UTC instead of local time. People are working it out, but it would be nice to fix.', now() - interval '6 days'),
  ('m-4790-1', '4790', 'Priya Nair', true, 'About 10% of shipment-status webhooks are failing to reach our system again. Our nightly reconciliation catches most of them, but customers see stale statuses during the day.', now() - interval '4 days'),
  ('m-4795-1', '4795', 'Tom Ellery', true, 'Inventory counts are off for a handful of items in 5 stores since Monday''s sync. Store managers have corrected them by hand, but we''d like to understand why it happened.', now() - interval '5 days'),
  ('m-4795-2', '4795', 'Tom Ellery', true, 'It hasn''t happened again since Tuesday, but please let us know if you find the cause.', now() - interval '117 hours'),
  ('m-4799-1', '4799', 'Ravi Shah', true, 'Temperature alerts are arriving 10–15 minutes after the reading instead of within a minute. Nothing has gone out of range yet, but we rely on fast alerts for pharma storage.', now() - interval '5 days'),
  ('m-4801-1', '4801', 'Dr. Hana Mori', true, 'The intake form takes about 20 seconds to open on our waiting-room tablets in the mornings. Patients are getting through, but the front desk is apologising a lot.', now() - interval '4 days'),
  ('m-4803-1', '4803', 'Greta Lind', true, 'The nightly import from one of our three meter providers has failed twice this week. Re-running it manually worked, but we can''t keep doing that every morning.', now() - interval '3 days'),
  ('m-4805-1', '4805', 'Carl Brandt', true, 'The route optimizer has timed out twice this week during the morning planning run. Re-running it a few minutes later worked, but it delays our planners by about 20 minutes.', now() - interval '2 days'),
  ('m-4805-2', '4805', 'Carl Brandt', true, 'Could you check whether something changed on your side? It started after last week''s update.', now() - interval '46 hours'),
  ('m-4806-1', '4806', 'Lucía Ortega', true, 'Our order API calls have returned 500 errors since 6 am. No webshop orders are reaching you, and about 300 orders are waiting for today''s deliveries.', now() - interval '1 day'),
  ('m-4808-1', '4808', 'Ines Duarte', true, 'The PDF invoices show 21% VAT on transport lines that should be zero-rated. The totals in the portal are correct, so it''s only the PDFs, but customers are asking questions.', now() - interval '3 days'),
  ('m-4810-1', '4810', 'Tom Ellery', true, 'Since the weekend, about 1 in 20 sales from our stores never reaches the central system. Those orders are missing from stock and revenue reports, and click-and-collect customers arrive to find nothing ready.', now() - interval '2 days'),
  ('m-4810-2', '4810', 'Tom Ellery', true, 'Finance can''t close the week with sales missing. Please confirm whether the dropped orders can be recovered.', now() - interval '46 hours'),
  ('m-4812-1', '4812', 'Priya Nair', true, 'Our reporting dashboard stopped pulling shipment data from the TMS integration this morning. Dispatch can’t see delivery status and we’re flying blind.', now() - interval '1 day'),
  ('m-4812-2', '4812', 'Mara Okafor', false, 'Thanks Priya — I can see the failed sync jobs. Pulling the integration logs now.', now() - interval '1425 minutes'),
  ('m-4812-3', '4812', 'Priya Nair', true, 'This is the third integration problem in two weeks. Can someone confirm it’s properly fixed before our board review on Thursday?', now() - interval '1410 minutes'),
  ('m-4813-1', '4813', 'Tom Ellery', true, 'Since last night''s POS update, 40 of our stores can''t take card payments at all. Tills show "terminal not paired". We''re turning customers away on a Saturday.', now() - interval '26 hours'),
  ('m-4813-2', '4813', 'Mara Okafor', false, 'Tom, this is our top priority. I''ve escalated it to the integrations team and we''re checking the update rollout now.', now() - interval '25 hours'),
  ('m-4813-3', '4813', 'Tom Ellery', true, 'It''s now 52 stores. We need a workaround today, even if it means rolling back the update.', now() - interval '20 hours'),
  ('m-4814-1', '4814', 'Dr. Hana Mori', true, 'Patients are completing intake forms on the tablets, but after they press submit the records are gone. Front desk is re-entering everything by hand and we''re worried about losing allergy information.', now() - interval '30 hours'),
  ('m-4814-2', '4814', 'Dr. Hana Mori', true, 'Our compliance officer needs to know whether any submitted data was stored anywhere before it disappeared.', now() - interval '22 hours'),
  ('m-4815-1', '4815', 'Ravi Shah', true, 'One of our freezer rooms went above -15°C for three hours on Wednesday night and nobody got an alert. We found out from the morning check. We had to write off part of a pharma shipment.', now() - interval '50 hours'),
  ('m-4815-2', '4815', 'Mara Okafor', false, 'Ravi, I''m very sorry. I''ve escalated this and asked the team to check alert delivery for all your sites overnight.', now() - interval '2 days'),
  ('m-4816-1', '4816', 'Carl Brandt', true, 'A few drivers, about 8 of our 200, are being logged out of the app mid-route again since this week''s release, the same issue as in September. Logging back in restores their stop list, so routes continue, but it''s frustrating for them.', now() - interval '44 hours'),
  ('m-4817-1', '4817', 'Lucía Ortega', true, 'Occasionally, when the order API is slow, our retry creates a duplicate order: three cases this week. Our warehouse catches them before picking, but we''d like to stop the duplicates.', now() - interval '28 hours'),
  ('m-4818-1', '4818', 'Ines Duarte', true, 'Two of our October invoices list the port handling charge twice. Our finance team is holding just those two invoices until corrected ones arrive.', now() - interval '70 hours'),
  ('m-4819-1', '4819', 'Priya Nair', true, 'ETA notifications for shipments to the UK are showing times an hour off since the clocks changed. Other regions are fine, and customers can see the correct time on the tracking page.', now() - interval '4 hours'),
  ('m-4820-1', '4820', 'Greta Lind', true, 'Readings from one of our meter providers are imported with timestamps an hour off since the clock change. We correct them before monthly billing, so customers aren''t affected yet.', now() - interval '46 hours'),
  ('m-4821-1', '4821', 'Sam Okoro', true, 'Since we connected the calendar sync, we''ve had two double bookings this week with the same doctor. Reception spotted both in time, and we''ve paused the sync for one clinic while you look.', now() - interval '27 hours'),
  ('m-4822-1', '4822', 'Mila Novak', true, 'The monthly invoice report stops at 30 September. We can pull October''s invoices from the invoice list for now, but we''d like the report fixed before our month-end close next week.', now() - interval '3 hours')
on conflict (id) do nothing;
--> statement-breakpoint

insert into public.follow_ups (id, account_id, type, reason, owner, due_date, status, completed_at) values
  ('f5', 'atlas', 'Customer check-in', 'Quarterly health check.', 'You', current_date - 8, 'Done', now() - interval '8 days'),
  ('f3', 'meridian', 'Customer check-in', 'Review driver app stability after Android release.', 'You', current_date - 5, 'Open', null),
  ('f1', 'harbor', 'Recovery plan', 'Agree a recovery plan for POS and inventory sync issues before peak season.', 'You', current_date - 4, 'Open', null),
  ('f6', 'northstar', 'Customer check-in', 'Walk Priya through the fix plan for the recurring webhook and dashboard sync failures.', 'You', current_date - 2, 'Open', null),
  ('f2', 'solano', 'Executive outreach', 'Reassure leadership after order API instability.', 'You', current_date - 1, 'Open', null),
  ('f4', 'cobalt', 'Customer check-in', 'Confirm VAT fix and ETA feed latency.', 'You', current_date + 3, 'Open', null)
on conflict (id) do nothing;
--> statement-breakpoint

insert into public.timeline_events (id, account_id, occurred_at, title, detail, kind) values
  ('e-4690', 'quarry', now() - interval '24 days', '#4690 opened', 'Password reset email delayed — Authentication, low priority', 'ticket'),
  ('e-4702', 'cobalt', now() - interval '21 days', '#4702 opened', 'User invite link expired — Authentication, low priority', 'ticket'),
  ('e-4711', 'pinecrest', now() - interval '20 days', '#4711 opened', 'Reminder SMS duplicated — Notifications, low priority', 'ticket'),
  ('e-4720', 'meridian', now() - interval '18 days', '#4720 opened', 'Fuel report rounding error — Reporting, low priority', 'ticket'),
  ('e-4733', 'atlas', now() - interval '15 days', '#4733 opened', 'Dashboard widget misaligned — UI, low priority', 'ticket'),
  ('e-4745', 'solano', now() - interval '14 days', '#4745 opened', 'Invoice email bounced — Billing, low priority', 'ticket'),
  ('e-4741', 'northstar', now() - interval '12 days', '#4741 opened', 'SSO login loop for dispatch team — Authentication, low priority', 'ticket'),
  ('e-4752', 'harbor', now() - interval '11 days', '#4752 reopened', 'Promo pricing not applied — Billing, medium priority', 'ticket'),
  ('e-4760', 'vireo', now() - interval '9 days', '#4760 opened', 'Audit log export incomplete — Data export, low priority', 'ticket'),
  ('e-4766', 'northstar', now() - interval '7 days', '#4766 reopened', 'CSV export missing shipment columns — Data export, medium priority', 'ticket'),
  ('e-4770', 'cobalt', now() - interval '7 days', '#4770 reopened', 'Port ETA feed delayed — Integration, medium priority', 'ticket'),
  ('e-4776', 'quarry', now() - interval '7 days', '#4776 opened', 'Report logo appears blurry — Reporting, low priority', 'ticket'),
  ('e-4779', 'meridian', now() - interval '6 days', '#4779 reopened', 'Driver app crashes on Android 15 — Mobile, medium priority', 'ticket'),
  ('e-4781', 'lumen', now() - interval '6 days', '#4781 opened', 'User role permissions unclear — Admin, low priority', 'ticket'),
  ('e-4784', 'solano', now() - interval '6 days', '#4784 opened', 'Supplier portal login slow — Performance, medium priority', 'ticket'),
  ('e-4788', 'pinecrest', now() - interval '6 days', '#4788 opened', 'Calendar invites show wrong timezone — Scheduling, low priority', 'ticket'),
  ('e-4795', 'harbor', now() - interval '5 days', '#4795 opened', 'Inventory counts mismatched — Data quality, medium priority', 'ticket'),
  ('e-4799', 'atlas', now() - interval '5 days', '#4799 opened', 'Temperature alerts delayed — Alerts, medium priority', 'ticket'),
  ('e-4790', 'northstar', now() - interval '4 days', '#4790 reopened', 'Webhook delivery failures — Integration, medium priority', 'ticket'),
  ('e-4801', 'vireo', now() - interval '4 days', '#4801 opened', 'Patient intake form loads slowly — Performance, medium priority', 'ticket'),
  ('e-4803', 'lumen', now() - interval '3 days', '#4803 opened', 'Meter data import failing — Integration, medium priority', 'ticket'),
  ('e-4808', 'cobalt', now() - interval '3 days', '#4808 opened', 'Invoice PDF shows wrong VAT — Billing, medium priority', 'ticket'),
  ('e-4818', 'cobalt', now() - interval '70 hours', '#4818 opened', 'Invoices sent with duplicate port charges — Billing, medium priority', 'ticket'),
  ('e-4815', 'atlas', now() - interval '50 hours', '#4815 opened', 'Temperature breach alerts not delivered overnight — Alerts, high priority', 'ticket'),
  ('e-4805', 'meridian', now() - interval '2 days', '#4805 opened', 'Route optimizer timing out — Performance, medium priority', 'ticket'),
  ('e-4810', 'harbor', now() - interval '2 days', '#4810 opened', 'POS sync dropping orders — Integration, high priority', 'ticket'),
  ('e-4815-esc', 'atlas', now() - interval '2 days', '#4815 escalated', 'Escalated to Tier-2', 'ticket'),
  ('e-4820', 'lumen', now() - interval '46 hours', '#4820 opened', 'Meter readings imported with wrong timestamps — Integration, medium priority', 'ticket'),
  ('e-4816', 'meridian', now() - interval '44 hours', '#4816 reopened', 'Drivers logged out of the app mid-route — Mobile, medium priority', 'ticket'),
  ('e-4814', 'vireo', now() - interval '30 hours', '#4814 opened', 'Patient intake submissions lost on submit — Data quality, high priority', 'ticket'),
  ('e-4814-esc', 'vireo', now() - interval '29 hours', '#4814 escalated', 'Escalated to Tier-2', 'ticket'),
  ('e-4817', 'solano', now() - interval '28 hours', '#4817 opened', 'Order API creating duplicate orders — API, medium priority', 'ticket'),
  ('e-4821', 'pinecrest', now() - interval '27 hours', '#4821 opened', 'Appointments double-booked after calendar sync — Scheduling, medium priority', 'ticket'),
  ('e-4813', 'harbor', now() - interval '26 hours', '#4813 opened', 'Stores cannot take card payments after POS update — Integration, high priority', 'ticket'),
  ('e-4813-esc', 'harbor', now() - interval '25 hours', '#4813 escalated', 'Escalated to Tier-2', 'ticket'),
  ('e-4806', 'solano', now() - interval '1 day', '#4806 opened', 'Order API returning 500 errors — API, high priority', 'ticket'),
  ('e-4812', 'northstar', now() - interval '1 day', '#4812 opened', 'Reporting dashboard not syncing — Integration, high priority', 'ticket'),
  ('e-4819', 'northstar', now() - interval '4 hours', '#4819 opened', 'Shipment ETA notifications show wrong times — Integration, medium priority', 'ticket'),
  ('e-4822', 'quarry', now() - interval '3 hours', '#4822 opened', 'Monthly invoice report missing October data — Reporting, medium priority', 'ticket'),
  ('e-4810-open', 'harbor', now(), '#4810 open', 'Status set to Open', 'ticket'),
  ('e-4815-open', 'atlas', now(), '#4815 open', 'Status set to Open', 'ticket'),
  ('e-4806-resolved', 'solano', now() - interval '34 minutes', '#4806 resolved', 'Resolved by You · Note: Bug was found and it got fixed', 'ticket')
on conflict (id) do nothing;
