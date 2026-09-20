// supabase/functions/send-notification/index.ts
// SendMe — Email Notification Edge Function
//
// Sends templated transactional emails via Resend for key SendMe events.
// Deploy with: supabase functions deploy send-notification
// Requires secret: supabase secrets set RESEND_API_KEY=re_xxxxxxxx
//
// Call from the app like:
//   await supabase.functions.invoke('send-notification', {
//     body: { type: 'application_approved', to: 'missionary@email.com', data: { missionName: 'Samuel', missionTitle: '...' } }
//   });

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// ── IMPORTANT: update this once your domain is verified in Resend ──
const FROM_ADDRESS = "SendMe Global Mission <notifications@sendmeglobalmission.org>";

// Fallback link used only when a template's caller doesn't pass a specific
// URL. Previously hardcoded per-template as "https://sendme-nine.vercel.app"
// (the old Vercel subdomain, dead since the sendmeglobalmission.org
// migration) — every one of those fallbacks below is now this constant so
// there's exactly one place to update if the domain ever changes again.
const SITE_URL = "https://sendmeglobalmission.org";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Shared email shell — dark navy/gold theme matching the app ──
// NOTE: built with nested <table> + bgcolor attributes (not CSS background on <div>)
// because Outlook desktop/Windows Mail render via the Word engine, which strips
// div background colors, border-radius, linear-gradient, and centered max-width
// containers. Tables + bgcolor are the only reliably cross-client approach for HTML email.
// #100 — some pastors' stored display names already include "Pastor" (e.g.
// "Pastor Donnie"), while others just store a plain first name. Templates
// that hardcode "Dear Pastor {name}" produced "Dear Pastor Pastor Donnie"
// for the former group. This strips any leading title before re-adding
// "Pastor" once, consistently, regardless of how the name was originally
// entered.
function withPastorTitle(name?: string): string {
  const clean = (name || "").trim();
  if (!clean) return "Pastor";
  const stripped = clean.replace(/^(pastor|pr|rev(?:erend)?|bishop)\.?\s+/i, "");
  return `Pastor ${stripped}`;
}

function wrapEmail(title: string, bodyHtml: string, ctaText?: string, ctaUrl?: string) {
  return `
  <!--[if mso]>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#060c18"><tr><td align="center">
  <![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#060c18" style="background:#060c18;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" bgcolor="#0c1628" style="max-width:560px;width:100%;background:#0c1628;border:1px solid #1c2942;">
          <tr>
            <td align="center" bgcolor="#09111f" style="background:#09111f;padding:28px 32px;border-bottom:1px solid #1c2942;">
              <span style="font-family:Georgia,serif;font-size:28px;font-weight:800;color:#ffffff;">Send<span style="color:#e8b34b;">Me</span></span><br/>
              <span style="font-family:Georgia,serif;font-size:10px;color:#8a94ab;letter-spacing:3px;">GLOBAL MISSION FUND</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-family:Georgia,serif;">
              <div style="font-size:18px;font-weight:700;color:#eef1ff;margin-bottom:16px;">${title}</div>
              <div style="font-size:14px;color:#b7bfd1;line-height:1.8;">${bodyHtml}</div>
              ${ctaText && ctaUrl ? `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
                <tr>
                  <td align="center" bgcolor="#e8b34b" style="background:#e8b34b;border-radius:10px;">
                    <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;font-family:Georgia,serif;font-size:14px;font-weight:700;color:#000000;text-decoration:none;">${ctaText}</a>
                  </td>
                </tr>
              </table>` : ""}
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#0c1628" style="padding:20px 32px;border-top:1px solid #1c2942;font-family:Georgia,serif;">
              <span style="font-size:12px;color:#e8b34b;font-style:italic;">"Here am I Lord, send me." — Isaiah 6:8</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <!--[if mso]>
  </td></tr></table>
  <![endif]-->`;
}

