/* ============================================================
   Vercel Serverless Function: GitHub Proxy for inesacole.art

   Place this file at:  api/github-proxy.js
   in your Vercel proxy project.

   Required Vercel Environment Variables:
     ADMIN_PASSWORD      — the admin panel password (e.g. inesaart2025)
     GITHUB_TOKEN_Inesa  — a GitHub Personal Access Token with 'repo' scope
   ============================================================ */

const GITHUB_OWNER = 'AntonRize';
const GITHUB_REPO  = 'Inesa-Cole-ART';

export default async function handler(req, res) {

    // ── CORS ──────────────────────────────────────────────────
    res.setHeader('Access-Control-Allow-Origin', 'https://inesacole.art');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ── Auth check ────────────────────────────────────────────
    const { password, method, path, body } = req.body || {};

    if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!method || !path) {
        return res.status(400).json({ error: 'Missing method or path' });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN_Inesa;
    if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: 'GitHub token not configured on server' });
    }

    // ── Forward to GitHub API ─────────────────────────────────
    const githubUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

    const fetchOptions = {
        method: method,
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Content-Type':  'application/json',
            'User-Agent':    'inesacole-admin-proxy',
            'Accept':        'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    };

    if (body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(body);
    }

    try {
        const githubRes = await fetch(githubUrl, fetchOptions);
        const data = await githubRes.json();
        return res.status(githubRes.status).json(data);
    } catch (err) {
        console.error('GitHub proxy error:', err);
        return res.status(502).json({ error: 'Failed to reach GitHub API', detail: err.message });
    }
}
