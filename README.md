# DeliverCrew Distribution

The six-page website is hosted on Netlify from this GitHub repository. Open `/admin/` on the main Netlify site to edit the wording, prices and contact details. Publishing a change in the editor commits `data/content.json` to the `main` branch; Netlify must be linked to this repository with automatic deployments enabled.

## One-time editor connection

1. In GitHub, create an OAuth App. Set the Homepage URL to the main Netlify site URL (not a deploy-preview URL) and the callback URL to `https://api.netlify.com/auth/done`.
2. Add that app's Client ID and Client Secret under this Netlify project's **Project configuration → Security → OAuth → Authentication providers → GitHub**. Never commit the secret to this repository.
3. Log in at `https://YOUR-MAIN-NETLIFY-SITE/admin/` with a GitHub account that can write to `Mikachewy26/Delivercrew`.
4. Change one harmless sentence, publish it, and confirm Netlify deploys the resulting GitHub commit.

The `/admin/` page cannot save until OAuth is connected. The public site continues to work. Old PHP editor files were removed because Netlify does not run PHP on visitor requests.
