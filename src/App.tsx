import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  User, 
  UserCircle, 
  CheckCircle2, 
  Loader2, 
  Image as ImageIcon, 
  Download, 
  RefreshCw,
  Lock,
  Unlock,
  ChevronRight,
  Plus,
  X,
  ArrowLeft,
  Edit2,
  Key,
  ExternalLink,
  AlertCircle,
  ZoomIn,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// Extend Window interface for AI Studio methods
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type Gender = 'female' | 'male';

interface GenerationResult {
  id: string;
  sourceUrl: string;
  resultUrl: string;
  timestamp: number;
  garmentType: string;
  gender: Gender;
}

interface StylingConfig {
  hairStyle: string;
  jewelry: string;
  expression: string;
  footwear: string;
  // Male specific
  beardStyle?: string;
  watch?: string;
  facialHair?: "clean" | "stubble" | "beard";
  facialHairDensity?: string;
}

interface CharacterProfile {
  id: string;
  brandId: string;
  name: string;
  gender: Gender;
  baseSeed: number;
  faceReferenceUrl: string;
  facialProfile?: {
    jawWidth: string;
    chinShape: string;
    beardType: "clean" | "stubble" | "short" | "full";
    beardDensity: string;
    moustacheType: string;
    hairDensity: string;
    hairlineShape: string;
  };
  defaultLighting: "soft-left" | "soft-right" | "studio-front";
  defaultFocalLength: number;
  defaultCameraDistance: "standard-full-body";
  defaultStyling: StylingConfig;
  identityLockEnabled: boolean;
  isDeleted?: boolean;
}

