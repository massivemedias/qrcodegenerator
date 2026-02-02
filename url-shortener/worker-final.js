/**
 * Massive Medias - URL Shortener + QR Code Generator
 * Worker Cloudflare avec routing intelligent
 * 
 * KV Binding: URLS (env.URLS)
 * Origin AWS: 13.52.188.95
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  API_KEY: 'massive-secret-2024-change-me', // Change cette clé!
  ORIGIN_IP: '13.52.188.95',
  QR_APP_URL: 'https://main.d15strqjqfjba7.amplifyapp.com',
  SHORT_CODE_LENGTH: 6
};

// ============================================
// UTILITAIRES
// ============================================

// Générer un code court aléatoire
function generateShortCode(length = CONFIG.SHORT_CODE_LENGTH) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Obtenir les infos du visiteur pour les stats
function getVisitorInfo(request) {
  return {
    ip: request.headers.get('CF-Connecting-IP') || 'unknown',
    country: request.headers.get('CF-IPCountry') || 'unknown',
    city: request.headers.get('CF-IPCity') || 'unknown',
    userAgent: request.headers.get('User-Agent') || 'unknown',
    referer: request.headers.get('Referer') || 'direct',
    timestamp: new Date().toISOString()
  };
}

// Headers CORS pour l'API
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};

// Vérifier l'API Key
function isAuthorized(request) {
  const apiKey = request.headers.get('X-API-Key');
  return apiKey === CONFIG.API_KEY;
}

// Réponse JSON
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Passer la requête à l'origin AWS
async function passToOrigin(request) {
  const url = new URL(request.url);
  const originUrl = `http://${CONFIG.ORIGIN_IP}${url.pathname}${url.search}`;
  
  // Créer une nouvelle requête vers l'origin
  const modifiedRequest = new Request(originUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'follow'
  });
  
  try {
    const response = await fetch(modifiedRequest);
    // Retourner la réponse de l'origin
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch (error) {
    console.error('Origin fetch error:', error);
    return new Response('Origin server error', { status: 502 });
  }
}

// ============================================
// HANDLERS API
// ============================================

// POST /api/shorten - Créer un lien court
async function handleShorten(request, env) {
  if (!isAuthorized(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await request.json();
    const { longUrl, customCode } = body;

    if (!longUrl) {
      return jsonResponse({ error: 'Missing longUrl' }, 400);
    }

    // Valider l'URL
    try {
      new URL(longUrl);
    } catch {
      return jsonResponse({ error: 'Invalid URL format' }, 400);
    }

    let shortCode = customCode || generateShortCode();
    
    // Nettoyer le code personnalisé
    if (customCode) {
      shortCode = customCode.toLowerCase().replace(/[^a-z0-9-]/g, '');
    }

    // Vérifier si le code existe déjà
    const existing = await env.URLS.get(shortCode);
    if (existing) {
      if (customCode) {
        return jsonResponse({ error: 'Code already exists' }, 409);
      }
      // Régénérer si collision
      shortCode = generateShortCode(8);
    }

    // Vérifier que le code ne conflit pas avec les routes réservées
    const reservedPaths = ['api', 'qrcode', 'www', 'admin', 'assets', 'static'];
    if (reservedPaths.includes(shortCode.toLowerCase())) {
      return jsonResponse({ error: 'This code is reserved' }, 400);
    }

    // Créer l'entrée
    const urlData = {
      longUrl,
      shortCode,
      createdAt: new Date().toISOString(),
      clicks: 0,
      clicksHistory: []
    };

    await env.URLS.put(shortCode, JSON.stringify(urlData));

    return jsonResponse({
      success: true,
      shortUrl: `https://massivemedias.com/${shortCode}`,
      shortCode,
      longUrl
    }, 201);

  } catch (error) {
    console.error('Shorten error:', error);
    return jsonResponse({ error: 'Invalid request' }, 400);
  }
}

// GET /api/stats/:code - Stats d'un lien
async function handleStats(shortCode, env) {
  const data = await env.URLS.get(shortCode);
  
  if (!data) {
    return jsonResponse({ error: 'Link not found' }, 404);
  }

  const urlData = JSON.parse(data);
  
  return jsonResponse({
    shortCode: urlData.shortCode,
    shortUrl: `https://massivemedias.com/${urlData.shortCode}`,
    longUrl: urlData.longUrl,
    createdAt: urlData.createdAt,
    clicks: urlData.clicks,
    recentClicks: urlData.clicksHistory.slice(-20)
  });
}

// GET /api/links - Lister tous les liens
async function handleListLinks(request, env) {
  if (!isAuthorized(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const list = await env.URLS.list();
  const links = [];

  for (const key of list.keys) {
    const data = await env.URLS.get(key.name);
    if (data) {
      const urlData = JSON.parse(data);
      links.push({
        shortCode: urlData.shortCode,
        shortUrl: `https://massivemedias.com/${urlData.shortCode}`,
        longUrl: urlData.longUrl,
        clicks: urlData.clicks,
        createdAt: urlData.createdAt
      });
    }
  }

  // Trier par date (plus récent en premier)
  links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return jsonResponse({ links, total: links.length });
}

// DELETE /api/links/:code - Supprimer un lien
async function handleDeleteLink(request, shortCode, env) {
  if (!isAuthorized(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const existing = await env.URLS.get(shortCode);
  if (!existing) {
    return jsonResponse({ error: 'Link not found' }, 404);
  }

  await env.URLS.delete(shortCode);
  return jsonResponse({ success: true, deleted: shortCode });
}

// ============================================
// HANDLER REDIRECTION
// ============================================

async function handleRedirect(shortCode, request, env) {
  const data = await env.URLS.get(shortCode);
  
  if (!data) {
    return null; // Pas trouvé, on passera à l'origin
  }

  const urlData = JSON.parse(data);
  
  // Enregistrer le clic
  urlData.clicks++;
  urlData.clicksHistory.push(getVisitorInfo(request));
  
  // Garder seulement les 100 derniers clics
  if (urlData.clicksHistory.length > 100) {
    urlData.clicksHistory = urlData.clicksHistory.slice(-100);
  }
  
  // Sauvegarder (sans bloquer la redirection)
  env.URLS.put(shortCode, JSON.stringify(urlData));

  // Rediriger
  return Response.redirect(urlData.longUrl, 302);
}

// ============================================
// HANDLER QR CODE APP
// ============================================

async function handleQRCodeApp(request) {
  // Proxy vers l'app Amplify
  const amplifyUrl = CONFIG.QR_APP_URL + '/';
  
  try {
    const response = await fetch(amplifyUrl, {
      method: request.method,
      headers: {
        'User-Agent': request.headers.get('User-Agent') || '',
        'Accept': request.headers.get('Accept') || '*/*',
      }
    });
    
    // Modifier le HTML pour corriger les chemins des assets si nécessaire
    let body = await response.text();
    
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=300'
      }
    });
  } catch (error) {
    // Fallback: rediriger vers Amplify
    return Response.redirect(CONFIG.QR_APP_URL, 302);
  }
}

