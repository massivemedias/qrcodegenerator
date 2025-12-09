import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QrCode, Link, MessageSquare, User, Download, Copy, Check, Trash2, Sparkles, Camera, X } from 'lucide-react';

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

function App() {
  // États
  const [activeTab, setActiveTab] = useState(TABS.URL);
  const [url, setUrl] = useState('');
  const [texte, setTexte] = useState('');
  const [contact, setContact] = useState(INITIAL_CONTACT);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
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

        setQrDataUrl(canvas.toDataURL('image/png'));
        setIsGenerating(false);
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
    } catch (error) {
      console.error('API QR generation failed:', error);
      setQrDataUrl('');
    }

    setIsGenerating(false);
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
              <span className="text-sm font-medium text-gray-700 mb-2 block">
                Adresse URL
              </span>
              <div className="relative">
                <Link className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="exemple.com ou https://exemple.com"
                  className="input-field pl-12"
                  autoComplete="url"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Le préfixe https:// sera ajouté automatiquement si manquant
              </p>
            </label>
          </div>
        );

      case TABS.TEXT:
        return (
          <div className="space-y-4 animate-fade-in">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-2 block">
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
              <p className="text-xs text-gray-500 mt-2 text-right">
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
              <span className="text-sm font-medium text-gray-700 mb-2 block">Photo du contact</span>
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
                  <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-gray-400" />
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
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl cursor-pointer transition-colors text-sm font-medium"
                  >
                    <Camera className="w-4 h-4" />
                    {contact.photo ? 'Changer la photo' : 'Ajouter une photo'}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    📷 Image compressée automatiquement (64x64px)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-2 block">Prénom</span>
                <input
                  type="text"
                  value={contact.prenom}
                  onChange={(e) => updateContact('prenom', e.target.value)}
                  placeholder="Jean"
                  className="input-field"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-2 block">Nom</span>
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
              <span className="text-sm font-medium text-gray-700 mb-2 block">Téléphone</span>
              <input
                type="tel"
                value={contact.telephone}
                onChange={(e) => updateContact('telephone', e.target.value)}
                placeholder="+1 514 123-4567"
                className="input-field"
              />
            </label>
            
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-2 block">Courriel</span>
              <input
                type="email"
                value={contact.courriel}
                onChange={(e) => updateContact('courriel', e.target.value)}
                placeholder="jean.dupont@exemple.com"
                className="input-field"
              />
            </label>
            
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-2 block">Organisation</span>
              <input
                type="text"
                value={contact.organisation}
                onChange={(e) => updateContact('organisation', e.target.value)}
                placeholder="Nom de l'entreprise"
                className="input-field"
              />
            </label>
            
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-2 block">Site web</span>
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
    <div className="min-h-screen gradient-bg pattern-dots">
      {/* Header */}
      <header className="pt-12 pb-8 px-4 text-center">
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
          <div className="card animate-slide-up">
            {/* Onglets */}
            <div className="flex gap-2 p-2 bg-gray-100/80 rounded-2xl mb-8">
              {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`tab-button flex-1 ${
                    activeTab === id ? 'tab-active' : 'tab-inactive'
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
                onClick={handleCopy}
                disabled={!hasData}
                className="btn-secondary flex-1 min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-green-600">Copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copier
                  </>
                )}
              </button>
              
              <button
                onClick={handleClear}
                disabled={!hasData}
                className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-5 h-5" />
                Effacer
              </button>
            </div>
          </div>

          {/* Panneau de droite - QR Code */}
          <div className="card animate-slide-up flex flex-col" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-primary-500" />
              <h2 className="text-xl font-semibold text-gray-800">
                Aperçu du Code QR
              </h2>
            </div>

            <div 
              ref={qrContainerRef}
              className="qr-container flex-1 min-h-[320px] relative"
            >
              {/* Canvas caché pour QRious */}
              <canvas ref={canvasRef} className="hidden" />

              {isGenerating ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                  <p className="text-gray-500">Génération en cours...</p>
                </div>
              ) : qrDataUrl ? (
                <div className="qr-animate">
                  <img
                    src={qrDataUrl}
                    alt="Code QR généré"
                    className="max-w-full h-auto rounded-lg shadow-lg"
                  />
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <QrCode className="w-12 h-12 text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium">
                    Entrez des données pour générer un code QR
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    Le code QR apparaîtra ici automatiquement
                  </p>
                </div>
              )}
            </div>

            {/* Info sur les données encodées */}
            {hasData && (
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Données encodées
                </p>
                <p className="text-sm text-gray-700 font-mono break-all line-clamp-3">
                  {getQRData()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-12 text-center">
          <p className="text-white/70 text-sm">
            Généré localement dans votre navigateur • Aucune donnée stockée sur nos serveurs
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;

