import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QrCode, Link, MessageSquare, User, Copy, Check, Trash2, Sparkles, Camera, X, History, Save, ChevronDown, ChevronUp, RotateCcw, Moon, Sun, Palette, FileImage, FileCode, Image, Circle, Square, RectangleHorizontal, Scissors, ExternalLink, BarChart3, Loader2 } from 'lucide-react';
import QRCodeLib from 'qrcode';
import QRCodeStyling from 'qr-code-styling';

// Constantes
const TABS = {
  URL: 'url',
  TEXT: 'texte',
  CONTACT: 'contact',
  SHORTENER: 'shortener'
};

const TAB_CONFIG = [
  { id: TABS.URL, label: 'URL', icon: Link },
  { id: TABS.TEXT, label: 'Texte', icon: MessageSquare },
  { id: TABS.CONTACT, label: 'Contact', icon: User },
  { id: TABS.SHORTENER, label: 'Short', icon: Scissors }
];

// Configuration API Shortener
const SHORTENER_API = {
  BASE_URL: 'https://massivemedias.com',
  API_KEY: 'massive-secret-2024-change-me' // Doit correspondre au Worker
};

const INITIAL_CONTACT = {
  prenom: '',
  nom: '',
  telephone: '',
  courriel: '',
  organisation: '',
  siteWeb: '',
  photo: '' // Base64 de la photo compressée
};

// Taille max de la photo (pixels) - petite pour tenir dans le QR
const PHOTO_MAX_SIZE = 64;
// Qualité JPEG (0-1)
const PHOTO_QUALITY = 0.5;
// Clé localStorage pour l'historique
const HISTORY_STORAGE_KEY = 'qr-generator-history';
// Clé localStorage pour le thème
const THEME_STORAGE_KEY = 'qr-generator-theme';
// Clé localStorage pour les couleurs QR
const COLORS_STORAGE_KEY = 'qr-generator-colors';
// Nombre max d'éléments dans l'historique
const MAX_HISTORY_ITEMS = 50;
// Couleurs par défaut
const DEFAULT_COLORS = {
  foreground: '#1f2937',
  background: '#ffffff'
};
// Presets de couleurs populaires
const COLOR_PRESETS = [
  { name: 'Classique', foreground: '#1f2937', background: '#ffffff' },
  { name: 'Noir & Blanc', foreground: '#000000', background: '#ffffff' },
  { name: 'Bleu', foreground: '#1e40af', background: '#dbeafe' },
  { name: 'Violet', foreground: '#7c3aed', background: '#f5f3ff' },
  { name: 'Vert', foreground: '#166534', background: '#dcfce7' },
  { name: 'Rouge', foreground: '#991b1b', background: '#fee2e2' },
  { name: 'Orange', foreground: '#c2410c', background: '#fff7ed' },
  { name: 'Inversé', foreground: '#ffffff', background: '#1f2937' },
];

// Options de style pour les points du QR
const DOT_STYLES = [
  { id: 'square', name: 'Carré', icon: Square },
  { id: 'dots', name: 'Rond', icon: Circle },
  { id: 'rounded', name: 'Arrondi', icon: RectangleHorizontal },
  { id: 'extra-rounded', name: 'Très arrondi', icon: Circle },
  { id: 'classy', name: 'Classique', icon: Square },
  { id: 'classy-rounded', name: 'Classique arrondi', icon: RectangleHorizontal },
];

// Options de style pour les coins (les 3 grands carrés)
const CORNER_STYLES = [
  { id: 'square', name: 'Carré' },
  { id: 'dot', name: 'Rond' },
  { id: 'extra-rounded', name: 'Très arrondi' },
];

// Clé localStorage pour les options de style
const STYLE_STORAGE_KEY = 'qr-generator-style';

// Style par défaut
const DEFAULT_STYLE = {
  dotType: 'square',
  cornerSquareType: 'square',
  cornerDotType: 'square',
  logo: null,
  logoSize: 0.3, // 30% de la taille du QR
};

