# Architecture

A static website whose content is edited in a browser-based CMS and stored as files in Git.
There is no database and no application server.

- **Site:** https://sveltia.farhan.app (also `sveltia-8p2.pages.dev`)
- **CMS:** https://sveltia.farhan.app/admin/
- **Code and content:** https://github.com/farhanmunim/sveltia (branch `main`)

## How it fits together

```
 Editor (browser)
      |
      |  1. opens /admin  (Sveltia CMS, loaded from unpkg)
      v
 +------------------+   2. "Sign in with GitHub"   +-------------------------+
 | Sveltia CMS      | ---------------------------> | Cloudflare Worker       |
 | (runs in the     | <--------------------------- | sveltia-cms-auth        |
 |  browser)        |   5. access token            +-----------+-------------+
 +--------+---------+                                          | 3. OAuth code exchange
          |                                                    v
          | 6. reads/writes files via the GitHub API     +-------------+
          v                                              | GitHub      |
 +------------------+   4. user approves the app         | OAuth App   |
 | GitHub repo      | <--------------------------------- +-------------+
 | farhanmunim/     |
 | sveltia          |
 +--------+---------+
          | 7. push to main  (or PR for drafts)
          v
 +------------------+   8. npm run build   +----------------------------+
 | Cloudflare Pages | -------------------> | Static files (dist/)       |
 | project "sveltia"|                      | served from Cloudflare CDN |
 +------------------+                      +----------------------------+
```

In short: **CMS -> GitHub commit -> Cloudflare build -> live site.**

## Components

| Part | What it is | Where it lives |
| --- | --- | --- |
| **Website** | Astro (static output). Pages are generated from Markdown/YAML files. | `src/` in the repo |
| **Content** | Posts, projects, services, resources, pages, categories, tags, authors and site settings, all as files. | `src/content/` |
| **Media** | Images and files uploaded through the CMS. | `public/uploads/` (served at `/uploads/...`) |
| **CMS** | Sveltia CMS, a Git-based CMS that runs entirely in the browser. | `public/admin/index.html` loads it; `public/admin/config.yml` defines it |
| **Hosting** | Cloudflare Pages project `sveltia`, connected to the GitHub repo. | Cloudflare dashboard |
| **Auth worker** | Cloudflare Worker `sveltia-cms-auth` that completes the GitHub OAuth login. | Cloudflare dashboard; code in the fork `farhanmunim/sveltia-cms-auth` |
| **GitHub OAuth App** | Lets the CMS sign editors in with GitHub. | GitHub -> Settings -> Developer settings -> OAuth Apps |
| **Cloudflare GitHub app** | Gives Cloudflare read access to the repos so it can build on every push. | GitHub -> Settings -> Applications |
| **Analytics** | Self-hosted Umami at `mochi.farhan.app`. Its script is in Site Settings -> Head scripts. | Site Settings in the CMS |

## Deployment

### Website (Cloudflare Pages)
- Project `sveltia`, Git repo `farhanmunim/sveltia`, **production branch `main`**.
- Build command `npm run build`, output directory `dist`. Node 22, from `.node-version`.
- Every push to `main` triggers a build. Publishing in the CMS pushes to `main`, so **publishing deploys the site** (about a minute).
- Custom domain `sveltia.farhan.app` is attached to the Pages project.
- **Preview deployments:** drafts live on `cms/...` branches and pull requests; Cloudflare builds a preview for each. Set **Build comments** to Disabled (Pages project -> Settings -> Build -> Build configuration) so Cloudflare does not comment on every pull request and trigger notification emails.

### Auth worker (Cloudflare Workers)
- Worker `sveltia-cms-auth`, URL `https://sveltia-cms-auth.farhanmunim.workers.dev`.
- Built by Workers Builds from the fork `farhanmunim/sveltia-cms-auth` (branch `main`) with `npx wrangler deploy`.
- `wrangler.toml` in the fork sets:
  - `keep_vars = true`, so a Git deploy does not wipe variables set in the dashboard.
  - `ALLOWED_DOMAINS`, the sites allowed to use the worker (`sveltia.farhan.app`, `sveltia-8p2.pages.dev`).
- **Runtime variables and secrets** (Worker -> Settings -> *Runtime* variables and secrets):
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET` (secret)

  They must be in the **runtime** list. The *Build* variables list further down the page is only visible during builds and does nothing for the running worker.

### GitHub OAuth App
- Registered under the owner's GitHub account.
- Homepage URL `https://sveltia.farhan.app`.
- Authorization callback URL `https://sveltia-cms-auth.farhanmunim.workers.dev/callback`.
- "Expire user access tokens" and "Device flow" are off; the worker does not handle refresh tokens.