// ── Templates ──
const TEMPLATES: Record<string, (d: any) => { subject: string; html: string }> = {
  church_approved: (d) => ({
    subject: `${d.churchName} is now verified on SendMe! ✝`,
    html: wrapEmail(
      "Your Church is Verified",
      `Dear ${d.pastorName || "Pastor"},<br/><br/>
      Praise God! <strong style="color:#e8b34b;">${d.churchName}</strong> has been reviewed and verified by SendMe.
      Your church now appears in the public Message Church &amp; Organization Directory, and can be selected
      by missionaries applying to SendMe as their sending church.<br/><br/>
      Thank you for standing with the end-time Message and with those SendMe sends into the field.`,
      "View the Directory", d.directoryUrl || SITE_URL
    ),
  }),

  mission_completed: (d) => ({
    subject: `"${d.missionTitle}" is complete — thank you for your faithfulness! 🏆`,
    html: wrapEmail(
      "Mission Complete",
      `Dear ${d.missionaryName || "brother/sister"},<br/><br/>
      Praise God! <strong style="color:#e8b34b;">${d.missionTitle}</strong> has been marked complete by SendMe.
      Every milestone was reached, verified, and funded — and now your story becomes a permanent testimony
      for the Body to see what the Lord has done through your faithfulness.<br/><br/>
      Thank you for saying "Here am I, send me."`,
      "View Testimonies", d.testimonyUrl || SITE_URL
    ),
  }),

  application_approved: (d) => ({
    subject: `Your mission "${d.missionTitle}" has been approved! ✝`,
    html: wrapEmail(
      "Your Mission is Approved",
      `Dear ${d.missionaryName || "brother/sister"},<br/><br/>
      Praise God! Your application for <strong style="color:#e8b34b;">${d.missionTitle}</strong> has been reviewed and approved by SendMe.
      Your mission is now live and visible to donors on the platform.<br/><br/>
      Funds will be released to your church as you reach and submit proof for each milestone.`,
      "View My Dashboard", d.dashboardUrl || SITE_URL
    ),
  }),

  application_rejected: (d) => ({
    subject: `Update on your SendMe application`,
    html: wrapEmail(
      "Application Update",
      `Dear ${d.missionaryName || "brother/sister"},<br/><br/>
      Thank you for submitting your application for <strong>${d.missionTitle}</strong>. After review,
      we're not able to approve it at this time.<br/><br/>
      ${d.reason ? `<div style="background:rgba(232,91,91,0.08);border:1px solid rgba(232,91,91,0.2);border-radius:10px;padding:14px 16px;margin-top:8px;"><strong style="color:#e85b5b;">Reason given:</strong> ${d.reason}</div>` : "Please reach out to SendMe support for more detail."}
      <br/>You're welcome to update your application and resubmit.`,
    ),
  }),

  proof_submitted: (d) => ({
    subject: `New milestone proof awaiting your review — ${d.missionTitle}`,
    html: wrapEmail(
      "Milestone Proof Submitted",
      `Dear ${withPastorTitle(d.pastorName)},<br/><br/>
      ${d.missionaryName || "Your missionary"} has submitted proof for milestone ${d.milestoneNumber} of
      <strong style="color:#e8b34b;">${d.missionTitle}</strong>. Please review and approve so the next
      milestone's funds can be released.`,
      "Review Proof Now", d.reviewUrl || SITE_URL
    ),
  }),

  proof_approved: (d) => ({
    subject: `Milestone ${d.milestoneNumber} approved — funds releasing ✝`,
    html: wrapEmail(
      "Milestone Proof Approved",
      `Dear ${d.missionaryName || "brother/sister"},<br/><br/>
      Your pastor has reviewed and <strong style="color:#3ecf8e;">approved</strong> your proof for milestone
      ${d.milestoneNumber} of <strong style="color:#e8b34b;">${d.missionTitle}</strong>. Funds for this
      milestone are being released to your church.<br/><br/>
      Keep pressing forward in the work — your next milestone begins now.`,
      "View My Dashboard", d.dashboardUrl || SITE_URL
    ),
  }),

  proof_rejected: (d) => ({
    subject: `Milestone ${d.milestoneNumber} proof needs revision`,
    html: wrapEmail(
      "Milestone Proof Needs Revision",
      `Dear ${d.missionaryName || "brother/sister"},<br/><br/>
      Your pastor reviewed your proof for milestone ${d.milestoneNumber} of
      <strong style="color:#e8b34b;">${d.missionTitle}</strong> and has asked for some changes before it can be approved.<br/><br/>
      ${d.reason ? `<div style="background:rgba(232,179,75,0.08);border:1px solid rgba(232,179,75,0.2);border-radius:10px;padding:14px 16px;margin-top:8px;"><strong style="color:#e8b34b;">Pastor's notes:</strong> ${d.reason}</div>` : ""}`,
      "Resubmit Proof", d.resubmitUrl || SITE_URL
    ),
  }),

  admin_proof_submitted: (d) => ({
    subject: `Milestone proof submitted — ${d.missionTitle} 📋`,
    html: wrapEmail(
      "Milestone Proof Submitted",
      `<strong>${d.missionaryName || "A missionary"}</strong> has submitted proof for milestone
      <strong style="color:#e8b34b;">${d.milestoneNumber}</strong> of <strong>${d.missionTitle}</strong>,
      for review by ${d.pastorName ? `Pastor ${d.pastorName}` : "their pastor"}.<br/><br/>
      This is for your visibility only — approval happens on the pastor's side. Nothing is required
      from you unless the pastor reaches out for help.`,
      "View in Admin", d.adminUrl || SITE_URL
    ),
  }),

  donation_received: (d) => ({
    subject: `A new gift of $${d.amount} for ${d.missionTitle} 🙏`,
    html: wrapEmail(
      "New Donation Received",
      `Praise God! A gift of <strong style="color:#e8b34b;">$${d.amount}</strong> has just been given toward
      <strong>${d.missionTitle}</strong>${d.donorName ? ` by ${d.donorName}` : " by an anonymous donor"}.<br/><br/>
      ${d.donorEmail ? `<div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:10px;">✉ <a href="mailto:${d.donorEmail}" style="color:#e8b34b;">${d.donorEmail}</a>${d.isGuest ? ` <span style="color:rgba(255,255,255,0.35);">(guest checkout — no SendMe account)</span>` : ""}</div>` : ""}
      Total raised so far: <strong style="color:#e8b34b;">$${d.totalRaised} of $${d.goal}</strong>.`,
      "View Mission", d.missionUrl || SITE_URL
    ),
  }),

  payout_sent: (d) => ({
    subject: `Payout sent for ${d.missionTitle}`,
    html: wrapEmail(
      "Payout Sent",
      `Dear ${d.recipientName || "brother/sister"},<br/><br/>
      A payout of <strong style="color:#e8b34b;">$${d.amount}</strong> for <strong>${d.missionTitle}</strong>
      has been sent to the banking details on file. Please allow a few business days for it to reflect.<br/><br/>
      Thank you for your faithful service in the field.`,
    ),
  }),

  reference_confirmation: (d) => ({
    subject: `Church Reference Confirmation Request — ${d.churchName}`,
    html: wrapEmail(
      "Reference Confirmation Request",
      `Dear ${d.referenceName || "brother/sister"},<br/><br/>
      You have been listed as a pastoral reference for <strong style="color:#e8b34b;">${d.churchName}</strong>
      (${d.city || ""}, ${d.country || ""}), whose senior pastor is
      <strong>${d.pastorName || "listed pastor"}</strong>, who has applied to join the
      <strong>SendMe Global Mission Fund</strong> network of verified Message-believing churches.<br/><br/>
      <div style="background:rgba(232,179,75,0.08);border:1px solid rgba(232,179,75,0.25);border-radius:12px;padding:16px 18px;margin:16px 0;">
        <strong style="color:#e8b34b;">We are asking you to confirm the following:</strong><br/>
        <ul style="color:rgba(255,255,255,0.6);margin:10px 0;padding-left:20px;line-height:2;">
          <li>You personally know Pastor ${d.pastorName || "this pastor"}</li>
          <li>This church holds to the end-time Message of William Branham</li>
          <li>The church is a legitimate, active congregation</li>
          <li>You recommend them for endorsement on the SendMe platform</li>
        </ul>
      </div>
      To confirm, simply reply to this email with <strong>"I confirm"</strong> or contact SendMe admin directly at
      <a href="mailto:${d.adminEmail || "sendmemissionfund@gmail.com"}" style="color:#e8b34b;">${d.adminEmail || "sendmemissionfund@gmail.com"}</a>.<br/><br/>
      If you cannot confirm or have concerns about this church, please reply and let us know.<br/><br/>
      Thank you for helping us maintain the integrity of the SendMe network. God bless you.`,
    ),
  }),

  worker_response_notify: (d) => ({
    subject: `Someone can help with "${d.requestTitle}" ✝`,
    html: wrapEmail(
      "A Church Has Responded to Your Worker Request",
      `Dear ${d.churchName || "Pastor"},<br/><br/>
      Great news! Someone has responded to your worker request on SendMe:<br/><br/>
      <div style="background:rgba(232,179,75,0.08);border:1px solid rgba(232,179,75,0.25);border-radius:12px;padding:16px 18px;margin:16px 0;">
        <strong style="color:#e8b34b;">${d.requestTitle}</strong>
      </div>
      <strong style="color:#eef1ff;">They shared:</strong><br/>
      ${d.commitment ? `${d.commitment}<br/>` : "They are willing to help.<br/>"}
      ${d.note ? `<div style="color:rgba(255,255,255,0.6);font-style:italic;margin-top:8px;">"${d.note}"</div>` : ""}
      <br/>
      <strong style="color:#eef1ff;">You can reach them directly at:</strong><br/>
      ${d.responderEmail || "contact SendMe admin for details"}${d.responderPhone ? " / " + d.responderPhone : ""}`,
    ),
  }),

  emergency_response_notify: (d) => ({
    subject: `Emergency Response — ${d.requestTitle} 🚨`,
    html: wrapEmail(
      "Someone Has Responded to an Emergency Request",
      `<div style="background:rgba(232,91,91,0.08);border:1px solid rgba(232,91,91,0.25);border-radius:12px;padding:16px 18px;margin-bottom:16px;">
        <strong style="color:#e85b5b;">${d.requestTitle}</strong>
      </div>
      <strong style="color:#eef1ff;">${d.responderName}</strong> (${d.responderEmail}${d.responderPhone ? " · " + d.responderPhone : ""})
      has responded to this emergency request.<br/><br/>
      <strong style="color:#eef1ff;">Amount offered:</strong> ${d.amount ? "$" + d.amount : "not specified"}<br/>
      ${d.note ? `<strong style="color:#eef1ff;">Note:</strong> ${d.note}` : ""}`,
    ),
  }),

  contact_form: (d) => ({
    subject: `SendMe FAQ Contact — ${d.name || "Anonymous"}`,
    html: wrapEmail(
      "New Contact Form Message",
      `<strong style="color:#eef1ff;">From:</strong> ${d.name || "Anonymous"}
      (${d.email ? `<a href="mailto:${d.email}" style="color:#e8b34b;">${d.email}</a>` : "no email given"})<br/><br/>
      <div style="white-space:pre-wrap;color:rgba(255,255,255,0.75);background:rgba(255,255,255,0.04);border-radius:10px;padding:14px 16px;">${(d.message || "").replace(/\n/g, "<br/>")}</div>`,
    ),
  }),

  banking_request: (d) => ({
    subject: `Action needed: Please submit your church banking details — ${d.missionTitle}`,
    html: wrapEmail(
      "Banking Details Required",
      `Dear ${withPastorTitle(d.pastorName)},<br/><br/>
      A missionary from <strong style="color:#e8b34b;">${d.churchName || "your church"}</strong> has reached
      a funding milestone for the mission <strong style="color:#e8b34b;">${d.missionTitle}</strong> and funds
      are ready to be released.<br/><br/>
      <div style="background:rgba(232,179,75,0.08);border:1px solid rgba(232,179,75,0.25);border-radius:12px;padding:16px 18px;margin:16px 0;">
        <strong style="color:#e8b34b;">⚠ Action required:</strong><br/>
        We do not yet have banking details for your church on file. Please log in to SendMe and submit
        your church's banking details so we can process this payout.
      </div>
      Once submitted, SendMe will transfer the funds directly to your church account within a few business days.
      Your church then passes the funds to the missionary.<br/><br/>
      This is a confidential process — banking details are never shown publicly.`,
      "✝ Submit Banking Details", d.siteUrl || SITE_URL
    ),
  }),

  // Admin-facing — fires alongside the existing WhatsApp notifyAdmin() call,
  // not a replacement for it. Mirrors the data shape already sent to
  // notify-admin's "mission_applied" template in supabase/functions/notify-admin.
  mission_applied: (d) => ({
    subject: `New Mission Application — ${d.missionTitle || "Untitled Mission"}`,
    html: wrapEmail(
      "New Mission Application",
      `A new mission application is awaiting your review.<br/><br/>
      <strong style="color:#e8b34b;">${d.missionTitle || "Untitled Mission"}</strong><br/>
      Applicant: ${d.missionaryName || "unknown"}<br/>
      Country: ${d.country || "unspecified"}<br/>
      Church: ${d.churchName || "unregistered"}<br/><br/>
      Please review and approve or reject this application in Admin → Approvals.`,
      "Review in Admin", d.siteUrl || SITE_URL
    ),
  }),

  // Admin-facing — fires alongside the existing WhatsApp notifyAdmin() call.
  emergency_submitted: (d) => ({
    subject: `🚨 New Emergency Request — ${d.title || "Untitled Request"}`,
    html: wrapEmail(
      "New Emergency Request Submitted",
      `A new emergency request is awaiting your review.<br/><br/>
      <strong style="color:#e8b34b;">${d.title || "Untitled Request"}</strong><br/>
      Country: ${d.country || "unspecified"}<br/>
      Urgency: ${d.urgency || "unspecified"}<br/>
      Funding goal: $${d.goal ?? "unset"}<br/><br/>
      Requests stay hidden from the public list until approved. Please review in Admin → Payouts → Emergency.`,
      "Review in Admin", d.siteUrl || SITE_URL
    ),
  }),

  // Admin-facing — fires alongside the existing WhatsApp notifyAdmin() call
  // in ChurchRegistration.js. Previously this flow only had the WhatsApp
  // ping with no matching admin email, unlike mission_applied above.
  church_registered: (d) => ({
    subject: `New Church Registration — ${d.churchName || "Untitled Church"}`,
    html: wrapEmail(
      "New Church Registration",
      `A new church/organization has registered and is awaiting verification.<br/><br/>
      <strong style="color:#e8b34b;">${d.churchName || "Untitled Church"}</strong><br/>
      Location: ${d.city || "unspecified"}, ${d.country || "unspecified"}<br/>
      Pastor: ${d.pastorName || "unknown"}<br/>
      Email: ${d.pastorEmail || "not provided"}<br/><br/>
      Please review and verify this church in Admin → Churches.`,
      "Review in Admin", d.siteUrl || SITE_URL
    ),
  }),

  // Pastor-facing — sent from AdminChurchVerification.js's reject() action.
  church_rejected: (d) => ({
    subject: `Update on your SendMe church registration`,
    html: wrapEmail(
      "Church Registration Update",
      `Dear ${d.pastorName || "brother/sister"},<br/><br/>
      Thank you for registering <strong>${d.churchName || "your church"}</strong> with SendMe. After review,
      we're not able to verify it at this time.<br/><br/>
      ${d.reason ? `<div style="background:rgba(232,91,91,0.08);border:1px solid rgba(232,91,91,0.2);border-radius:10px;padding:14px 16px;margin-top:8px;"><strong style="color:#e85b5b;">Reason given:</strong> ${d.reason}</div>` : "Please reach out to SendMe support for more detail."}
      <br/>You're welcome to update your details and re-register, or reach out with any questions.`,
    ),
  }),

  // ── Family In Need — admin-facing ──────────────────────────────────────
  // Fires alongside the existing WhatsApp notifyAdmin() call in
  // FamilyNeeds.js, same "email + WhatsApp both fire" pattern as
  // mission_applied/emergency_submitted above. Deliberately gives no
  // applicant name/phone/email — this is a family's private submission,
  // not yet endorsed by anyone, and admin gets full detail in Admin →
  // Family Needs, not by email.
  family_need_submitted: (d) => ({
    subject: `🤝 New Family In Need Submission — ${d.category || "unspecified"}`,
    html: wrapEmail(
      "New Family In Need Submission",
      `A new family need has been submitted and is awaiting pastor endorsement.<br/><br/>
      Category: ${d.category || "unspecified"}<br/>
      Location: ${d.city || "unspecified"}, ${d.country || "unspecified"}<br/>
      Amount needed: $${d.goal ?? "unset"}<br/><br/>
      This will move to your queue once the family's church endorses it. No action needed from you yet.`,
      "View in Admin", SITE_URL
    ),
  }),

  // Pastor-facing — sent from AdminFamilyNeeds.js's publish() action, once
  // admin has written the public summary and made the request live.
  family_need_published: (d) => ({
    subject: `A family need you endorsed is now published ✝`,
    html: wrapEmail(
      "Family Need Published",
      `Dear ${withPastorTitle(d.pastorName)},<br/><br/>
      The <strong style="color:#e8b34b;">${d.category || "family"}</strong> need you endorsed for a family in
      <strong>${d.city || "your area"}</strong> is now published and visible to donors on SendMe.<br/><br/>
      We'll let you know once it's fully funded and ready for payout to your church.`,
      "View SendMe", SITE_URL
    ),
  }),

  // Pastor-facing + admin-facing — sent from AdminFamilyNeeds.js's
  // markFunded() action. Tells the pastor a payout is coming, mirrors
  // banking_request's role for missions (though family needs use the
  // church's banking details already on file, not a fresh request).
  family_need_funded: (d) => ({
    subject: `Family need fully funded — payout coming to your church 🙏`,
    html: wrapEmail(
      "Family Need Fully Funded",
      `Dear ${withPastorTitle(d.pastorName)},<br/><br/>
      Praise God! The <strong style="color:#e8b34b;">${d.category || "family"}</strong> need you endorsed for a
      family in <strong>${d.city || "your area"}</strong> has been fully funded by donors — a total of
      <strong style="color:#e8b34b;">$${d.amount ?? ""}</strong>.<br/><br/>
      SendMe will process the payout to your church's banking details on file. Once you've used the funds to
      help the family, please submit proof (receipts and/or a photo) so this request can be marked complete.`,
      "View SendMe", SITE_URL
    ),
  }),

  // Pastor-facing — sent from PastorFamilyNeedReview.js is NOT where this
  // fires (that screen only sends the endorsement itself to admin, not an
  // email to the pastor) — this is the confirmation sent back to the
  // pastor once their own endorsement has been recorded, so they know it
  // reached SendMe and what happens next.
  family_need_endorsed: (d) => ({
    subject: `Your endorsement was received — ${d.category || "family"} need`,
    html: wrapEmail(
      "Endorsement Received",
      `Dear ${withPastorTitle(d.pastorName)},<br/><br/>
      Thank you — your endorsement for the <strong style="color:#e8b34b;">${d.category || "family"}</strong>
      need in <strong>${d.city || "your area"}</strong> has been recorded. SendMe admin will now write a
      public summary (no names or addresses) and publish it for donors to see.<br/><br/>
      You'll hear from us again once it's published, and once it's fully funded.`,
      "View SendMe", SITE_URL
    ),
  }),

  // Pastor-facing — sent from AdminFamilyNeeds.js's decideProof() action
  // when a submitted proof is rejected and needs resubmission. (On
  // approval, the need simply moves to "complete" — no email needed there,
  // matching how proof_approved is the only side of the milestone-proof
  // cycle that gets an email.)
  family_need_proof_submitted: (d) => ({
    subject: `Proof needs revision — ${d.category || "family"} need`,
    html: wrapEmail(
      "Family Need Proof Needs Revision",
      `Dear ${withPastorTitle(d.pastorName)},<br/><br/>
      SendMe admin reviewed the proof submitted for the <strong style="color:#e8b34b;">${d.category || "family"}</strong>
      need in <strong>${d.city || "your area"}</strong> and has asked for some changes before it can be marked
      complete.<br/><br/>
      ${d.reason ? `<div style="background:rgba(232,179,75,0.08);border:1px solid rgba(232,179,75,0.2);border-radius:10px;padding:14px 16px;margin-top:8px;"><strong style="color:#e8b34b;">Notes:</strong> ${d.reason}</div>` : "Please log in to SendMe and resubmit receipts/photos for this family need."}`,
      "View SendMe", SITE_URL
    ),
  }),
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY secret is not set. Run: supabase secrets set RESEND_API_KEY=re_xxxx");
    }

    const { type, to, data } = await req.json();

    if (!type || !to) {
      return new Response(JSON.stringify({ error: "Missing required fields: type, to" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const template = TEMPLATES[type];
    if (!template) {
      return new Response(JSON.stringify({ error: `Unknown notification type: ${type}` }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = template(data || {});

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        // Without this, a reply defaults to FROM_ADDRESS
        // (notifications@sendmeglobalmission.org) — a sending-only address
        // that isn't actively monitored. This routes replies to the actual
        // Gmail inbox Br Donald checks, same as the admin email destination
        // used elsewhere (church_registered, contact_form, etc).
        reply_to: "sendmemissionfund@gmail.com",
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      return new Response(JSON.stringify({ sent: false, error: resendData }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true, id: resendData.id }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("send-notification error:", err);
    return new Response(JSON.stringify({ sent: false, error: String(err.message || err) }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