function App() {
  // États
  const [activeTab, setActiveTab] = useState(TABS.URL);
  const [url, setUrl] = useState('');
  const [texte, setTexte] = useState('');
  const [contact, setContact] = useState(INITIAL_CONTACT);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // États pour l'historique
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // États pour le URL Shortener
  const [shortenerUrl, setShortenerUrl] = useState('');
  const [shortenerCustomCode, setShortenerCustomCode] = useState('');
  const [shortenerResult, setShortenerResult] = useState(null);
  const [shortenerLoading, setShortenerLoading] = useState(false);
  const [shortenerError, setShortenerError] = useState('');
  const [shortenerStats, setShortenerStats] = useState(null);
  const [shortenerCopied, setShortenerCopied] = useState(false);
  
  // État pour l'animation de morphing
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showGlow, setShowGlow] = useState(false);
  
  // États pour les couleurs du QR
  const [qrColors, setQrColors] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(COLORS_STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return DEFAULT_COLORS;
        }
      }
    }
    return DEFAULT_COLORS;
  });
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // État pour le SVG
  const [qrSvgString, setQrSvgString] = useState('');
  
  // États pour les options de style avancées
  const [qrStyle, setQrStyle] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STYLE_STORAGE_KEY);
      if (saved) {
        try {
          return { ...DEFAULT_STYLE, ...JSON.parse(saved) };
        } catch (e) {
          return DEFAULT_STYLE;
        }
      }
    }
    return DEFAULT_STYLE;
  });
  
  // Ref pour QRCodeStyling
  const qrCodeStylingRef = useRef(null);
  
  // État pour le mode sombre
  const [darkMode, setDarkMode] = useState(() => {
    // Initialiser depuis localStorage ou mode sombre par défaut
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved !== null) {
        return saved === 'dark';
      }
    }
    return true; // Mode sombre par défaut
  });
  
  // Refs
  const canvasRef = useRef(null);
  const qrContainerRef = useRef(null);
  const photoInputRef = useRef(null);
  const photoCanvasRef = useRef(null);

  // Fonction pour compresser et redimensionner une image
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = photoCanvasRef.current || document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculer les dimensions pour garder le ratio
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > PHOTO_MAX_SIZE) {
              height = Math.round((height * PHOTO_MAX_SIZE) / width);
              width = PHOTO_MAX_SIZE;
            }
          } else {
            if (height > PHOTO_MAX_SIZE) {
              width = Math.round((width * PHOTO_MAX_SIZE) / height);
              height = PHOTO_MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Dessiner l'image redimensionnée
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convertir en base64 JPEG compressé
          const base64 = canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
          // Extraire seulement la partie base64 (sans le préfixe data:image/jpeg;base64,)
          const base64Data = base64.split(',')[1];
          
          resolve(base64Data);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Gérer l'upload de photo
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Vérifier que c'est une image
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image');
      return;
    }
    
    try {
      const compressedBase64 = await compressImage(file);
      updateContact('photo', compressedBase64);
    } catch (error) {
      console.error('Erreur lors de la compression:', error);
      alert('Erreur lors du traitement de l\'image');
    }
  };

  // Supprimer la photo
  const handleRemovePhoto = () => {
    updateContact('photo', '');
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  // Charger l'historique depuis localStorage au démarrage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error);
    }
  }, []);

  // Sauvegarder le thème dans localStorage
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Sauvegarder les couleurs dans localStorage
  useEffect(() => {
    localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(qrColors));
  }, [qrColors]);

  // Sauvegarder les options de style dans localStorage
  useEffect(() => {
    const styleToSave = { ...qrStyle, logo: null }; // Ne pas sauvegarder le logo
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(styleToSave));
  }, [qrStyle]);

  // Basculer le mode sombre
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  // Sauvegarder l'historique dans localStorage
  const saveHistoryToStorage = (newHistory) => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'historique:', error);
    }
  };

  // Générer un label pour l'élément d'historique
  const generateLabel = () => {
    switch (activeTab) {
      case TABS.URL:
        return url.length > 30 ? url.substring(0, 30) + '...' : url;
      case TABS.TEXT:
        return texte.length > 30 ? texte.substring(0, 30) + '...' : texte;
      case TABS.CONTACT:
        const name = `${contact.prenom} ${contact.nom}`.trim();
        return name || contact.courriel || contact.telephone || 'Contact';
      default:
        return 'QR Code';
    }
  };

  // Sauvegarder le QR actuel dans l'historique
  const handleSaveToHistory = () => {
    if (!qrDataUrl || !getQRData()) return;

    const newItem = {
      id: Date.now().toString(),
      type: activeTab,
      label: generateLabel(),
      data: activeTab === TABS.URL ? url : activeTab === TABS.TEXT ? texte : { ...contact },
      qrDataUrl: qrDataUrl,
      createdAt: new Date().toISOString()
    };

    const newHistory = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);
    setHistory(newHistory);
    saveHistoryToStorage(newHistory);
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Charger un élément de l'historique
  const handleLoadFromHistory = (item) => {
    setActiveTab(item.type);
    
    switch (item.type) {
      case TABS.URL:
        setUrl(item.data);
        break;
      case TABS.TEXT:
        setTexte(item.data);
        break;
      case TABS.CONTACT:
        setContact(item.data);
        break;
      default:
        break;
    }
  };

  // Supprimer un élément de l'historique
  const handleDeleteFromHistory = (id, e) => {
    e.stopPropagation();
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    saveHistoryToStorage(newHistory);
  };

  // Vider tout l'historique
  const handleClearHistory = () => {
    if (window.confirm('Voulez-vous vraiment supprimer tout l\'historique ?')) {
      setHistory([]);
      saveHistoryToStorage([]);
    }
  };

  // Formater la date
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('fr-CA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Obtenir l'icône selon le type
  const getTypeIcon = (type) => {
    switch (type) {
      case TABS.URL:
        return Link;
      case TABS.TEXT:
        return MessageSquare;
      case TABS.CONTACT:
        return User;
      default:
        return QrCode;
    }
  };

  // Formatage URL avec https://
  const formatUrl = (inputUrl) => {
    if (!inputUrl) return '';
    const trimmed = inputUrl.trim();
    if (trimmed && !trimmed.match(/^https?:\/\//i)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  // Génération vCard format 3.0
  const generateVCard = () => {
    const { prenom, nom, telephone, courriel, organisation, siteWeb, photo } = contact;
    
    if (!prenom && !nom && !telephone && !courriel) return '';

    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${nom};${prenom};;;`,
      `FN:${prenom} ${nom}`.trim(),
      telephone ? `TEL;TYPE=CELL:${telephone}` : '',
      courriel ? `EMAIL:${courriel}` : '',
      organisation ? `ORG:${organisation}` : '',
      siteWeb ? `URL:${formatUrl(siteWeb)}` : '',
      photo ? `PHOTO;ENCODING=b;TYPE=JPEG:${photo}` : '',
      'END:VCARD'
    ].filter(Boolean).join('\n');

    return vcard;
  };

  // Obtenir les données à encoder
  const getQRData = useCallback(() => {
    switch (activeTab) {
      case TABS.URL:
        return formatUrl(url);
      case TABS.TEXT:
        return texte;
      case TABS.CONTACT:
        return generateVCard();
      default:
        return '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, url, texte, contact]);

  // Génération QR avec QRCodeStyling (stylisé) et qrcode (SVG simple)
  const generateQR = useCallback(async (data, colors, style) => {
    if (!data) {
      setQrDataUrl('');
      setQrSvgString('');
      return;
    }

    // Déclencher l'animation de transition si on a déjà un QR
    const hadPreviousQR = qrDataUrl !== '';
    if (hadPreviousQR) {
      setIsTransitioning(true);
    }

    setIsGenerating(true);

    const { foreground, background } = colors;
    const { dotType, cornerSquareType, cornerDotType, logo, logoSize } = style;

    // Configuration pour QRCodeStyling
    const qrOptions = {
      width: 280,
      height: 280,
      data: data,
      margin: 8,
      qrOptions: {
        errorCorrectionLevel: 'H'
      },
      dotsOptions: {
        color: foreground,
        type: dotType
      },
      backgroundOptions: {
        color: background
      },
      cornersSquareOptions: {
        color: foreground,
        type: cornerSquareType
      },
      cornersDotOptions: {
        color: foreground,
        type: cornerDotType
      }
    };

    // Ajouter le logo si présent
    if (logo) {
      qrOptions.image = logo;
      qrOptions.imageOptions = {
        crossOrigin: 'anonymous',
        margin: 4,
        imageSize: logoSize,
        hideBackgroundDots: true
      };
    }

    try {
      // Créer ou mettre à jour l'instance QRCodeStyling
      if (!qrCodeStylingRef.current) {
        qrCodeStylingRef.current = new QRCodeStyling(qrOptions);
      } else {
        qrCodeStylingRef.current.update(qrOptions);
      }

      // Générer le PNG
      const pngBlob = await qrCodeStylingRef.current.getRawData('png');
      const pngUrl = URL.createObjectURL(pngBlob);
      
      // Petit délai pour l'animation
      if (hadPreviousQR) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setQrDataUrl(pngUrl);

      // Générer le SVG
      const svgBlob = await qrCodeStylingRef.current.getRawData('svg');
      const svgText = await svgBlob.text();
      setQrSvgString(svgText);

      setIsGenerating(false);
      
      // Déclencher l'animation d'entrée et le glow
      setTimeout(() => {
        setIsTransitioning(false);
        setShowGlow(true);
        setTimeout(() => setShowGlow(false), 500);
      }, 50);

    } catch (error) {
      console.error('QRCodeStyling generation failed:', error);
      
      // Fallback vers la génération simple avec qrcode
      try {
        const svgString = await QRCodeLib.toString(data, {
          type: 'svg',
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 280,
          color: {
            dark: foreground,
            light: background
          }
        });
        setQrSvgString(svgString);
        
        // Créer un data URL à partir du SVG
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);
        setQrDataUrl(url);
      } catch (fallbackError) {
        console.error('Fallback generation failed:', fallbackError);
        setQrDataUrl('');
        setQrSvgString('');
      }
      
      setIsGenerating(false);
      setIsTransitioning(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effet pour régénérer le QR quand les données, couleurs ou style changent
  useEffect(() => {
    const data = getQRData();
    const timeoutId = setTimeout(() => {
      generateQR(data, qrColors, qrStyle);
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [getQRData, generateQR, qrColors, qrStyle]);

  // Téléchargement du QR en PNG
  const handleDownloadPng = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.download = `qr-code-${activeTab}-${Date.now()}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  // Téléchargement du QR en SVG
  const handleDownloadSvg = () => {
    if (!qrSvgString) return;

    const blob = new Blob([qrSvgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `qr-code-${activeTab}-${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Fonction pour mettre à jour les couleurs
  const updateColors = (key, value) => {
    setQrColors(prev => ({ ...prev, [key]: value }));
  };

  // Appliquer un preset de couleur
  const applyColorPreset = (preset) => {
    setQrColors({
      foreground: preset.foreground,
      background: preset.background
    });
  };

  // Réinitialiser les couleurs
  const resetColors = () => {
    setQrColors(DEFAULT_COLORS);
  };

  // Mettre à jour le style
  const updateStyle = (key, value) => {
    setQrStyle(prev => ({ ...prev, [key]: value }));
  };

  // Gérer l'upload du logo
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      updateStyle('logo', event.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Supprimer le logo
  const removeLogo = () => {
    updateStyle('logo', null);
  };

  // Réinitialiser le style
  const resetStyle = () => {
    setQrStyle(DEFAULT_STYLE);
  };

  // ============================================
  // FONCTIONS URL SHORTENER
  // ============================================
  
  // Créer un lien court
  const handleCreateShortUrl = async () => {
    if (!shortenerUrl) {
      setShortenerError('Veuillez entrer une URL');
      return;
    }

    // Valider l'URL
    let urlToShorten = shortenerUrl.trim();
    if (!urlToShorten.match(/^https?:\/\//i)) {
      urlToShorten = `https://${urlToShorten}`;
    }

    try {
      new URL(urlToShorten);
    } catch {
      setShortenerError('URL invalide');
      return;
    }

    setShortenerLoading(true);
    setShortenerError('');
    setShortenerResult(null);

    try {
      const response = await fetch(`${SHORTENER_API.BASE_URL}/api/shorten`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': SHORTENER_API.API_KEY
        },
        body: JSON.stringify({
          longUrl: urlToShorten,
          customCode: shortenerCustomCode || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création');
      }

      setShortenerResult(data);
      setShortenerError('');
      
      // Charger les stats
      fetchShortenerStats(data.shortCode);
      
    } catch (error) {
      console.error('Shortener error:', error);
      setShortenerError(error.message || 'Erreur de connexion au serveur');
    } finally {
      setShortenerLoading(false);
    }
  };

  // Récupérer les stats d'un lien
  const fetchShortenerStats = async (code) => {
    try {
      const response = await fetch(`${SHORTENER_API.BASE_URL}/api/stats/${code}`);
      if (response.ok) {
        const data = await response.json();
        setShortenerStats(data);
      }
    } catch (error) {
      console.error('Stats fetch error:', error);
    }
  };

  // Copier le lien court
  const handleCopyShortUrl = async () => {
    if (!shortenerResult?.shortUrl) return;

    try {
      await navigator.clipboard.writeText(shortenerResult.shortUrl);
      setShortenerCopied(true);
      setTimeout(() => setShortenerCopied(false), 2000);
    } catch (error) {
      console.error('Copy error:', error);
    }
  };

  // Utiliser le lien court pour générer un QR
  const handleUseShortUrlForQR = () => {
    if (!shortenerResult?.shortUrl) return;
    setActiveTab(TABS.URL);
    setUrl(shortenerResult.shortUrl);
  };

  // Réinitialiser le shortener
  const handleResetShortener = () => {
    setShortenerUrl('');
    setShortenerCustomCode('');
    setShortenerResult(null);
    setShortenerError('');
    setShortenerStats(null);
  };

  // Copie des données dans le presse-papier
  const handleCopy = async () => {
    const data = getQRData();
    if (!data) return;

    try {
      await navigator.clipboard.writeText(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Erreur de copie:', error);
      // Fallback pour navigateurs plus anciens
      const textArea = document.createElement('textarea');
      textArea.value = data;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Effacer le formulaire
  const handleClear = () => {
    switch (activeTab) {
      case TABS.URL:
        setUrl('');
        break;
      case TABS.TEXT:
        setTexte('');
        break;
      case TABS.CONTACT:
        setContact(INITIAL_CONTACT);
        break;
      default:
        break;
    }
  };

  // Mise à jour des champs contact
  const updateContact = (field, value) => {
    setContact(prev => ({ ...prev, [field]: value }));
  };

  // Rendu du formulaire selon l'onglet actif
  const renderForm = () => {
    switch (activeTab) {
      case TABS.URL:
        return (
          <div className="space-y-4 animate-fade-in">
            <label className="block">
              <span className={`text-sm font-medium mb-2 block transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Adresse URL
              </span>
              <div className="relative">
                <Link className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="exemple.com ou https://exemple.com"
                  className="input-field pl-12"
                  autoComplete="url"
                />
              </div>
              <p className={`text-xs mt-2 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                💡 Le préfixe https:// sera ajouté automatiquement si manquant
              </p>
            </label>
          </div>
        );

      case TABS.TEXT:
        return (
          <div className="space-y-4 animate-fade-in">
            <label className="block">
              <span className={`text-sm font-medium mb-2 block transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Texte à encoder
              </span>
              <textarea
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                placeholder="Entrez votre texte ici..."
                rows={5}
                className="input-field resize-none"
                maxLength={1000}
              />
              <p className={`text-xs mt-2 text-right transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                {texte.length} / 1000 caractères
              </p>
            </label>
          </div>
        );

      case TABS.CONTACT:
        return (
          <div className="space-y-4 animate-fade-in">
            {/* Photo du contact */}
            <div className="block">
              <span className={`text-sm font-medium mb-2 block transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Photo du contact</span>
              <div className="flex items-center gap-4">
                {contact.photo ? (
                  <div className="relative">
                    <img
                      src={`data:image/jpeg;base64,${contact.photo}`}
                      alt="Contact"
                      className="w-16 h-16 rounded-full object-cover border-2 border-primary-200 shadow-md"
                    />
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                      title="Supprimer la photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className={`w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-colors duration-500 ${
                    darkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-100 border-gray-300'
                  }`}>
                    <Camera className={`w-6 h-6 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-colors text-sm font-medium ${
                      darkMode 
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    {contact.photo ? 'Changer la photo' : 'Ajouter une photo'}
                  </label>
                  <p className={`text-xs mt-1 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    📷 Image compressée automatiquement (64x64px)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={`text-sm font-medium mb-2 block transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Prénom</span>
                <input
                  type="text"
                  value={contact.prenom}
                  onChange={(e) => updateContact('prenom', e.target.value)}
                  placeholder="Jean"
                  className="input-field"
                />
              </label>
              <label className="block">
                <span className={`text-sm font-medium mb-2 block transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Nom</span>
                <input
                  type="text"
                  value={contact.nom}
                  onChange={(e) => updateContact('nom', e.target.value)}
                  placeholder="Dupont"
                  className="input-field"
                />
              </label>
            </div>
            
            <label className="block">
              <span className={`text-sm font-medium mb-2 block transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Téléphone</span>
              <input
                type="tel"
                value={contact.telephone}
                onChange={(e) => updateContact('telephone', e.target.value)}
                placeholder="+1 514 123-4567"
                className="input-field"
              />
            </label>
            
            <label className="block">
              <span className={`text-sm font-medium mb-2 block transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Courriel</span>
              <input
                type="email"
                value={contact.courriel}
                onChange={(e) => updateContact('courriel', e.target.value)}
                placeholder="jean.dupont@exemple.com"
                className="input-field"
              />
            </label>
            
            <label className="block">
              <span className={`text-sm font-medium mb-2 block transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Organisation</span>
              <input
                type="text"
                value={contact.organisation}
                onChange={(e) => updateContact('organisation', e.target.value)}
                placeholder="Nom de l'entreprise"
                className="input-field"
              />
            </label>
            
            <label className="block">
              <span className={`text-sm font-medium mb-2 block transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Site web</span>
              <input
                type="url"
                value={contact.siteWeb}
                onChange={(e) => updateContact('siteWeb', e.target.value)}
                placeholder="www.exemple.com"
                className="input-field"
              />
            </label>

            {/* Canvas caché pour la compression photo */}
            <canvas ref={photoCanvasRef} className="hidden" />
          </div>
        );

      case TABS.SHORTENER:
        return (
          <div className="space-y-4 animate-fade-in">
            {/* Input URL longue */}
            <label className="block">
              <span className={`text-sm font-medium mb-2 block transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                URL à raccourcir
              </span>
              <div className="relative">
                <Link className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="url"
                  value={shortenerUrl}
                  onChange={(e) => setShortenerUrl(e.target.value)}
                  placeholder="https://exemple.com/une-tres-longue-url"
                  className="input-field pl-12"
                  disabled={shortenerLoading}
                />
              </div>
            </label>

            {/* Code personnalisé (optionnel) */}
            <label className="block">
              <span className={`text-sm font-medium mb-2 block transition-colors duration-500 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Code personnalisé <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>(optionnel)</span>
              </span>
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  massivemedias.com/
                </span>
                <input
                  type="text"
                  value={shortenerCustomCode}
                  onChange={(e) => setShortenerCustomCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="mon-lien"
                  className="input-field pl-40"
                  maxLength={30}
                  disabled={shortenerLoading}
                />
              </div>
              <p className={`text-xs mt-1 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Laissez vide pour un code auto-généré
              </p>
            </label>

            {/* Bouton Raccourcir */}
            <button
              onClick={handleCreateShortUrl}
              disabled={!shortenerUrl || shortenerLoading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {shortenerLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Scissors className="w-5 h-5" />
                  Raccourcir l'URL
                </>
              )}
            </button>

            {/* Message d'erreur */}
            {shortenerError && (
              <div className="p-3 rounded-xl bg-red-100 text-red-700 text-sm">
                ⚠️ {shortenerError}
              </div>
            )}

            {/* Résultat */}
            {shortenerResult && (
              <div className={`p-4 rounded-xl border-2 transition-colors duration-500 ${
                darkMode 
                  ? 'bg-green-900/30 border-green-700' 
                  : 'bg-green-50 border-green-200'
              }`}>
                <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-green-300' : 'text-green-700'}`}>
                  ✅ Lien créé avec succès !
                </p>
                
                {/* Lien court */}
                <div className={`flex items-center gap-2 p-3 rounded-lg mb-3 ${
                  darkMode ? 'bg-gray-800' : 'bg-white'
                }`}>
                  <a 
                    href={shortenerResult.shortUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 font-mono text-primary-500 hover:underline truncate"
                  >
                    {shortenerResult.shortUrl}
                  </a>
                  <button
                    onClick={handleCopyShortUrl}
                    className={`p-2 rounded-lg transition-colors ${
                      darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    }`}
                    title="Copier"
                  >
                    {shortenerCopied ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                  <a
                    href={shortenerResult.shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-2 rounded-lg transition-colors ${
                      darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    }`}
                    title="Ouvrir"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                </div>

                {/* Stats */}
                {shortenerStats && (
                  <div className={`flex items-center gap-4 text-sm mb-3 ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <span className="flex items-center gap-1">
                      <BarChart3 className="w-4 h-4" />
                      {shortenerStats.clicks} clic{shortenerStats.clicks !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleUseShortUrlForQR}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      darkMode 
                        ? 'bg-primary-600 hover:bg-primary-700 text-white' 
                        : 'bg-primary-500 hover:bg-primary-600 text-white'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    Créer un QR Code
                  </button>
                  <button
                    onClick={handleResetShortener}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      darkMode 
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    Nouveau
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const hasData = getQRData().length > 0;

  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'dark-mode gradient-bg-dark' : 'gradient-bg'} pattern-dots`}>
      {/* Bouton mode sombre - discret en haut à droite */}
      <button
        onClick={toggleDarkMode}
        className={`fixed top-4 right-4 p-2.5 rounded-xl transition-all duration-300 z-50 ${
          darkMode 
            ? 'bg-white/10 hover:bg-white/20 text-yellow-300' 
            : 'bg-white/20 hover:bg-white/30 text-white'
        }`}
        title={darkMode ? 'Mode jour' : 'Mode nuit'}
      >
        {darkMode ? (
          <Sun className="w-5 h-5" />
        ) : (
          <Moon className="w-5 h-5" />
        )}
      </button>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-8 pb-12 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-8">
          
          <div className="flex flex-col gap-4">
            {/* Logo Massive */}
            <img 
              src="/logo-massive.svg" 
              alt="Massive" 
              className="h-12 md:h-14 w-auto self-start"
            />
            
            {/* Panneau de gauche - Formulaire */}
            <div className={`animate-slide-up rounded-3xl p-8 border transition-all duration-500 ${
            darkMode 
              ? 'bg-gray-900/95 backdrop-blur-xl border-gray-700/30 dark-card-shadow dark-glow' 
              : 'bg-white/90 backdrop-blur-xl border-white/50 shadow-2xl'
          }`}>
            {/* Onglets */}
            <div className={`flex gap-2 p-2 rounded-2xl mb-8 transition-colors duration-500 ${
              darkMode ? 'bg-gray-800/80' : 'bg-gray-100/80'
            }`}>
              {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`tab-button flex-1 transition-all duration-300 text-sm ${
                    activeTab === id 
                      ? darkMode 
                        ? 'bg-gray-700 text-primary-400 shadow-lg shadow-primary-500/20' 
                        : 'bg-white text-primary-600 shadow-lg shadow-primary-500/20'
                      : darkMode
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Formulaire */}
            <div className={activeTab !== TABS.SHORTENER ? "mb-8" : ""}>
              {renderForm()}
            </div>

            {/* Options QR (masquées pour Shortener) */}
            {activeTab !== TABS.SHORTENER && (
            <>
            {/* Sélecteur de couleurs */}
            <div className="mb-6">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600' 
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5 text-primary-500" />
                  <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Personnaliser les couleurs
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: qrColors.foreground }}
                  />
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm"
                    style={{ backgroundColor: qrColors.background }}
                  />
                  {showColorPicker ? (
                    <ChevronUp className={`w-4 h-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  ) : (
                    <ChevronDown className={`w-4 h-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                  )}
                </div>
              </button>
              
              {showColorPicker && (
                <div className={`mt-3 p-4 rounded-xl border animate-fade-in ${
                  darkMode 
                    ? 'bg-gray-800/80 border-gray-700' 
                    : 'bg-white border-gray-200'
                }`}>
                  {/* Sélecteurs de couleur */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <label className="block">
                      <span className={`text-sm font-medium mb-2 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Premier plan
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={qrColors.foreground}
                          onChange={(e) => updateColors('foreground', e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer border-0"
                        />
                        <input
                          type="text"
                          value={qrColors.foreground}
                          onChange={(e) => updateColors('foreground', e.target.value)}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-mono uppercase ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-200' 
                              : 'bg-gray-50 border-gray-200 text-gray-700'
                          } border`}
                        />
                      </div>
                    </label>
                    <label className="block">
                      <span className={`text-sm font-medium mb-2 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Arrière-plan
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={qrColors.background}
                          onChange={(e) => updateColors('background', e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer border-0"
                        />
                        <input
                          type="text"
                          value={qrColors.background}
                          onChange={(e) => updateColors('background', e.target.value)}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-mono uppercase ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-200' 
                              : 'bg-gray-50 border-gray-200 text-gray-700'
                          } border`}
                        />
                      </div>
                    </label>
                  </div>
                  
                  {/* Presets de couleurs */}
                  <div className="mb-3">
                    <span className={`text-xs font-medium uppercase tracking-wide mb-2 block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Presets
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => applyColorPreset(preset)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            qrColors.foreground === preset.foreground && qrColors.background === preset.background
                              ? 'ring-2 ring-primary-500 ring-offset-1'
                              : ''
                          } ${
                            darkMode 
                              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                          title={preset.name}
                        >
                          <div className="flex">
                            <div 
                              className="w-4 h-4 rounded-l border border-r-0 border-gray-400"
                              style={{ backgroundColor: preset.foreground }}
                            />
                            <div 
                              className="w-4 h-4 rounded-r border border-gray-400"
                              style={{ backgroundColor: preset.background }}
                            />
                          </div>
                          <span>{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Bouton réinitialiser */}
                  <button
                    onClick={resetColors}
                    className={`text-sm flex items-center gap-1 transition-colors ${
                      darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Réinitialiser
                  </button>
                </div>
              )}
            </div>

            {/* Options de style avancées */}
            <div className="mb-6">
              <div className={`p-4 rounded-xl border ${
                darkMode 
                  ? 'bg-gray-800/50 border-gray-700' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-primary-500" />
                  <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    Style du QR Code
                  </span>
                </div>

                {/* Style des points */}
                <div className="mb-4">
                  <span className={`text-xs font-medium uppercase tracking-wide mb-2 block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Forme des points
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {DOT_STYLES.map((style) => {
                      const IconComponent = style.icon;
                      return (
                        <button
                          key={style.id}
                          onClick={() => updateStyle('dotType', style.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            qrStyle.dotType === style.id
                              ? 'ring-2 ring-primary-500 bg-primary-500/20 text-primary-500'
                              : darkMode 
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                                : 'bg-white hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                          <span className="hidden sm:inline">{style.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Style des coins */}
                <div className="mb-4">
                  <span className={`text-xs font-medium uppercase tracking-wide mb-2 block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Forme des coins
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {CORNER_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => {
                          updateStyle('cornerSquareType', style.id);
                          updateStyle('cornerDotType', style.id === 'dot' ? 'dot' : 'square');
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          qrStyle.cornerSquareType === style.id
                            ? 'ring-2 ring-primary-500 bg-primary-500/20 text-primary-500'
                            : darkMode 
                              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                              : 'bg-white hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {style.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo au centre */}
                <div className="mb-3">
                  <span className={`text-xs font-medium uppercase tracking-wide mb-2 block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Logo au centre
                  </span>
                  <div className="flex items-center gap-3">
                    {qrStyle.logo ? (
                      <div className="relative">
                        <img
                          src={qrStyle.logo}
                          alt="Logo"
                          className="w-12 h-12 rounded-lg object-contain border-2 border-primary-200"
                        />
                        <button
                          onClick={removeLogo}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className={`w-12 h-12 rounded-lg border-2 border-dashed flex items-center justify-center ${
                        darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-100'
                      }`}>
                        <Image className={`w-5 h-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm font-medium transition-colors ${
                          darkMode 
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                            : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        <Image className="w-4 h-4" />
                        {qrStyle.logo ? 'Changer' : 'Ajouter un logo'}
                      </label>
                    </div>
                  </div>
                  
                  {/* Slider pour la taille du logo */}
                  {qrStyle.logo && (
                    <div className="mt-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Taille du logo
                        </span>
                        <span className={`text-xs font-mono ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {Math.round(qrStyle.logoSize * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.5"
                        step="0.05"
                        value={qrStyle.logoSize}
                        onChange={(e) => updateStyle('logoSize', parseFloat(e.target.value))}
                        className="w-full accent-primary-500"
                      />
                    </div>
                  )}
                </div>

                {/* Bouton réinitialiser le style */}
                <button
                  onClick={resetStyle}
                  className={`text-sm flex items-center gap-1 transition-colors ${
                    darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  Style par défaut
                </button>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDownloadPng}
                disabled={!qrDataUrl}
                className="btn-primary flex-1 min-w-[120px] disabled:opacity-50 disabled:cursor-not-allowed"
                title="Télécharger en PNG"
              >
                <FileImage className="w-5 h-5" />
                PNG
              </button>
              
              <button
                onClick={handleDownloadSvg}
                disabled={!qrSvgString}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold flex-1 min-w-[120px] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/30' 
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/30'
                }`}
                title="Télécharger en SVG (vectoriel, couleurs modifiables)"
              >
                <FileCode className="w-5 h-5" />
                SVG
              </button>
              
              <button
                onClick={handleSaveToHistory}
                disabled={!qrDataUrl}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold flex-1 min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {saved ? (
                  <>
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-green-500">Sauvegardé !</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Sauvegarder
                  </>
                )}
              </button>
              
              <button
                onClick={handleCopy}
                disabled={!hasData}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-300 ${
                  darkMode 
                    ? 'border-2 border-gray-600 text-gray-300 hover:border-primary-400 hover:text-primary-400' 
                    : 'border-2 border-gray-200 text-gray-600 hover:border-primary-500 hover:text-primary-600'
                }`}
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
              
              <button
                onClick={handleClear}
                disabled={!hasData}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-300 ${
                  darkMode 
                    ? 'border-2 border-gray-600 text-gray-300 hover:border-red-400 hover:text-red-400' 
                    : 'border-2 border-gray-200 text-gray-600 hover:border-red-500 hover:text-red-500'
                }`}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            </>
            )}
          </div>
          </div>

          {/* Panneau de droite - QR Code */}
          <div className={`animate-slide-up flex flex-col rounded-3xl p-8 border transition-all duration-500 ${
            darkMode 
              ? 'bg-gray-900/95 backdrop-blur-xl border-gray-700/30 dark-card-shadow dark-glow' 
              : 'bg-white/90 backdrop-blur-xl border-white/50 shadow-2xl'
          }`} style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-primary-500" />
              <h2 className={`text-xl font-semibold transition-colors duration-500 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                Aperçu du Code QR
              </h2>
            </div>

            {/* Canvas caché pour QRious - hors du flux */}
            <canvas ref={canvasRef} className="hidden absolute" />
            
            <div 
              ref={qrContainerRef}
              className={`grid place-items-center p-8 rounded-2xl flex-1 min-h-[320px] transition-colors duration-500 ${
                darkMode 
                  ? 'bg-gray-800 shadow-inner border-2 border-dashed border-gray-600' 
                  : 'bg-white shadow-inner border-2 border-dashed border-gray-200'
              }`}
            >
              {isGenerating && !qrDataUrl ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                  <p className="text-gray-500">Génération en cours...</p>
                </div>
              ) : qrDataUrl ? (
                <div 
                  className={`p-4 rounded-lg shadow-lg ${showGlow ? 'qr-glow' : ''}`}
                  style={{ backgroundColor: qrColors.background }}
                >
                  <img
                    src={qrDataUrl}
                    alt="Code QR généré"
                    className={`qr-morph block ${
                      isTransitioning ? 'qr-morph-enter' : 'qr-morph-active'
                    } ${isGenerating ? 'qr-generating' : ''}`}
                    style={{ width: '248px', height: '248px' }}
                  />
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className={`w-24 h-24 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-colors duration-500 ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <QrCode className={`w-12 h-12 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-300'}`} />
                  </div>
                  <p className={`font-medium transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Entrez des données pour générer un code QR
                  </p>
                  <p className={`text-sm mt-2 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Le code QR apparaîtra ici automatiquement
                  </p>
                </div>
              )}
            </div>

            {/* Info sur les données encodées */}
            {hasData && (
              <div className={`mt-6 p-4 rounded-xl transition-colors duration-500 ${
                darkMode ? 'bg-gray-800' : 'bg-gray-50'
              }`}>
                <p className={`text-xs font-medium uppercase tracking-wide mb-2 transition-colors duration-500 ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Données encodées
                </p>
                <p className={`text-sm font-mono break-all line-clamp-3 transition-colors duration-500 ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {getQRData()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section Historique */}
        <div className="mt-8">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`w-full flex items-center justify-between p-4 rounded-3xl border transition-all duration-500 ${
              darkMode 
                ? 'bg-gray-900/95 backdrop-blur-xl border-gray-700/30 dark-card-shadow hover:bg-gray-800/95' 
                : 'bg-white/90 backdrop-blur-xl border-white/50 shadow-2xl hover:bg-white/95'
            }`}
          >
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-primary-500" />
              <span className={`font-semibold transition-colors duration-500 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                Historique des codes QR
              </span>
              {history.length > 0 && (
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors duration-500 ${
                  darkMode ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-100 text-primary-700'
                }`}>
                  {history.length}
                </span>
              )}
            </div>
            {showHistory ? (
              <ChevronUp className={`w-5 h-5 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            ) : (
              <ChevronDown className={`w-5 h-5 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            )}
          </button>

          {showHistory && (
            <div className={`mt-2 p-4 animate-fade-in rounded-3xl border transition-all duration-500 ${
              darkMode 
                ? 'bg-gray-900/95 backdrop-blur-xl border-gray-700/30 dark-card-shadow dark-glow' 
                : 'bg-white/90 backdrop-blur-xl border-white/50 shadow-2xl'
            }`}>
              {history.length === 0 ? (
                <div className="text-center py-8">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-colors duration-500 ${
                    darkMode ? 'bg-gray-800' : 'bg-gray-100'
                  }`}>
                    <History className={`w-8 h-8 transition-colors duration-500 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                  </div>
                  <p className={`font-medium transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Aucun code QR sauvegardé</p>
                  <p className={`text-sm mt-1 transition-colors duration-500 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Cliquez sur "Sauvegarder" pour ajouter un code à l'historique
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <p className={`text-sm transition-colors duration-500 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {history.length} code{history.length > 1 ? 's' : ''} sauvegardé{history.length > 1 ? 's' : ''}
                    </p>
                    <button
                      onClick={handleClearHistory}
                      className="text-sm text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Tout effacer
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {history.map((item) => {
                      const TypeIcon = getTypeIcon(item.type);
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleLoadFromHistory(item)}
                          className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors group ${
                            darkMode 
                              ? 'bg-gray-800 hover:bg-gray-700' 
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          {/* Miniature du QR */}
                          <div className={`w-12 h-12 rounded-lg shadow-sm flex-shrink-0 overflow-hidden ${
                            darkMode ? 'bg-gray-700' : 'bg-white'
                          }`}>
                            <img
                              src={item.qrDataUrl}
                              alt="QR"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          
                          {/* Infos */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <TypeIcon className={`w-4 h-4 flex-shrink-0 transition-colors duration-500 ${
                                darkMode ? 'text-gray-500' : 'text-gray-400'
                              }`} />
                              <span className={`font-medium truncate transition-colors duration-500 ${
                                darkMode ? 'text-gray-200' : 'text-gray-800'
                              }`}>
                                {item.label}
                              </span>
                            </div>
                            <p className={`text-xs mt-0.5 transition-colors duration-500 ${
                              darkMode ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              {formatDate(item.createdAt)}
                            </p>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoadFromHistory(item);
                              }}
                              className={`p-2 rounded-lg transition-colors ${
                                darkMode 
                                  ? 'text-primary-400 hover:bg-primary-900/30' 
                                  : 'text-primary-500 hover:bg-primary-50'
                              }`}
                              title="Charger"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteFromHistory(item.id, e)}
                              className={`p-2 rounded-lg transition-colors ${
                                darkMode 
                                  ? 'text-red-400 hover:bg-red-900/30' 
                                  : 'text-red-500 hover:bg-red-50'
                              }`}
                              title="Supprimer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-12 text-center">
          <p className="text-white/70 text-sm">
            Généré localement dans votre navigateur • Données sauvegardées dans votre navigateur uniquement
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;