## Sign-in flow

1. The editor opens `/admin/` and clicks **Sign in with GitHub**.
2. The CMS opens a popup to the worker (`/auth`), which redirects to GitHub.
3. The editor approves the OAuth app on GitHub.
4. GitHub calls the worker's `/callback` with a one-time code. The worker exchanges it for an access token using the client secret.
5. The worker hands the token back to the CMS page, but only if the page's host is in `ALLOWED_DOMAINS`.
6. The CMS uses the token to read and write the repo through the GitHub API.

Anyone with **write access** to `farhanmunim/sveltia` can sign in. There are no separate CMS accounts. Alternative for the owner: **Sign In Using Access Token** with a fine-grained personal access token (Contents and Pull requests: read and write, limited to this repo). That needs no worker.

## Publishing workflow

- **Posts, pages, projects, services, resources:** editorial workflow (Draft -> In review -> Ready -> Publish). Unpublished entries live on a `cms/<collection>/<slug>` branch with a pull request, so they never reach the live site. Publishing squash-merges to `main`.
- **Categories, tags, authors, site settings:** save straight to `main`.
- **Deleting** an entry in the workflow collections opens a deletion pull request. Deleting a tag, category or author also edits every entry that references it, directly on `main`. Delete content first and tags/authors last, or queued deletions will conflict.

## Content model

| Collection | Folder | URL |
| --- | --- | --- |
| Pages | `src/content/pages` | `/<slug>` |
| Posts | `src/content/posts` | `/blog/<slug>` |
| Projects | `src/content/projects` | `/projects/<slug>` |
| Services | `src/content/services` | `/services/<slug>` |
| Resources | `src/content/resources` | `/resources/<slug>` |
| Categories (nestable) | `src/content/categories` | `/category/<slug>` |
| Tags | `src/content/tags` | `/tags/<slug>` |
| Authors | `src/content/authors` | `/authors/<slug>` |
| Site Settings | `src/content/settings/site.yml` | n/a |

The CMS fields (`public/admin/config.yml`) and the Astro schemas (`src/content.config.ts`) mirror each other. Change both together.

## Search engine indexing

The site is hidden from search engines by default. Site Settings -> **Allow search engines to index this site** controls it.

| Setting | `robots.txt` | `<meta name="robots">` | `X-Robots-Tag` header |
| --- | --- | --- | --- |
| Off (default) | `Disallow: /` | `noindex, nofollow, noarchive, nosnippet` | sent on every response (`dist/_headers`, generated at build) |
| On | `Allow: /` | none | none |

`/admin/` is always `noindex`.

## Where the content came from

The initial content was imported once from the WordPress REST API at `cms.farhan.app`. It is not connected afterwards; Git is now the source of truth. The public site `farhan.app` is a separate site.

## Day-to-day tasks

| Task | How |
| --- | --- |
| Edit content | `/admin/` -> make changes -> Publish. The site rebuilds automatically. |
| Add an editor | Give them **write** access on the GitHub repo. |
| Change site name, logo, social links, analytics, indexing | CMS -> Site Settings |
| Change the CMS or site code | Edit the repo and push to `main`. |
| Run locally | `npm install`, then `npm run dev`. For local CMS editing use `npm run preview` and open `/admin/`. |
| Rotate the GitHub login secret | Generate a new secret in the OAuth App, then update `GITHUB_CLIENT_SECRET` under the worker's runtime secrets. |

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Sign-in popup says "OAuth app client ID or secret is not configured" | `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` are missing from the worker's *runtime* variables. |
| Sign-in popup closes or reports an unsupported domain | The site's host is missing from `ALLOWED_DOMAINS`, or the OAuth callback URL does not match exactly. |
| Worker variables disappear after a redeploy | `keep_vars = true` is missing in the fork's `wrangler.toml`. |
| "Couldn't delete the entry" in the Workflow tab | The deletion pull request conflicts with newer commits on `main`. Close it (undo) and delete again. |
| Pull request notification emails from Cloudflare | Build comments are on. Turn them off in the Pages project -> Settings -> Build. |
| Site does not update after publishing | Check Cloudflare Pages -> Deployments for a failed build. |
