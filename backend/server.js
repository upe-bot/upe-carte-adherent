// server.js — Backend "Carte Adhérent" Union pour l'Enfance
// Stack : Node.js + Express, à héberger sur Render (comme defi-enfance-notifications)
//
// Rôle :
//  1. Recevoir un email, vérifier qu'il existe dans l'audience Mailchimp,
//     générer un lien magique (JWT signé, valable 12 mois) et l'envoyer via Brevo.
//  2. Vérifier un token et renvoyer les infos adhérent (nom, date de renouvellement,
//     statut) à la page carte.html.

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

const {
  MAILCHIMP_API_KEY,      // ex: abc123...-us21
  MAILCHIMP_SERVER_PREFIX, // ex: us21 (le suffixe après le dernier tiret de la clé)
  MAILCHIMP_LIST_ID,      // ID de l'audience adhérents
  BREVO_API_KEY,
  BREVO_SENDER_EMAIL,     // ex: adhesions@unionpourlenfance.com
  BREVO_SENDER_NAME,      // ex: Union pour l'Enfance
  JWT_SECRET,
  FRONTEND_URL,           // ex: https://<votre-compte>.github.io/upe-carte-adherent
  ADHESION_DUREE_JOURS = 365,
  PORT = 3000,
} = process.env;

// ---------- Utils Mailchimp ----------

function mailchimpBaseUrl() {
  return `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0`;
}

function subscriberHash(email) {
  return crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
}

async function getMailchimpMember(email) {
  const hash = subscriberHash(email);
  const url = `${mailchimpBaseUrl()}/lists/${MAILCHIMP_LIST_ID}/members/${hash}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64')}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// ---------- Utils Brevo ----------

async function sendMagicLinkEmail(email, firstName, link) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
      to: [{ email }],
      subject: 'Votre carte adhérent Union pour l\'Enfance',
      htmlContent: `
        <div style="font-family: Calibri, Arial, sans-serif; max-width: 480px; margin: auto;">
          <h2 style="color:#0A6F71;">Bonjour ${firstName || ''},</h2>
          <p>Cliquez sur le bouton ci-dessous pour accéder à votre carte adhérent en ligne.</p>
          <p style="text-align:center; margin: 32px 0;">
            <a href="${link}" style="background:#0A6F71;color:#ffffff;padding:14px 28px;
              border-radius:8px;text-decoration:none;font-weight:bold;">
              Voir ma carte adhérent
            </a>
          </p>
          <p style="font-size: 13px; color: #666;">Ce lien est personnel et valable 12 mois.</p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erreur Brevo (${res.status}): ${text}`);
  }
}

// ---------- Routes ----------

// 1. Demande de lien magique
app.post('/api/request-link', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Email invalide.' });
  }

  try {
    const member = await getMailchimpMember(email);

    // Réponse volontairement identique que l'email existe ou non
    // (évite de révéler quels emails sont adhérents — bonne pratique sécurité).
    if (member) {
      const token = jwt.sign({ email: email.trim().toLowerCase() }, JWT_SECRET, {
        expiresIn: '365d',
      });
      const link = `${FRONTEND_URL}/carte.html?token=${token}`;
      await sendMagicLinkEmail(email, member.merge_fields?.FNAME, link);
    }

    return res.json({
      message:
        "Si cet email correspond à un compte adhérent, un lien d'accès vient de vous être envoyé.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Une erreur est survenue, réessayez plus tard.' });
  }
});

// 2. Récupération des infos de la carte à partir du token
app.get('/api/member', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token manquant.' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Lien invalide ou expiré. Redemandez un lien.' });
  }

  try {
    const member = await getMailchimpMember(payload.email);
    if (!member) {
      return res.status(404).json({ error: 'Adhérent introuvable.' });
    }

    const renewalDateStr = member.merge_fields?.ADH; // date de dernier renouvellement
    const renewalDate = renewalDateStr ? new Date(renewalDateStr) : null;

    let validUntil = null;
    let isValid = false;
    if (renewalDate && !isNaN(renewalDate)) {
      validUntil = new Date(renewalDate);
      validUntil.setDate(validUntil.getDate() + Number(ADHESION_DUREE_JOURS));
      isValid = validUntil.getTime() >= Date.now();
    }

    return res.json({
      firstName: member.merge_fields?.FNAME || '',
      lastName: member.merge_fields?.LNAME || '',
      renewalDate: renewalDateStr || null,
      validUntil: validUntil ? validUntil.toISOString().slice(0, 10) : null,
      isValid,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Une erreur est survenue, réessayez plus tard.' });
  }
});

app.get('/healthz', (req, res) => res.send('ok'));

app.listen(PORT, () => console.log(`Serveur carte adhérent lancé sur le port ${PORT}`));
