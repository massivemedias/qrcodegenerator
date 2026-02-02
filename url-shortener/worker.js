/**
 * Massive Medias URL Shortener
 * Cloudflare Worker avec statistiques
 */

// Clé API pour sécuriser la création de liens (à changer!)
const API_KEY = 'massive-secret-key-2024';

// Générer un code court aléatoire
function generateShortCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Obtenir les infos du visiteur
function getVisitorInfo(request) {
  return {
    ip: request.headers.get('CF-Connecting-IP') || 'unknown',
    country: request.headers.get('CF-IPCountry') || 'unknown',
    userAgent: request.headers.get('User-Agent') || 'unknown',
    referer: request.headers.get('Referer') || 'direct',
    timestamp: new Date().toISOString()
  };
}

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ============================================
    // API: Créer un lien court
    // POST /api/shorten
    // ============================================
    if (path === '/api/shorten' && request.method === 'POST') {
      // Vérifier l'API key
      const apiKey = request.headers.get('X-API-Key');
      if (apiKey !== API_KEY) {
        return new Response(JSON.stringify({ error: 'Invalid API key' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const body = await request.json();
        const { longUrl, customCode } = body;

        if (!longUrl) {
          return new Response(JSON.stringify({ error: 'Missing longUrl' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Utiliser le code personnalisé ou en générer un
        let shortCode = customCode || generateShortCode();
        
        // Vérifier si le code existe déjà
        const existing = await env.URLS.get(shortCode);
        if (existing && !customCode) {
          // Régénérer si collision
          shortCode = generateShortCode(8);
        } else if (existing && customCode) {
          return new Response(JSON.stringify({ error: 'Code already exists' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
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

        const shortUrl = `${url.origin}/${shortCode}`;
        
        return new Response(JSON.stringify({ 
          success: true,
          shortUrl,
          shortCode,
          longUrl
        }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ============================================
    // API: Obtenir les stats d'un lien
    // GET /api/stats/:code
    // ============================================
    if (path.startsWith('/api/stats/') && request.method === 'GET') {
      const shortCode = path.replace('/api/stats/', '');
      
      const data = await env.URLS.get(shortCode);
      if (!data) {
        return new Response(JSON.stringify({ error: 'Link not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const urlData = JSON.parse(data);
      
      // Retourner les stats (sans l'historique complet pour alléger)
      const stats = {
        shortCode: urlData.shortCode,
        longUrl: urlData.longUrl,
        createdAt: urlData.createdAt,
        clicks: urlData.clicks,
        recentClicks: urlData.clicksHistory.slice(-10) // 10 derniers clics
      };

      return new Response(JSON.stringify(stats), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================
    // API: Lister tous les liens
    // GET /api/links
    // ============================================
    if (path === '/api/links' && request.method === 'GET') {
      const apiKey = request.headers.get('X-API-Key');
      if (apiKey !== API_KEY) {
        return new Response(JSON.stringify({ error: 'Invalid API key' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const list = await env.URLS.list();
      const links = [];

      for (const key of list.keys) {
        const data = await env.URLS.get(key.name);
        if (data) {
          const urlData = JSON.parse(data);
          links.push({
            shortCode: urlData.shortCode,
            longUrl: urlData.longUrl,
            clicks: urlData.clicks,
            createdAt: urlData.createdAt
          });
        }
      }

      // Trier par date de création (plus récent en premier)
      links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return new Response(JSON.stringify({ links }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================
    // API: Supprimer un lien
    // DELETE /api/links/:code
    // ============================================
    if (path.startsWith('/api/links/') && request.method === 'DELETE') {
      const apiKey = request.headers.get('X-API-Key');
      if (apiKey !== API_KEY) {
        return new Response(JSON.stringify({ error: 'Invalid API key' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const shortCode = path.replace('/api/links/', '');
      await env.URLS.delete(shortCode);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================
    // Redirection: /:code
    // ============================================
    if (path.length > 1 && !path.startsWith('/api/')) {
      const shortCode = path.substring(1); // Enlever le /
      
      const data = await env.URLS.get(shortCode);
      if (data) {
        const urlData = JSON.parse(data);
        
        // Incrémenter le compteur et enregistrer le clic
        urlData.clicks++;
        urlData.clicksHistory.push(getVisitorInfo(request));
        
        // Garder seulement les 100 derniers clics pour économiser l'espace
        if (urlData.clicksHistory.length > 100) {
          urlData.clicksHistory = urlData.clicksHistory.slice(-100);
        }
        
        // Sauvegarder les stats (en arrière-plan)
        await env.URLS.put(shortCode, JSON.stringify(urlData));

        // Rediriger vers l'URL longue
        return Response.redirect(urlData.longUrl, 302);
      }
    }

    // ============================================
    // Page d'accueil ou 404
    // ============================================
    if (path === '/' || path === '') {
      // Rediriger vers le site principal ou afficher une page d'accueil
      return new Response(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Massive Medias - URL Shortener</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
            }
            h1 { font-size: 2.5rem; margin-bottom: 1rem; }
            p { opacity: 0.9; font-size: 1.2rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔗 Massive Medias</h1>
            <p>Service de raccourcissement d'URL</p>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // 404 pour les liens non trouvés
    return new Response(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>404 - Lien non trouvé</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          h1 { font-size: 4rem; margin-bottom: 1rem; }
          p { opacity: 0.9; font-size: 1.2rem; }
          a { color: white; margin-top: 1rem; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>404</h1>
          <p>Ce lien n'existe pas ou a expiré.</p>
          <a href="https://www.massivemedias.com">← Retour au site</a>
        </div>
      </body>
      </html>
    `, {
      status: 404,
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
};
