import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QrCode, Link, MessageSquare, User, Download, Copy, Check, Trash2, Sparkles, Camera, X, History, Save, ChevronDown, ChevronUp, RotateCcw, Moon, Sun } from 'lucide-react';

// Constantes
const TABS = {
  URL: 'url',
  TEXT: 'texte',
  CONTACT: 'contact'
};

const TAB_CONFIG = [
  { id: TABS.URL, label: 'URL', icon: Link },
  { id: TABS.TEXT, label: 'Texte', icon: MessageSquare },
  { id: TABS.CONTACT, label: 'Contact', icon: User }
];

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
// Nombre max d'éléments dans l'historique
const MAX_HISTORY_ITEMS = 50;

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
  
  // État pour l'animation de morphing
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showGlow, setShowGlow] = useState(false);
  
  // État pour le mode sombre
  const [darkMode, setDarkMode] = useState(() => {
    // Initialiser depuis localStorage ou préférence système
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved !== null) {
        return saved === 'dark';
      }
      // Vérifier la préférence système
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
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

  // Génération QR avec QRious (priorité) ou API fallback
  const generateQR = useCallback(async (data) => {
    if (!data) {
      setQrDataUrl('');
      return;
    }

    // Déclencher l'animation de transition si on a déjà un QR
    const hadPreviousQR = qrDataUrl !== '';
    if (hadPreviousQR) {
      setIsTransitioning(true);
    }

    setIsGenerating(true);

    try {
      // Essayer QRious d'abord (chargé via CDN)
      if (window.QRious) {
        const canvas = canvasRef.current || document.createElement('canvas');
        
        new window.QRious({
          element: canvas,
          value: data,
          size: 280,
          level: 'H', // Haute correction d'erreur
          background: '#ffffff',
          foreground: '#1f2937',
          padding: 16
        });

        const newDataUrl = canvas.toDataURL('image/png');
        
        // Petit délai pour laisser l'animation de sortie se faire
        if (hadPreviousQR) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        setQrDataUrl(newDataUrl);
        setIsGenerating(false);
        
        // Déclencher l'animation d'entrée et le glow
        setTimeout(() => {
          setIsTransitioning(false);
          setShowGlow(true);
          setTimeout(() => setShowGlow(false), 500);
        }, 50);
        
        return;
      }
    } catch (error) {
      console.warn('QRious failed, falling back to API:', error);
    }

    // Fallback vers l'API
    try {
      const encodedData = encodeURIComponent(data);
      const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodedData}&ecc=H`;
      
      // Vérifier que l'image se charge correctement
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          setQrDataUrl(canvas.toDataURL('image/png'));
          resolve();
        };
        img.onerror = reject;
        img.src = apiUrl;
      });
      
      // Animation d'entrée pour le fallback aussi
      setTimeout(() => {
        setIsTransitioning(false);
        setShowGlow(true);
        setTimeout(() => setShowGlow(false), 500);
      }, 50);
      
    } catch (error) {
      console.error('API QR generation failed:', error);
      setQrDataUrl('');
    }

    setIsGenerating(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effet pour régénérer le QR quand les données changent
  useEffect(() => {
    const data = getQRData();
    const timeoutId = setTimeout(() => {
      generateQR(data);
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [getQRData, generateQR]);

  // Téléchargement du QR
  const handleDownload = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.download = `qr-code-${activeTab}-${Date.now()}.png`;
    link.href = qrDataUrl;
    link.click();
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

      default:
        return null;
    }
  };

  const hasData = getQRData().length > 0;

  return (
    <div className={`min-h-screen transition-colors duration-500 ${darkMode ? 'dark-mode gradient-bg-dark' : 'gradient-bg'} pattern-dots`}>
      {/* Header */}
      <header className="pt-12 pb-8 px-4 text-center relative">
        {/* Bouton mode sombre - discret en haut à droite */}
        <button
          onClick={toggleDarkMode}
          className={`absolute top-4 right-4 p-2.5 rounded-xl transition-all duration-300 ${
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

        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
            <QrCode className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Générateur QR
          </h1>
        </div>
        <p className="text-white/80 text-lg max-w-md mx-auto">
          Créez des codes QR instantanément pour vos liens, textes et contacts
        </p>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pb-12 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* Panneau de gauche - Formulaire */}
          <div className={`animate-slide-up rounded-3xl shadow-2xl p-8 border transition-colors duration-500 ${
            darkMode 
              ? 'bg-gray-900/90 backdrop-blur-xl border-gray-700/50' 
              : 'bg-white/90 backdrop-blur-xl border-white/50'
          }`}>
            {/* Onglets */}
            <div className={`flex gap-2 p-2 rounded-2xl mb-8 transition-colors duration-500 ${
              darkMode ? 'bg-gray-800/80' : 'bg-gray-100/80'
            }`}>
              {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`tab-button flex-1 transition-all duration-300 ${
                    activeTab === id 
                      ? darkMode 
                        ? 'bg-gray-700 text-primary-400 shadow-lg shadow-primary-500/20' 
                        : 'bg-white text-primary-600 shadow-lg shadow-primary-500/20'
                      : darkMode
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Formulaire */}
            <div className="mb-8">
              {renderForm()}
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDownload}
                disabled={!qrDataUrl}
                className="btn-primary flex-1 min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-5 h-5" />
                Télécharger
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
          </div>

          {/* Panneau de droite - QR Code */}
          <div className={`animate-slide-up flex flex-col rounded-3xl shadow-2xl p-8 border transition-colors duration-500 ${
            darkMode 
              ? 'bg-gray-900/90 backdrop-blur-xl border-gray-700/50' 
              : 'bg-white/90 backdrop-blur-xl border-white/50'
          }`} style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-primary-500" />
              <h2 className={`text-xl font-semibold transition-colors duration-500 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                Aperçu du Code QR
              </h2>
            </div>

            <div 
              ref={qrContainerRef}
              className={`flex items-center justify-center p-8 rounded-2xl flex-1 min-h-[320px] relative transition-colors duration-500 ${
                darkMode 
                  ? 'bg-gray-800 shadow-inner border-2 border-dashed border-gray-600' 
                  : 'bg-white shadow-inner border-2 border-dashed border-gray-200'
              }`}
            >
              {/* Canvas caché pour QRious */}
              <canvas ref={canvasRef} className="hidden" />

              {isGenerating && !qrDataUrl ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                  <p className="text-gray-500">Génération en cours...</p>
                </div>
              ) : qrDataUrl ? (
                <div className={`qr-crossfade ${showGlow ? 'qr-glow' : ''}`}>
                  <img
                    src={qrDataUrl}
                    alt="Code QR généré"
                    className={`max-w-full h-auto rounded-lg shadow-lg qr-morph ${
                      isTransitioning ? 'qr-morph-enter' : 'qr-morph-active'
                    } ${isGenerating ? 'qr-generating' : ''}`}
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
            className={`w-full flex items-center justify-between p-4 rounded-3xl shadow-2xl border transition-all duration-500 ${
              darkMode 
                ? 'bg-gray-900/90 backdrop-blur-xl border-gray-700/50 hover:bg-gray-800/90' 
                : 'bg-white/90 backdrop-blur-xl border-white/50 hover:bg-white/95'
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
            <div className={`mt-2 p-4 animate-fade-in rounded-3xl shadow-2xl border transition-colors duration-500 ${
              darkMode 
                ? 'bg-gray-900/90 backdrop-blur-xl border-gray-700/50' 
                : 'bg-white/90 backdrop-blur-xl border-white/50'
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

