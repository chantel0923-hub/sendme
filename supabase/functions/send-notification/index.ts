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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Shared email shell — dark navy/gold theme matching the app ──
function wrapEmail(title: string, bodyHtml: string, ctaText?: string, ctaUrl?: string) {
  return `
  <div style="background:#060c18;padding:32px 16px;font-family:Georgia,serif;">
    <div style="max-width:560px;margin:0 auto;background:#0c1628;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
      <div style="background:#09111f;padding:28px 32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.07);">
        <div style="font-size:28px;font-weight:800;color:#ffffff;">Send<span style="color:#e8b34b;">Me</span></div>
        <div style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:3px;margin-top:4px;">GLOBAL MISSION FUND</div>
      </div>
      <div style="padding:32px;">
        <div style="font-size:18px;font-weight:700;color:#eef1ff;margin-bottom:16px;">${title}</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.6);line-height:1.8;">${bodyHtml}</div>
        ${ctaText && ctaUrl ? `
        <div style="text-align:center;margin-top:28px;">
          <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#e8b34b,#c8942b);color:#000;font-weight:700;text-decoration:none;font-size:14px;">${ctaText}</a>
        </div>` : ""}
      </div>
      <div style="padding:20px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:12px;color:#e8b34b;font-style:italic;">"Here am I Lord, send me." — Isaiah 6:8</div>
      </div>
    </div>
  </div>`;
}

// ── Templates ──
const TEMPLATES: Record<string, (d: any) => { subject: string; html: string }> = {
  application_approved: (d) => ({
    subject: `Your mission "${d.missionTitle}" has been approved! ✝`,
    html: wrapEmail(
      "Your Mission is Approved",
      `Dear ${d.missionaryName || "brother/sister"},<br/><br/>
      Praise God! Your application for <strong style="color:#e8b34b;">${d.missionTitle}</strong> has been reviewed and approved by SendMe.
      Your mission is now live and visible to donors on the platform.<br/><br/>
      Funds will be released to your church as you reach and submit proof for each milestone.`,
      "View My Dashboard", d.dashboardUrl || "https://sendme-nine.vercel.app"
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
      `Dear Pastor ${d.pastorName || ""},<br/><br/>
      ${d.missionaryName || "Your missionary"} has submitted proof for milestone ${d.milestoneNumber} of
      <strong style="color:#e8b34b;">${d.missionTitle}</strong>. Please review and approve so the next
      milestone's funds can be released.`,
      "Review Proof Now", d.reviewUrl || "https://sendme-nine.vercel.app"
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
      "View My Dashboard", d.dashboardUrl || "https://sendme-nine.vercel.app"
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
      "Resubmit Proof", d.resubmitUrl || "https://sendme-nine.vercel.app"
    ),
  }),

  donation_received: (d) => ({
    subject: `A new gift of $${d.amount} for ${d.missionTitle} 🙏`,
    html: wrapEmail(
      "New Donation Received",
      `Praise God! A gift of <strong style="color:#e8b34b;">$${d.amount}</strong> has just been given toward
      <strong>${d.missionTitle}</strong>${d.donorName ? ` by ${d.donorName}` : " by an anonymous donor"}.<br/><br/>
      Total raised so far: <strong style="color:#e8b34b;">$${d.totalRaised} of $${d.goal}</strong>.`,
      "View Mission", d.missionUrl || "https://sendme-nine.vercel.app"
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
      `Dear Pastor ${d.pastorName || ""},<br/><br/>
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
      "✝ Submit Banking Details", `${d.siteUrl || "https://sendme-nine.vercel.app"}`
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
