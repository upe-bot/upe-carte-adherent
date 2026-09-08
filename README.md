# upe-carte-adherent

Carte adhérent en ligne pour l'Union pour l'Enfance — accès par lien magique, données Mailchimp, envoi Brevo.

## Structure

```
backend/    → API Node/Express (à héberger sur Render)
frontend/   → Pages statiques (à héberger sur GitHub Pages)
```

## 1. Déployer le backend (Render)

1. Poussez le dossier `backend/` dans un dépôt GitHub (ou le même dépôt, sous-dossier).
2. Sur Render : New → Web Service → connectez le dépôt, root directory `backend`.
3. Build command : `npm install` — Start command : `npm start`.
4. Renseignez les variables d'environnement (voir `.env.example`) :
   - `MAILCHIMP_API_KEY`, `MAILCHIMP_SERVER_PREFIX` (ex. `us21`, visible dans l'URL de votre compte Mailchimp), `MAILCHIMP_LIST_ID` (Audience → Settings → Audience name and defaults → Audience ID)
   - `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
   - `JWT_SECRET` (générez une chaîne aléatoire longue, ex. `openssl rand -hex 32`)
   - `FRONTEND_URL` (l'URL GitHub Pages une fois publiée, ex. `https://upe.github.io/upe-carte-adherent`)
5. Notez l'URL Render générée (ex. `https://upe-carte-adherent.onrender.com`).

## 2. Déployer le frontend (GitHub Pages)

1. Poussez le dossier `frontend/` dans le dépôt `upe-carte-adherent`.
2. Ajoutez vos fichiers logo (`logo-upe.png`, `logo-upe-blanc.png` — récupérables depuis Canva, dossier "UPE 2025").
3. Dans `index.html` et `carte.html`, remplacez `API_BASE` par l'URL Render obtenue à l'étape 1.
4. Activez GitHub Pages (Settings → Pages → branche `main`, dossier `/frontend` ou racine selon votre organisation).

## 3. Champ Mailchimp requis

- `ADH` : date du dernier renouvellement (format date).
- `FNAME` / `LNAME` : déjà standard dans Mailchimp.

La durée de validité (12 mois par défaut) se règle via `ADHESION_DUREE_JOURS` dans le backend.

## Sécurité

- Le lien magique est un JWT signé, valable 12 mois, sans base de données à gérer.
- La réponse à une demande de lien est identique que l'email soit adhérent ou non, pour ne pas révéler qui est adhérent.
- Pensez à révoquer/regénérer `JWT_SECRET` si un incident survient (invalide tous les liens existants).

## À affiner ensemble avant mise en prod

- Modèle d'email Brevo (design aux couleurs UPE au lieu du HTML minimal fourni).
- Emplacement définitif des fichiers logo sur GitHub Pages.
- Éventuellement : rate-limiting sur `/api/request-link` pour éviter les abus.
