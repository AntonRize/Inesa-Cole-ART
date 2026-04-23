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

// Use CommonJS exports for compatibility with plain Vercel projects
module.exports = async function handler(req, res) {

    // ── CORS — set on EVERY response including OPTIONS preflight ──
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    res.setHeader('Access-Control-Allow-Origin', 'https://inesacole.art');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400'); // cache preflight 24h

    // Handle preflight OPTIONS request — must return 200 with CORS headers
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ── Parse body — Vercel plain functions may not auto-parse JSON ──
    let parsed = req.body;
    if (!parsed) {
        try {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            parsed = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
            return res.status(400).json({ error: 'Could not parse request body' });
        }
    }

    const { password, method, path, body } = parsed || {};

    // ── Auth check ────────────────────────────────────────────────
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

    // ── Forward to GitHub API ─────────────────────────────────────
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
};
