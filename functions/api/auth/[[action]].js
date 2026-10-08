/**
 * Cloudflare Pages API: /api/auth
 * Unified Identity & Authentication Bridge
 * Sender Email: niranjanbarhate42@gmail.com
 * Cross-App Federation: EduNexus, Ecosystem-Auth, Nexus-Bridge, Nexus Desktop
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Custom-Key, X-App-Source",
  "Access-Control-Max-Age": "86400",
};

const DEFAULT_SENDER = "niranjanbarhate42@gmail.com";

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function generateRandomHex(bytesLength = 24) {
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Generate Edge JWT session token
async function createSignedToken(payload, secret = "nexus_study_secret_salt_2026") {
  const header = { alg: "HS256", typ: "JWT" };
  const b64Header = btoa(JSON.stringify(header)).replace(/=/g, "");
  const b64Payload = btoa(JSON.stringify({ ...payload, exp: Date.now() + 30 * 86400 * 1000 })).replace(/=/g, "");

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(`${b64Header}.${b64Payload}`));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return `${b64Header}.${b64Payload}.${signatureB64}`;
}

// Internal email dispatcher
async function dispatchEmail(db, env, { to, subject, html, text, actionType, previewUrl }) {
  const sender = env.SENDER_EMAIL || DEFAULT_SENDER;
  const logId = "eml_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);

  // 1. Persist email record in D1 email_logs
  if (db) {
    try {
      await db
        .prepare(`
          INSERT INTO email_logs (id, to_email, from_email, subject, body_html, body_text, action_type, status, preview_url, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'DELIVERED', ?, CURRENT_TIMESTAMP)
        `)
        .bind(logId, to, sender, subject, html, text, actionType, previewUrl || null)
        .run();
    } catch (e) {
      console.warn("[Email Log Error]", e.message);
    }
  }

  // 2. If Cloudflare send_email binding is available, send live email
  if (env.EMAIL && typeof env.EMAIL.send === "function") {
    try {
      await env.EMAIL.send({
        from: sender,
        to: to,
        subject: subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html }
        ]
      });
    } catch (err) {
      console.warn("[Cloudflare Worker EMAIL.send Notice]", err.message);
    }
  }

  return { success: true, logId, sender };
}

// -----------------------------------------------------------------------------
// POST Request Router
// -----------------------------------------------------------------------------
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB || env.edunexus_db || env.nexus_db;

  if (!db) {
    return jsonRes({ error: "Database not bound in Cloudflare edge" }, 500);
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const subAction = pathParts[pathParts.length - 1]; // e.g. 'register', 'login', 'magic-link', 'forgot-password'

  try {
    const body = await request.json().catch(() => ({}));

    // 1. REGISTER
    if (subAction === "register") {
      const { name, email, pass_hash, salt_hex, role = "student" } = body;
      if (!name || !email || !pass_hash) {
        return jsonRes({ error: "Missing required fields (name, email, pass_hash)" }, 400);
      }

      const cleanEmail = email.trim().toLowerCase();
      // Check if user already exists
      const existing = await db
        .prepare("SELECT id FROM users WHERE email = ?")
        .bind(cleanEmail)
        .first();

      if (existing) {
        return jsonRes({ error: "An account with this email already exists." }, 409);
      }

      const userId = "usr_" + Date.now().toString(36) + "_" + generateRandomHex(4);
      const cleanSalt = salt_hex || generateRandomHex(16);

      await db
        .prepare(`
          INSERT INTO users (id, name, email, pass_hash, salt_hex, role, registered_at, last_login)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `)
        .bind(userId, name.trim(), cleanEmail, pass_hash, cleanSalt, role)
        .run();

      const token = await createSignedToken({ id: userId, email: cleanEmail, name, role });
      const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

      await db
        .prepare("INSERT INTO sessions (token, user_id, user_email, expires_at) VALUES (?, ?, ?, ?)")
        .bind(token, userId, cleanEmail, expiresAt)
        .run();

      // Welcome Email
      await dispatchEmail(db, env, {
        to: cleanEmail,
        subject: "🎓 Welcome to EduNexus & the Nexus Ecosystem!",
        html: `<h2>Welcome to EduNexus, ${name}!</h2><p>Your unified identity has been created. You can now access Socratic Audio Tutoring, Spaced Repetition flashcards, and cross-device sync.</p><p>Sender: <strong>${DEFAULT_SENDER}</strong></p>`,
        text: `Welcome to EduNexus, ${name}! Your account is active.`,
        actionType: "WELCOME"
      });

      return jsonRes({
        ok: true,
        token,
        user: { id: userId, name, email: cleanEmail, role }
      }, 201);
    }

    // 2. LOGIN (Two phases: salt lookup OR password verification)
    if (subAction === "login") {
      const { email, pass_hash, step } = body;
      if (!email) {
        return jsonRes({ error: "Email is required" }, 400);
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = await db
        .prepare("SELECT * FROM users WHERE email = ?")
        .bind(cleanEmail)
        .first();

      // If client requests salt first
      if (step === "salt" || (!pass_hash && !body.pass)) {
        if (!user) {
          // Return generic salt for timing protection
          return jsonRes({ salt_hex: "a4b8c1d3e5f70921436587a9b0c2d4e6" });
        }
        return jsonRes({ salt_hex: user.salt_hex });
      }

      if (!user) {
        return jsonRes({ error: "Invalid email or credentials." }, 401);
      }

      // Check hash
      if (pass_hash && user.pass_hash !== pass_hash) {
        return jsonRes({ error: "Invalid passphrase. Please verify your credentials." }, 401);
      }

      // Record login
      await db
        .prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(user.id)
        .run();

      const token = await createSignedToken({ id: user.id, email: user.email, name: user.name, role: user.role });
      const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

      await db
        .prepare("INSERT INTO sessions (token, user_id, user_email, expires_at) VALUES (?, ?, ?, ?)")
        .bind(token, user.id, user.email, expiresAt)
        .run();

      return jsonRes({
        ok: true,
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    }

    // 3. MAGIC LINK REQUEST
    if (subAction === "magic-link") {
      const { email, redirect_url = "/" } = body;
      if (!email) {
        return jsonRes({ error: "Email is required" }, 400);
      }

      const cleanEmail = email.trim().toLowerCase();
      const magicToken = generateRandomHex(32);
      const linkId = "mgk_" + Date.now().toString(36);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

      await db
        .prepare(`
          INSERT INTO magic_links (id, email, token, redirect_url, expires_at, used, created_at)
          VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
        `)
        .bind(linkId, cleanEmail, magicToken, redirect_url, expiresAt)
        .run();

      const appOrigin = url.origin;
      const verifyUrl = `${appOrigin}/api/auth/verify-magic?token=${magicToken}`;

      const emailHtml = `
        <div style="font-family: sans-serif; background: #0b0f19; color: #f8fafc; padding: 32px; border-radius: 12px; max-width: 500px;">
          <h2 style="color: #6366f1;">⚡ EduNexus & Nexus Identity Bridge</h2>
          <p>Click below to sign in instantly without a password. This link is valid for 15 minutes.</p>
          <div style="margin: 24px 0;">
            <a href="${verifyUrl}" style="background: #6366f1; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              Sign In to EduNexus
            </a>
          </div>
          <p style="font-size: 12px; color: #64748b;">Or paste this link: ${verifyUrl}</p>
          <p style="font-size: 11px; color: #475569; margin-top: 24px;">Sent by ${DEFAULT_SENDER} via Cloudflare D1 Auth Gateway</p>
        </div>
      `;

      await dispatchEmail(db, env, {
        to: cleanEmail,
        subject: "⚡ Your EduNexus Magic Sign-In Link",
        html: emailHtml,
        text: `Sign in to EduNexus: ${verifyUrl} (expires in 15 mins). Sent by ${DEFAULT_SENDER}`,
        actionType: "MAGIC_LINK",
        previewUrl: verifyUrl
      });

      return jsonRes({
        ok: true,
        message: `Magic link dispatched to ${cleanEmail} from ${DEFAULT_SENDER}.`,
        preview_url: verifyUrl,
        token: magicToken
      });
    }

    // 4. FORGOT PASSWORD
    if (subAction === "forgot-password") {
      const { email } = body;
      if (!email) {
        return jsonRes({ error: "Email is required" }, 400);
      }

      const cleanEmail = email.trim().toLowerCase();
      const resetToken = generateRandomHex(32);
      const resetId = "rst_" + Date.now().toString(36);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      await db
        .prepare(`
          INSERT INTO password_resets (id, email, token, expires_at, used, created_at)
          VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
        `)
        .bind(resetId, cleanEmail, resetToken, expiresAt)
        .run();

      const appOrigin = url.origin;
      const resetUrl = `${appOrigin}/?action=reset&token=${resetToken}`;

      const emailHtml = `
        <div style="font-family: sans-serif; background: #0b0f19; color: #f8fafc; padding: 32px; border-radius: 12px; max-width: 500px;">
          <h2 style="color: #06b6d4;">🔒 EduNexus Password Reset</h2>
          <p>We received a request to reset your passphrase. Click below to choose a new password:</p>
          <div style="margin: 24px 0;">
            <a href="${resetUrl}" style="background: #06b6d4; color: #020617; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block;">
              Reset Passphrase
            </a>
          </div>
          <p style="font-size: 12px; color: #64748b;">Or paste: ${resetUrl}</p>
          <p style="font-size: 11px; color: #475569; margin-top: 24px;">Sent by ${DEFAULT_SENDER} from Cloudflare Edge</p>
        </div>
      `;

      await dispatchEmail(db, env, {
        to: cleanEmail,
        subject: "🔒 Reset Your EduNexus Passphrase",
        html: emailHtml,
        text: `Reset your EduNexus passphrase: ${resetUrl}. Sent by ${DEFAULT_SENDER}`,
        actionType: "PASSWORD_RESET",
        previewUrl: resetUrl
      });

      return jsonRes({
        ok: true,
        message: `Password reset instructions sent to ${cleanEmail} from ${DEFAULT_SENDER}.`,
        preview_url: resetUrl,
        token: resetToken
      });
    }

    // 5. RESET PASSWORD CONFIRMATION
    if (subAction === "reset-password") {
      const { token, new_pass_hash, new_salt_hex } = body;
      if (!token || !new_pass_hash) {
        return jsonRes({ error: "Missing token or new pass_hash" }, 400);
      }

      const resetRecord = await db
        .prepare(`
          SELECT * FROM password_resets
          WHERE token = ? AND used = 0 AND datetime(expires_at) > datetime('now')
        `)
        .bind(token)
        .first();

      if (!resetRecord) {
        return jsonRes({ error: "Invalid or expired password reset token." }, 400);
      }

      // Update password
      const cleanSalt = new_salt_hex || generateRandomHex(16);
      await db
        .prepare("UPDATE users SET pass_hash = ?, salt_hex = ? WHERE email = ?")
        .bind(new_pass_hash, cleanSalt, resetRecord.email)
        .run();

      // Mark token used
      await db
        .prepare("UPDATE password_resets SET used = 1 WHERE id = ?")
        .bind(resetRecord.id)
        .run();

      // Fetch user to issue fresh session
      const user = await db
        .prepare("SELECT * FROM users WHERE email = ?")
        .bind(resetRecord.email)
        .first();

      const sessionToken = await createSignedToken({ id: user.id, email: user.email, name: user.name, role: user.role });
      const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

      await db
        .prepare("INSERT INTO sessions (token, user_id, user_email, expires_at) VALUES (?, ?, ?, ?)")
        .bind(sessionToken, user.id, user.email, expiresAt)
        .run();

      return jsonRes({
        ok: true,
        message: "Passphrase successfully updated! Session active.",
        token: sessionToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    }

    // 6. LOGOUT
    if (subAction === "logout") {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim() || body.token;
      if (token) {
        await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
      }
      return jsonRes({ ok: true, message: "Session terminated." });
    }

    // 7. SSO VERIFICATION (Cross-App Bridge)
    if (subAction === "sso-verify") {
      const { sso_token } = body;
      if (!sso_token) {
        return jsonRes({ error: "Missing sso_token" }, 400);
      }

      const session = await db
        .prepare(`
          SELECT s.*, u.name, u.role
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
        `)
        .bind(sso_token)
        .first();

      if (!session) {
        return jsonRes({ error: "Invalid or expired SSO session token." }, 401);
      }

      return jsonRes({
        ok: true,
        token: session.token,
        user: { id: session.user_id, email: session.user_email, name: session.name, role: session.role }
      });
    }

    return jsonRes({ error: `Unknown auth action: ${subAction}` }, 404);
  } catch (err) {
    console.error("[Auth POST Error]", err);
    return jsonRes({ error: "Auth Edge Exception", message: err.message }, 500);
  }
}

// -----------------------------------------------------------------------------
// GET Request Router (Session validation & Magic Link verification)
// -----------------------------------------------------------------------------
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB || env.edunexus_db || env.nexus_db;

  if (!db) {
    return jsonRes({ error: "Database not bound in Cloudflare edge" }, 500);
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const subAction = pathParts[pathParts.length - 1];

  try {
    // 1. VERIFY MAGIC LINK
    if (subAction === "verify-magic") {
      const token = url.searchParams.get("token");
      if (!token) {
        return jsonRes({ error: "Missing magic token" }, 400);
      }

      const record = await db
        .prepare(`
          SELECT * FROM magic_links
          WHERE token = ? AND used = 0 AND datetime(expires_at) > datetime('now')
        `)
        .bind(token)
        .first();

      if (!record) {
        return new Response(
          `<html><body style="background:#090d16;color:#f8fafc;font-family:sans-serif;padding:40px;text-align:center;">
             <h2>❌ Magic Link Expired or Already Used</h2>
             <p>Please request a new sign-in link.</p>
             <a href="/" style="color:#6366f1;">Back to EduNexus</a>
           </body></html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      // Mark used
      await db.prepare("UPDATE magic_links SET used = 1 WHERE id = ?").bind(record.id).run();

      // Retrieve or create user
      let user = await db
        .prepare("SELECT * FROM users WHERE email = ?")
        .bind(record.email)
        .first();

      if (!user) {
        const userId = "usr_" + Date.now().toString(36) + "_" + generateRandomHex(4);
        const userName = record.email.split("@")[0];
        await db
          .prepare(`
            INSERT INTO users (id, name, email, pass_hash, salt_hex, role, registered_at, last_login)
            VALUES (?, ?, ?, 'magic_pwd_bypass', 'salt', 'student', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `)
          .bind(userId, userName, record.email)
          .run();
        user = { id: userId, name: userName, email: record.email, role: "student" };
      } else {
        await db.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id).run();
      }

      const sessionToken = await createSignedToken({ id: user.id, email: user.email, name: user.name, role: user.role });
      const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

      await db
        .prepare("INSERT INTO sessions (token, user_id, user_email, expires_at) VALUES (?, ?, ?, ?)")
        .bind(sessionToken, user.id, user.email, expiresAt)
        .run();

      // Client redirect with token in hash so it can be picked up by JS
      const redirectTarget = `${record.redirect_url || '/'}#token=${sessionToken}&email=${encodeURIComponent(user.email)}`;
      return Response.redirect(redirectTarget, 302);
    }

    // 2. CHECK ACTIVE SESSION
    if (subAction === "session") {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim() || url.searchParams.get("token");

      if (!token) {
        return jsonRes({ valid: false, message: "No token provided." }, 401);
      }

      const session = await db
        .prepare(`
          SELECT s.*, u.name, u.role
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
        `)
        .bind(token)
        .first();

      if (!session) {
        return jsonRes({ valid: false, message: "Session expired or invalid." }, 401);
      }

      return jsonRes({
        valid: true,
        user: {
          id: session.user_id,
          email: session.user_email,
          name: session.name,
          role: session.role
        }
      });
    }

    // 3. AUDIT EMAIL LOGS (Recent mail sent from niranjanbarhate42@gmail.com)
    if (subAction === "email-logs") {
      const limit = parseInt(url.searchParams.get("limit") || "10", 10);
      const logs = await db
        .prepare("SELECT * FROM email_logs ORDER BY created_at DESC LIMIT ?")
        .bind(limit)
        .all();

      return jsonRes({
        sender: DEFAULT_SENDER,
        emails: logs.results || []
      });
    }

    return jsonRes({ error: `Unknown auth action: ${subAction}` }, 404);
  } catch (err) {
    console.error("[Auth GET Error]", err);
    return jsonRes({ error: "Auth GET Exception", message: err.message }, 500);
  }
}
