/* ============================================================
   api/github-proxy.js  — paste this into your inesa-cole-proxy repo
   ============================================================ */

const GITHUB_OWNER = 'AntonRize';
const GITHUB_REPO  = 'Inesa-Cole-ART';

module.exports = async function handler(req, res) {

    // Allow any origin — security comes from the password check below
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Body arrives as text/plain — read and parse it manually
    let data;
    try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString();
        data = JSON.parse(raw);
    } catch {
        return res.status(400).json({ error: 'Bad request body' });
    }

    const { password, method, path, body } = data || {};

    // Auth check
    if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!method || !path) {
        return res.status(400).json({ error: 'Missing method or path' });
    }

    const token = process.env.GITHUB_TOKEN_Inesa;
    if (!token) {
        return res.status(500).json({ error: 'Server misconfiguration: token missing' });
    }

    // Forward to GitHub
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'inesacole-proxy',
        },
    };
    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    try {
        const ghRes = await fetch(url, options);
        const result = await ghRes.json();
        return res.status(ghRes.status).json(result);
    } catch (err) {
        return res.status(502).json({ error: 'GitHub unreachable', detail: err.message });
    }
};