export default function App() {
  const [imagesWithDupatta, setImagesWithDupatta] = useState<string[]>([]);
  const [imagesWithoutDupatta, setImagesWithoutDupatta] = useState<string[]>([]);
  const [gender, setGender] = useState<Gender>('female');
  const [garmentType, setGarmentType] = useState('Saree');
  const [selectedFrames, setSelectedFrames] = useState<string[]>(['Full Body Front']);
  const [dupattaMode, setDupattaMode] = useState<'WITH_DUPATTA' | 'WITHOUT_DUPATTA'>('WITH_DUPATTA');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [identityLocked, setIdentityLocked] = useState(false);
  const [freezeStyling, setFreezeStyling] = useState(false);
  const [seed, setSeed] = useState<number>(Math.floor(Math.random() * 1000000));
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [resolutionMode, setResolutionMode] = useState<'standard' | 'high' | 'ultra'>('standard');
  
  // Character Management State
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [newCharacterGender, setNewCharacterGender] = useState<Gender>('female');
  const [newCharacterHairStyle, setNewCharacterHairStyle] = useState('Professional Bun');
  const [newCharacterImage, setNewCharacterImage] = useState<string | null>(null);
  const [isSavingCharacter, setIsSavingCharacter] = useState(false);
  const [isCharacterManagerOpen, setIsCharacterManagerOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<CharacterProfile | null>(null);
  const [characterSearchTerm, setCharacterSearchTerm] = useState('');
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [isUpdatingStyling, setIsUpdatingStyling] = useState(false);
  const [showStylingUpdatePrompt, setShowStylingUpdatePrompt] = useState(false);
  const [characterSearchQuery, setCharacterSearchQuery] = useState('');
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);

  const withDupattaInputRef = useRef<HTMLInputElement>(null);
  const withoutDupattaInputRef = useRef<HTMLInputElement>(null);
  const characterImageInputRef = useRef<HTMLInputElement>(null);

  const garmentOptions = {
    female: ['Saree', 'Salwar Suit', 'Lehenga Choli', 'Kurti', 'Kurti Sets'],
    male: ['Sherwani', 'IndoWestern', 'Kurta Pajama', 'Waistcoat Sets', 'Kurta', 'Coat Suit']
  };

  const frameOptions = [
    'Full Body Front',
    'Full Left Side Profile',
    'Full Right Side Profile',
    'Full Body Back',
    'Upper 3/4 Frame',
    'Bottom 3/4 Frame',
    'Zoom Close-Up',
    'Detailing Image (Macro)'
  ];

  const stylingOptions = {
    hairStyle: {
      female: ['Professional Bun', 'Loose Curls', 'Straight Open', 'Side Braid', 'Traditional Braid', 'Messy Bun'],
      male: ['Professional Short', 'Side Part', 'Slicked Back', 'Natural Waves', 'Buzz Cut']
    },
    jewelry: ['Minimal', 'Heavy Gold', 'Pearl Set', 'Diamond Necklace', 'Traditional Jhumkas', 'None'],
    beardStyle: ['Clean Shaven', 'Stubble', 'Short Beard', 'Full Beard', 'Van Dyke'],
    facialHair: ['clean', 'stubble', 'beard'],
    facialHairDensity: ['None', 'Low', 'Medium', 'High', 'Very High'],
    expression: ['Neutral', 'Slight Smile', 'Confident', 'Elegant', 'Professional'],
    footwear: ['Standard', 'Traditional Juttis', 'High Heels', 'Formal Shoes', 'Sandals'],
    watch: ['None', 'Silver Analog', 'Gold Analog', 'Leather Strap', 'Smartwatch']
  };

  useEffect(() => {
    const checkApiKey = async () => {
      // If the custom secret is provided, we can skip the mandatory selector
      if (process.env.G3_AI_IMAGE_CREATION) {
        setHasApiKey(true);
        return;
      }

      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        // Fallback for local development
        setHasApiKey(true);
      }
    };
    checkApiKey();
  }, []);

  const fetchCharacters = async () => {
    try {
      const response = await fetch('/api/characters/list?brandId=brand_vastra');
      if (response.ok) {
        const data = await response.json();
        setCharacters(data.characters);
        if (data.characters.length > 0 && !selectedCharacterId) {
          setSelectedCharacterId(data.characters[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch characters:", error);
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  const handleSaveCharacter = async () => {
    if (!newCharacterName || !newCharacterImage) {
      alert("Please provide a name and a reference image.");
      return;
    }

    setIsSavingCharacter(true);
    try {
      const response = await fetch('/api/characters/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: "brand_vastra",
          name: newCharacterName,
          referenceImageBase64: newCharacterImage,
          gender: newCharacterGender,
          defaultStyling: newCharacterGender === 'male' ? {
            hairStyle: newCharacterHairStyle,
            beardStyle: "clean shaven",
            facialHair: "clean",
            facialHairDensity: "none",
            watch: "none",
            expression: "neutral",
            footwear: "standard"
          } : {
            hairStyle: newCharacterHairStyle,
            jewelry: "minimal",
            expression: "neutral",
            footwear: "standard"
          }
        })
      });

      if (response.ok) {
        const { characterId } = await response.json();
        await fetchCharacters();
        setSelectedCharacterId(characterId);
        setIsCharacterModalOpen(false);
        setNewCharacterName('');
        setNewCharacterImage(null);
      } else {
        throw new Error("Failed to save character");
      }
    } catch (error: any) {
      alert("Error saving character: " + error.message);
    } finally {
      setIsSavingCharacter(false);
    }
  };

  const handleUpdateCharacter = async (charId: string, updates: Partial<CharacterProfile>) => {
    setIsUpdatingStyling(true);
    try {
      const response = await fetch(`/api/characters/${charId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: "brand_vastra", ...updates })
      });
      if (response.ok) {
        await fetchCharacters();
        setEditingCharacter(null);
      } else {
        throw new Error("Failed to update character");
      }
    } catch (error: any) {
      alert("Error updating character: " + error.message);
    } finally {
      setIsUpdatingStyling(false);
    }
  };

  const handleUpdateCharacterStyling = async (charId: string, styling: StylingConfig) => {
    await handleUpdateCharacter(charId, { defaultStyling: styling });
    setShowStylingUpdatePrompt(false);
  };

  const handleDeleteCharacter = async (charId: string) => {
    if (!confirm("Are you sure you want to delete this character?")) return;
    try {
      const response = await fetch(`/api/characters/${charId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: "brand_vastra" })
      });
      if (response.ok) {
        await fetchCharacters();
        if (selectedCharacterId === charId) setSelectedCharacterId(null);
        setSelectedCharacterIds(prev => prev.filter(id => id !== charId));
      }
    } catch (error) {
      console.error("Failed to delete character:", error);
    }
  };

  const handleBulkDeleteCharacters = async () => {
    if (selectedCharacterIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedCharacterIds.length} characters?`)) return;

    try {
      const deletePromises = selectedCharacterIds.map(id => 
        fetch(`/api/characters/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId: "brand_vastra" })
        })
      );
      
      await Promise.all(deletePromises);
      await fetchCharacters();
      
      if (selectedCharacterId && selectedCharacterIds.includes(selectedCharacterId)) {
        setSelectedCharacterId(null);
      }
      setSelectedCharacterIds([]);
    } catch (error) {
      console.error("Failed to bulk delete characters:", error);
      alert("Some characters could not be deleted.");
    }
  };

  const handleCharacterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCharacterImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Proceed after triggering dialog
    }
  };

  useEffect(() => {
    if (gender === 'male' && !garmentOptions.male.includes(garmentType)) {
      setGarmentType(garmentOptions.male[0]);
    } else if (gender === 'female' && !garmentOptions.female.includes(garmentType)) {
      setGarmentType(garmentOptions.female[0]);
    }
  }, [gender]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'WITH' | 'WITHOUT') => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          
          // Step 3: Input Image Compression
          try {
            const response = await fetch('/api/compress-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64 })
            });
            if (response.ok) {
              const { optimizedImage } = await response.json();
              if (type === 'WITH') {
                setImagesWithDupatta(prev => [...prev, optimizedImage].slice(0, 7));
              } else {
                setImagesWithoutDupatta(prev => [...prev, optimizedImage].slice(0, 7));
              }
            } else {
              // Fallback to original if compression fails
              if (type === 'WITH') {
                setImagesWithDupatta(prev => [...prev, base64].slice(0, 7));
              } else {
                setImagesWithoutDupatta(prev => [...prev, base64].slice(0, 7));
              }
            }
          } catch (error) {
            console.error("Compression failed:", error);
            if (type === 'WITH') {
              setImagesWithDupatta(prev => [...prev, base64].slice(0, 7));
            } else {
              setImagesWithoutDupatta(prev => [...prev, base64].slice(0, 7));
            }
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number, type: 'WITH' | 'WITHOUT') => {
    if (type === 'WITH') {
      setImagesWithDupatta(prev => prev.filter((_, i) => i !== index));
    } else {
      setImagesWithoutDupatta(prev => prev.filter((_, i) => i !== index));
    }
  };

  const toggleFrame = (frame: string) => {
    setSelectedFrames(prev => 
      prev.includes(frame) 
        ? (prev.length > 1 ? prev.filter(f => f !== frame) : prev)
        : [...prev, frame]
    );
  };

  const generateRequestHash = (data: any) => {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  };

  const generateTransfer = async () => {
    const targetImages = dupattaMode === 'WITH_DUPATTA' ? imagesWithDupatta : imagesWithoutDupatta;

    if (targetImages.length === 0) {
      alert(dupattaMode === 'WITH_DUPATTA' 
        ? "No dupatta reference images provided. Please upload images to the 'WITH Dupatta' section." 
        : "No non-dupatta reference images provided. Please upload images to the 'WITHOUT Dupatta' section.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const framesToGenerate = selectedFrames.length > 0 ? selectedFrames : ['Full Body Front'];
      const totalBackgrounds = 1;

      // Prepare frames with their hashes
      const framesWithHashes = framesToGenerate.map(frame => ({
        frame,
        requestHash: generateRequestHash({
          imagesWithDupatta,
          imagesWithoutDupatta,
          characterId: selectedCharacterId || "char_001",
          stylingConfig: freezeStyling,
          resolutionMode,
          frame,
          totalBackgrounds
        })
      }));

      // Call unified backend endpoint with all frames
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gender, 
          garmentType, 
          frames: framesWithHashes,
          dupattaMode, 
          identityLocked, 
          freezeStyling,
          brandId: "brand_vastra",
          productId: "prod_default",
          characterId: selectedCharacterId || "char_001",
          resolutionMode,
          totalBackgrounds,
          imagesWithDupatta,
          imagesWithoutDupatta
        })
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = text;
        try {
          const errorJson = JSON.parse(text);
          errorMessage = errorJson.error || text;
        } catch (e) {}
        throw new Error(errorMessage);
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is null");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            switch (event.type) {
              case "progress":
                console.log("Progress:", event.message);
                break;
              case "frame":
                // Process frame event
                (async () => {
                  let generatedImageUrl = event.imageUrl;
                  // Process image through backend framing/detailing logic
                  try {
                    const processResponse = await fetch('/api/process-image', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ imageBase64: generatedImageUrl, frame: event.frameLabel })
                    });
                    if (processResponse.ok) {
                      const { processedImage } = await processResponse.json();
                      if (processedImage) {
                        generatedImageUrl = processedImage;
                      }
                    }
                  } catch (processError) {
                    console.warn("Image post-processing failed:", processError);
                  }

                  const newResult: GenerationResult = {
                    id: event.generationId || Math.random().toString(36).substr(2, 9),
                    sourceUrl: targetImages[0],
                    resultUrl: generatedImageUrl,
                    timestamp: Date.now(),
                    garmentType,
                    gender
                  };
                  setResults(prev => [newResult, ...prev]);
                })();
                break;
              case "complete":
                console.log("Generation complete:", event);
                break;
              case "error":
                throw new Error(event.message);
            }
          } catch (e: any) {
            console.error("Stream processing error:", e);
            if (e.message) throw e;
          }
        }
      }

    } catch (error: any) {
      console.error("Overall generation error:", error);
      alert(`Generation failed: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async (result: GenerationResult) => {
    try {
      // Step 5: Limit Refinement Calls
      const checkResponse = await fetch('/api/refinement/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationId: result.id })
      });

      if (!checkResponse.ok) {
        const errData = await checkResponse.json();
        throw new Error(errData.error || "Refinement limit reached.");
      }

      // Proceed with refinement logic...
      alert("Refinement logic triggered (Capped at 2 attempts).");
    } catch (error: any) {
      alert(error.message);
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl border border-black/5 p-8 shadow-xl space-y-8 text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <Key className="w-10 h-10 text-emerald-600" />
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight">API Key Required</h1>
            <p className="text-gray-500 text-sm">
              To use high-precision image generation, you must select a paid Gemini API key from your Google Cloud project.
            </p>
          </div>
          
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-900">Important Note</p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Ensure your project has billing enabled. You can manage this in the 
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 ml-1 font-bold underline">
                  Gemini API Billing Docs <ExternalLink className="w-2 h-2" />
                </a>
              </p>
            </div>
          </div>

          <button 
            onClick={handleOpenKeySelector}
            className="w-full bg-[#1A1A1A] text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg active:scale-[0.98]"
          >
            Select API Key to Continue
          </button>
        </motion.div>
      </div>
    );
  }

  if (hasApiKey === null) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const filteredCharacters = characters.filter(char => 
    char.name.toLowerCase().includes(characterSearchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <RefreshCw className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Vastra AI</h1>
            <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-2">
              Internal Tool
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-gray-500">
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* Character Selection Section */}
          <section className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">0. Character Profile</h2>
                <p className="text-xs text-gray-500">Select or manage model identities.</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setIsCharacterManagerOpen(true);
                    setSelectedCharacterIds([]);
                    setCharacterSearchQuery('');
                  }}
                  className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Manage Characters"
                >
                  <UserCircle className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setIsCharacterModalOpen(true)}
                  className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                  title="Create New Character"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => {
                    setSelectedCharacterId(char.id);
                    setGender(char.gender);
                  }}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${selectedCharacterId === char.id ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <img src={char.faceReferenceUrl} className="w-full h-full object-cover" alt={char.name} />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1 px-2">
                    <p className="text-[8px] text-white font-bold truncate text-center">{char.name}</p>
                  </div>
                  {selectedCharacterId === char.id && (
                    <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5">
                      <CheckCircle2 className="w-2 h-2" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm space-y-6">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">1. Upload Product Images</h2>
              <p className="text-xs text-gray-500">Explicitly upload images into the correct section.</p>
            </div>

            {/* WITH Dupatta Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Product WITH Dupatta</label>
                <span className="text-[10px] text-gray-400">{imagesWithDupatta.length}/7</span>
              </div>
              <div 
                onClick={() => withDupattaInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group"
              >
                <Upload className="w-5 h-5 text-gray-400 group-hover:text-emerald-600" />
                <p className="text-[10px] font-medium">Upload WITH Dupatta</p>
                <input 
                  type="file" 
                  ref={withDupattaInputRef} 
                  className="hidden" 
                  multiple 
                  accept="image/*" 
                  onChange={(e) => handleImageUpload(e, 'WITH')} 
                />
              </div>
              {imagesWithDupatta.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {imagesWithDupatta.map((img, idx) => (
                    <div key={idx} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-black/5 group">
                      <img src={img} className="w-full h-full object-cover" alt={`With Dupatta ${idx}`} />
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeImage(idx, 'WITH'); }}
                        className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* WITHOUT Dupatta Section */}
            <div className="space-y-3 pt-4 border-t border-gray-50">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Product WITHOUT Dupatta</label>
                <span className="text-[10px] text-gray-400">{imagesWithoutDupatta.length}/7</span>
              </div>
              <div 
                onClick={() => withoutDupattaInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all group"
              >
                <Upload className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                <p className="text-[10px] font-medium">Upload WITHOUT Dupatta</p>
                <input 
                  type="file" 
                  ref={withoutDupattaInputRef} 
                  className="hidden" 
                  multiple 
                  accept="image/*" 
                  onChange={(e) => handleImageUpload(e, 'WITHOUT')} 
                />
              </div>
              {imagesWithoutDupatta.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {imagesWithoutDupatta.map((img, idx) => (
                    <div key={idx} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-black/5 group">
                      <img src={img} className="w-full h-full object-cover" alt={`Without Dupatta ${idx}`} />
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeImage(idx, 'WITHOUT'); }}
                        className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm space-y-6">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">2. Model Configuration</h2>
              <p className="text-xs text-gray-500">Select target model and garment type.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setGender('female')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${gender === 'female' ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-200'}`}
                >
                  <UserCircle className="w-5 h-5" />
                  <span className="font-medium">Female</span>
                </button>
                <button 
                  onClick={() => setGender('male')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${gender === 'male' ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-200'}`}
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">Male</span>
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Garment Category</label>
                <select 
                  value={garmentType}
                  onChange={(e) => setGarmentType(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  {garmentOptions[gender].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dupatta Mode (Batch)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setDupattaMode('WITH_DUPATTA')}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${dupattaMode === 'WITH_DUPATTA' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-500'}`}
                  >
                    With Dupatta
                  </button>
                  <button 
                    onClick={() => setDupattaMode('WITHOUT_DUPATTA')}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${dupattaMode === 'WITHOUT_DUPATTA' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-500'}`}
                  >
                    Without Dupatta
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Generation Resolution</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => setResolutionMode('standard')}
                    className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${resolutionMode === 'standard' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-100'}`}
                  >
                    Standard
                    <span className="block text-[8px] opacity-60 font-medium">1200x1600</span>
                  </button>
                  <button 
                    onClick={() => setResolutionMode('high')}
                    className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${resolutionMode === 'high' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-100'}`}
                  >
                    High
                    <span className="block text-[8px] opacity-60 font-medium">2400x3200</span>
                  </button>
                  <button 
                    onClick={() => setResolutionMode('ultra')}
                    className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${resolutionMode === 'ultra' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-100'}`}
                  >
                    Ultra
                    <span className="block text-[8px] opacity-60 font-medium">3000x4000</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">E-commerce Frames (Multi-Select)</label>
                <div className="grid grid-cols-2 gap-2">
                  {frameOptions.map(opt => (
                    <button 
                      key={opt}
                      onClick={() => toggleFrame(opt)}
                      className={`py-2 px-3 rounded-lg text-[10px] font-medium border text-left transition-all flex items-center justify-between ${selectedFrames.includes(opt) ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-500'}`}
                    >
                      {opt}
                      {selectedFrames.includes(opt) && <CheckCircle2 className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${identityLocked ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                      {identityLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Lock Identity</p>
                      <p className="text-[10px] text-gray-400">Keep model face consistent</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        const newSeed = Math.floor(Math.random() * 1000000);
                        setSeed(newSeed);
                      }}
                      className="p-2 rounded-lg bg-gray-50 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all group active:rotate-180 duration-500"
                      title="Refresh Seed"
                    >
                      <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                    </button>
                    <button 
                      onClick={() => setIdentityLocked(!identityLocked)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${identityLocked ? 'bg-emerald-500' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${identityLocked ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${freezeStyling ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                      <RefreshCw className={`w-4 h-4 ${freezeStyling ? 'animate-spin-slow' : ''}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Styling Override</p>
                      <p className="text-[10px] text-gray-400">Custom hair, jewelry & expression</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFreezeStyling(!freezeStyling)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${freezeStyling ? 'bg-blue-500' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${freezeStyling ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {freezeStyling && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-blue-600">Hairstyle</label>
                        <select 
                          className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[10px] focus:outline-none focus:border-blue-500"
                          onChange={(e) => {
                            const char = characters.find(c => c.id === selectedCharacterId);
                            if (char) {
                              char.defaultStyling.hairStyle = e.target.value;
                              setShowStylingUpdatePrompt(true);
                            }
                          }}
                        >
                          <option value="">Select Hairstyle</option>
                          {stylingOptions.hairStyle[gender].map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-blue-600">{gender === 'female' ? 'Jewelry' : 'Beard Style'}</label>
                        <select 
                          className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[10px] focus:outline-none focus:border-blue-500"
                          onChange={(e) => {
                            const char = characters.find(c => c.id === selectedCharacterId);
                            if (char) {
                              if (gender === 'female') {
                                char.defaultStyling.jewelry = e.target.value;
                              } else {
                                char.defaultStyling.beardStyle = e.target.value;
                              }
                              setShowStylingUpdatePrompt(true);
                            }
                          }}
                        >
                          <option value="">Select Option</option>
                          {(gender === 'female' ? stylingOptions.jewelry : stylingOptions.beardStyle).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {gender === 'male' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-blue-600">Facial Hair</label>
                          <select 
                            className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[10px] focus:outline-none focus:border-blue-500"
                            onChange={(e) => {
                              const char = characters.find(c => c.id === selectedCharacterId);
                              if (char) {
                                char.defaultStyling.facialHair = e.target.value as any;
                                setShowStylingUpdatePrompt(true);
                              }
                            }}
                          >
                            <option value="">Select Type</option>
                            {stylingOptions.facialHair.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-blue-600">Density</label>
                          <select 
                            className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[10px] focus:outline-none focus:border-blue-500"
                            onChange={(e) => {
                              const char = characters.find(c => c.id === selectedCharacterId);
                              if (char) {
                                char.defaultStyling.facialHairDensity = e.target.value;
                                setShowStylingUpdatePrompt(true);
                              }
                            }}
                          >
                            <option value="">Select Density</option>
                            {stylingOptions.facialHairDensity.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-blue-600">Expression</label>
                        <select 
                          className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[10px] focus:outline-none focus:border-blue-500"
                          onChange={(e) => {
                            const char = characters.find(c => c.id === selectedCharacterId);
                            if (char) {
                              char.defaultStyling.expression = e.target.value;
                              setShowStylingUpdatePrompt(true);
                            }
                          }}
                        >
                          <option value="">Select Expression</option>
                          {stylingOptions.expression.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-blue-600">Footwear</label>
                        <select 
                          className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[10px] focus:outline-none focus:border-blue-500"
                          onChange={(e) => {
                            const char = characters.find(c => c.id === selectedCharacterId);
                            if (char) {
                              char.defaultStyling.footwear = e.target.value;
                              setShowStylingUpdatePrompt(true);
                            }
                          }}
                        >
                          <option value="">Select Footwear</option>
                          {stylingOptions.footwear.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            <button 
              disabled={(dupattaMode === 'WITH_DUPATTA' ? imagesWithDupatta.length === 0 : imagesWithoutDupatta.length === 0) || isGenerating}
              onClick={generateTransfer}
              className="w-full bg-[#1A1A1A] text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-black/10 active:scale-[0.98]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing Transfer...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-5 h-5" />
                  <span>Generate Catalog Image</span>
                </>
              )}
            </button>
          </section>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Generation Gallery</h2>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Catalog Quality: {resolutionMode === 'ultra' ? '3000x4000' : (resolutionMode === 'high' ? '2400x3200' : '1200x1600')}px</span>
            </div>
          </div>

          {results.length === 0 && !isGenerating ? (
            <div className="bg-white rounded-2xl border border-black/5 border-dashed p-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-gray-200" />
              </div>
              <div>
                <p className="text-gray-500 font-medium">No images generated yet</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {isGenerating && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="aspect-[3/4] bg-white rounded-2xl border border-emerald-100 overflow-hidden relative flex flex-col items-center justify-center p-8 space-y-4 shadow-sm"
                  >
                    <div className="absolute inset-0 bg-emerald-50/30 animate-pulse" />
                    <div className="relative z-10 flex flex-col items-center space-y-4">
                      <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                      <div className="text-center">
                        <p className="text-emerald-700 font-semibold">Generating Realism</p>
                        <p className="text-xs text-emerald-600/60 mt-1">Preserving fabric textures and lighting...</p>
                      </div>
                    </div>
                  </motion.div>
                )}
                {results.map((result) => (
                  <motion.div 
                    key={result.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm group"
                  >
                    <div className="relative aspect-[3/4]">
                      <img src={result.resultUrl} className="w-full h-full object-cover" alt="Generated" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button 
                          onClick={() => handleRefine(result)}
                          className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-xl"
                          title="Refine Details"
                        >
                          <RefreshCw className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setZoomedImage(result.resultUrl)}
                          className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-xl"
                          title="Inspect Details"
                        >
                          <ZoomIn className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => downloadImage(result.resultUrl, `vastra-ai-${result.id}.png`)}
                          className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-xl"
                          title="Download Image"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                        <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm">
                          {result.garmentType}
                        </div>
                        <div className="w-12 h-16 rounded-lg border-2 border-white shadow-lg overflow-hidden">
                          <img src={result.sourceUrl} className="w-full h-full object-cover" alt="Source" />
                        </div>
                      </div>
                    </div>
                    <div className="p-4 flex items-center justify-between border-t border-gray-50">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${result.gender === 'female' ? 'bg-pink-400' : 'bg-blue-400'}`} />
                        <span className="text-xs font-medium text-gray-500 capitalize">{result.gender} Model</span>
                      </div>
                      <span className="text-[10px] text-gray-300 font-mono">
                        {new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Zoom Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 md:p-8"
          >
            <div className="absolute top-6 right-6 flex items-center gap-4 z-50">
              <button 
                onClick={() => downloadImage(zoomedImage, 'vastra-detail.png')}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
                title="Download"
              >
                <Download className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setZoomedImage(null)}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="w-full h-full flex flex-col items-center justify-center">
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={8}
                centerOnInit={true}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10 z-50">
                      <button onClick={() => zoomIn()} className="p-3 hover:bg-white/10 text-white rounded-xl transition-colors">
                        <Maximize2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => zoomOut()} className="p-3 hover:bg-white/10 text-white rounded-xl transition-colors">
                        <Minimize2 className="w-5 h-5" />
                      </button>
                      <div className="w-px h-6 bg-white/10 mx-1" />
                      <button onClick={() => resetTransform()} className="p-3 hover:bg-white/10 text-white rounded-xl transition-colors">
                        <RotateCcw className="w-5 h-5" />
                      </button>
                    </div>

                    <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                      <img 
                        src={zoomedImage} 
                        alt="Zoomed Detail" 
                        className="max-h-[85vh] w-auto object-contain shadow-2xl rounded-sm cursor-grab active:cursor-grabbing"
                      />
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
              
              <div className="mt-6 text-center">
                <p className="text-white/60 text-sm font-medium tracking-wide uppercase">
                  Use mouse wheel or pinch to zoom • Drag to pan
                </p>
                <p className="text-white/30 text-[10px] mt-1 uppercase tracking-widest">
                  Inspecting Fine Embroidery & Fabric Weave
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Character Modal */}
      <AnimatePresence>
        {isCharacterModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCharacterModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-[900px] max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <h3 className="text-lg font-bold text-gray-900">Create Character Profile</h3>
                <button 
                  onClick={() => setIsCharacterModalOpen(false)} 
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Modal Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* Left Column: Form Fields */}
                  <div className="space-y-5 order-2 lg:order-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Character Name</label>
                      <input 
                        type="text" 
                        value={newCharacterName}
                        onChange={(e) => setNewCharacterName(e.target.value)}
                        placeholder="e.g. Aria, Rohan..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Gender</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => {
                            setNewCharacterGender('female');
                            setNewCharacterHairStyle('Professional Bun');
                          }}
                          className={`flex items-center justify-center gap-2 py-2 rounded-xl border transition-all ${newCharacterGender === 'female' ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-200'}`}
                        >
                          <UserCircle className="w-4 h-4" />
                          <span className="text-xs font-semibold">Female</span>
                        </button>
                        <button 
                          onClick={() => {
                            setNewCharacterGender('male');
                            setNewCharacterHairStyle('Professional Short');
                          }}
                          className={`flex items-center justify-center gap-2 py-2 rounded-xl border transition-all ${newCharacterGender === 'male' ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-200'}`}
                        >
                          <User className="w-4 h-4" />
                          <span className="text-xs font-semibold">Male</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Default Hairstyle</label>
                      <select 
                        value={newCharacterHairStyle}
                        onChange={(e) => setNewCharacterHairStyle(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239CA3AF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
                      >
                        {stylingOptions.hairStyle[newCharacterGender].map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Right Column: Reference Image Upload */}
                  <div className="space-y-1.5 order-1 lg:order-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Reference Face Image</label>
                    <div 
                      onClick={() => characterImageInputRef.current?.click()}
                      className="aspect-square lg:aspect-auto lg:h-[220px] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all overflow-hidden group relative bg-gray-50/30"
                    >
                      {newCharacterImage ? (
                        <>
                          <img src={newCharacterImage} className="w-full h-full object-cover" alt="Preview" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <p className="text-white text-xs font-medium flex items-center gap-2">
                              <RefreshCw className="w-4 h-4" /> Change Image
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            <Upload className="w-5 h-5 text-gray-400 group-hover:text-emerald-600" />
                          </div>
                          <div className="text-center px-4">
                            <p className="text-xs font-semibold text-gray-600">Click to upload</p>
                            <p className="text-[10px] text-gray-400 mt-1">Clear front-facing face photo</p>
                          </div>
                        </>
                      )}
                      <input 
                        type="file" 
                        ref={characterImageInputRef}
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleCharacterImageUpload} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-gray-50/50 border-t border-gray-100 sticky bottom-0 z-10">
                <button 
                  disabled={!newCharacterName || !newCharacterImage || isSavingCharacter}
                  onClick={handleSaveCharacter}
                  className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                >
                  {isSavingCharacter ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Save Character Profile</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Character Manager Modal */}
      <AnimatePresence>
        {isCharacterManagerOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCharacterManagerOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold">Character Manager</h3>
                <button onClick={() => setIsCharacterManagerOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {editingCharacter ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                      <button onClick={() => setEditingCharacter(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <h4 className="font-bold">Edit {editingCharacter.name}</h4>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Name</label>
                        <input 
                          type="text" 
                          value={editingCharacter.name}
                          onChange={(e) => setEditingCharacter({...editingCharacter, name: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Lighting</label>
                        <select 
                          value={editingCharacter.defaultLighting}
                          onChange={(e) => setEditingCharacter({...editingCharacter, defaultLighting: e.target.value as any})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        >
                          <option value="soft-left">Soft Left</option>
                          <option value="soft-right">Soft Right</option>
                          <option value="studio-front">Studio Front</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Default Styling</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-500">Hairstyle</label>
                          <select 
                            value={editingCharacter.defaultStyling.hairStyle}
                            onChange={(e) => setEditingCharacter({
                              ...editingCharacter, 
                              defaultStyling: {...editingCharacter.defaultStyling, hairStyle: e.target.value}
                            })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                          >
                            {stylingOptions.hairStyle[editingCharacter.gender].map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                            <option value="custom">Custom...</option>
                          </select>
                        </div>
                        {editingCharacter.gender === 'female' ? (
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-500">Jewelry</label>
                            <select 
                              value={editingCharacter.defaultStyling.jewelry}
                              onChange={(e) => setEditingCharacter({
                                ...editingCharacter, 
                                defaultStyling: {...editingCharacter.defaultStyling, jewelry: e.target.value}
                              })}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                            >
                              {stylingOptions.jewelry.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                              <option value="custom">Custom...</option>
                            </select>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-500">Beard Style</label>
                            <select 
                              value={editingCharacter.defaultStyling.beardStyle || ''}
                              onChange={(e) => setEditingCharacter({
                                ...editingCharacter, 
                                defaultStyling: {...editingCharacter.defaultStyling, beardStyle: e.target.value}
                              })}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                            >
                              {stylingOptions.beardStyle.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                              <option value="custom">Custom...</option>
                            </select>
                          </div>
                        )}
                        {editingCharacter.gender === 'male' && (
                          <>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-500">Facial Hair</label>
                              <select 
                                value={editingCharacter.defaultStyling.facialHair || 'clean'}
                                onChange={(e) => setEditingCharacter({
                                  ...editingCharacter, 
                                  defaultStyling: {...editingCharacter.defaultStyling, facialHair: e.target.value as any}
                                })}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                              >
                                {stylingOptions.facialHair.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-500">Density</label>
                              <select 
                                value={editingCharacter.defaultStyling.facialHairDensity || 'none'}
                                onChange={(e) => setEditingCharacter({
                                  ...editingCharacter, 
                                  defaultStyling: {...editingCharacter.defaultStyling, facialHairDensity: e.target.value}
                                })}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                              >
                                {stylingOptions.facialHairDensity.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-500">Watch</label>
                              <select 
                                value={editingCharacter.defaultStyling.watch || ''}
                                onChange={(e) => setEditingCharacter({
                                  ...editingCharacter, 
                                  defaultStyling: {...editingCharacter.defaultStyling, watch: e.target.value}
                                })}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                              >
                                {stylingOptions.watch.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                                <option value="custom">Custom...</option>
                              </select>
                            </div>
                          </>
                        )}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-500">Expression</label>
                          <select 
                            value={editingCharacter.defaultStyling.expression}
                            onChange={(e) => setEditingCharacter({
                              ...editingCharacter, 
                              defaultStyling: {...editingCharacter.defaultStyling, expression: e.target.value}
                            })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                          >
                            {stylingOptions.expression.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                            <option value="custom">Custom...</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-500">Footwear</label>
                          <select 
                            value={editingCharacter.defaultStyling.footwear}
                            onChange={(e) => setEditingCharacter({
                              ...editingCharacter, 
                              defaultStyling: {...editingCharacter.defaultStyling, footwear: e.target.value}
                            })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs"
                          >
                            {stylingOptions.footwear.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                            <option value="custom">Custom...</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button 
                        onClick={() => setEditingCharacter(null)}
                        className="flex-1 py-3 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleUpdateCharacter(editingCharacter.id, editingCharacter)}
                        disabled={isUpdatingStyling}
                        className="flex-1 py-3 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100 disabled:opacity-50"
                      >
                        {isUpdatingStyling ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="Search characters..."
                          value={characterSearchQuery}
                          onChange={(e) => setCharacterSearchQuery(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                      {selectedCharacterIds.length > 0 && (
                        <button 
                          onClick={handleBulkDeleteCharacters}
                          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete ({selectedCharacterIds.length})
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {filteredCharacters.map(char => (
                        <div key={char.id} className={`bg-gray-50 rounded-2xl p-4 flex gap-4 border transition-all group relative ${selectedCharacterIds.includes(char.id) ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}>
                          <div className="absolute top-2 left-2 z-10">
                            <input 
                              type="checkbox"
                              checked={selectedCharacterIds.includes(char.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCharacterIds(prev => [...prev, char.id]);
                                } else {
                                  setSelectedCharacterIds(prev => prev.filter(id => id !== char.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </div>
                          <div className="w-20 h-24 rounded-xl overflow-hidden shrink-0 border border-black/5">
                            <img src={char.faceReferenceUrl} className="w-full h-full object-cover" alt={char.name} />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-sm">{char.name}</h4>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{char.gender}</span>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-gray-500"><span className="font-bold">Hair:</span> {char.defaultStyling.hairStyle}</p>
                              {char.gender === 'female' ? (
                                <p className="text-[10px] text-gray-500"><span className="font-bold">Jewelry:</span> {char.defaultStyling.jewelry}</p>
                              ) : (
                                <p className="text-[10px] text-gray-500"><span className="font-bold">Beard:</span> {char.defaultStyling.beardStyle}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                              <button 
                                onClick={() => {
                                  setSelectedCharacterId(char.id);
                                  setGender(char.gender);
                                  setIsCharacterManagerOpen(false);
                                }}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${selectedCharacterId === char.id ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-200'}`}
                              >
                                {selectedCharacterId === char.id ? 'Selected' : 'Select'}
                              </button>
                              <button 
                                onClick={() => setEditingCharacter(char)}
                                className="p-1.5 bg-white border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-200 rounded-lg transition-all"
                                title="Edit Character"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteCharacter(char.id)}
                                className="p-1.5 bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 rounded-lg transition-all"
                                title="Delete Character"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Styling Update Prompt */}
      <AnimatePresence>
        {showStylingUpdatePrompt && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-xs bg-white rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="text-center space-y-2">
                <h4 className="font-bold">Update Styling?</h4>
                <p className="text-xs text-gray-500">Would you like to update the character's default styling with these changes?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setShowStylingUpdatePrompt(false)}
                  className="py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                >
                  No
                </button>
                <button 
                  onClick={() => {
                    const char = characters.find(c => c.id === selectedCharacterId);
                    if (char) {
                      handleUpdateCharacterStyling(char.id, char.defaultStyling);
                    }
                  }}
                  className="py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