// ============================================
// MAIN WORKER
// ============================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ========== ROUTE: Page d'accueil ==========
    // massivemedias.com/ → Passer à l'origin AWS
    if (path === '/' || path === '') {
      return passToOrigin(request);
    }

    // ========== ROUTE: QR Code App ==========
    // massivemedias.com/qrcode → App QR Generator
    if (path === '/qrcode' || path === '/qrcode/') {
      return Response.redirect(CONFIG.QR_APP_URL, 302);
    }

    // ========== ROUTES API ==========
    
    // POST /api/shorten
    if (path === '/api/shorten' && request.method === 'POST') {
      return handleShorten(request, env);
    }

    // GET /api/stats/:code
    if (path.startsWith('/api/stats/') && request.method === 'GET') {
      const shortCode = path.replace('/api/stats/', '');
      return handleStats(shortCode, env);
    }

    // GET /api/links
    if (path === '/api/links' && request.method === 'GET') {
      return handleListLinks(request, env);
    }

    // DELETE /api/links/:code
    if (path.startsWith('/api/links/') && request.method === 'DELETE') {
      const shortCode = path.replace('/api/links/', '');
      return handleDeleteLink(request, shortCode, env);
    }

    // ========== ROUTE: Redirection shortcode ==========
    // massivemedias.com/{code} → Redirection
    if (path.length > 1 && !path.includes('.') && !path.startsWith('/api')) {
      const shortCode = path.substring(1).split('/')[0]; // Prendre juste le premier segment
      
      // Essayer de rediriger
      const redirectResponse = await handleRedirect(shortCode, request, env);
      if (redirectResponse) {
        return redirectResponse;
      }
      // Si pas trouvé, on continue vers l'origin
    }

    // ========== FALLBACK: Passer à l'origin AWS ==========
    // Toutes les autres requêtes vont vers le site original
    return passToOrigin(request);
  }
};
