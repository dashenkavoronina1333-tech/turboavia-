/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { domToPng } from 'modern-screenshot';
import { jsPDF } from 'jspdf';
import { 
  Calculator, 
  Package, 
  Plane, 
  Ship, 
  Train, 
  Truck, 
  Info, 
  ChevronRight, 
  Scale, 
  Maximize,
  Layers,
  ShieldCheck,
  Scissors,
  Minimize2,
  Mail,
  MessageCircle,
  Globe,
  ExternalLink,
  ShoppingCart,
  Warehouse,
  Merge as Combine,
  Home,
  BarChart3,
  LayoutDashboard,
  Search,
  Plus,
  Clock,
  Flag,
  X,
  Upload,
  FileText,
  PlusCircle,
  ArrowRight,
  Calendar,
  MapPin,
  DollarSign,
  CheckCircle2,
  ChevronDown,
  Trash2,
  Edit2,
  Download,
  Receipt,
  UserCircle,
  Printer,
  LayoutGrid,
  List,
  Store,
  RotateCcw,
  Settings,
  CheckSquare,
  Square,
  Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface DensityTier {
  min: number;
  max: number | null;
  price: number;
  unit: 'kg' | 'm3';
}

interface Tariff {
  id: string;
  name: string;
  iconName: 'Ship' | 'Plane' | 'Train' | 'Truck' | 'Zap';
  pricePerKg?: number;
  volumetricFactor?: number;
  densityTiers?: DensityTier[];
  deliveryDays: string;
  description: string;
  localDeliveryPrice?: number; // $/kg
  minWeight?: number;
  minVolume?: number;
  minCost?: number; // $
  insuranceRate?: number; // % (e.g. 2 for 2%)
  packagingCost?: number; // $/kg
  packagingCostPerM3?: number; // $/m3
  customsFee?: number; // $
  handlingFee?: number; // $
  fuelSurcharge?: number; // %
}

interface ParcelData {
  weight: number; // kg
  length: number; // cm
  width: number; // cm
  height: number; // cm
  volume?: number; // m3
  declaredValue?: number; // USD
  isFabric?: boolean;
  isPressed?: boolean;
  isInsured?: boolean;
  density?: number; // kg/m3
}

// --- Constants ---

const THEME_BLACK = "#000000";
const THEME_YELLOW = "#facc15";
const TURBO_RED = "#facc15"; // THEME_YELLOW
const TURBO_GREEN = "#000000"; // THEME_BLACK

const DEFAULT_TARIFFS: Tariff[] = [
  {
    id: 'turbo-sea',
    name: 'Turboavia More',
    iconName: 'Ship',
    densityTiers: [
      { min: 0, max: 100, price: 480, unit: 'm3' },
      { min: 100, max: 200, price: 580, unit: 'm3' },
      { min: 200, max: 250, price: 610, unit: 'm3' },
      { min: 250, max: 300, price: 640, unit: 'm3' },
      { min: 300, max: 350, price: 690, unit: 'm3' },
      { min: 350, max: 400, price: 740, unit: 'm3' },
      { min: 400, max: 450, price: 790, unit: 'm3' },
      { min: 450, max: 500, price: 840, unit: 'm3' },
      { min: 500, max: 700, price: 2.1, unit: 'kg' },
      { min: 700, max: 800, price: 2.3, unit: 'kg' },
      { min: 800, max: null, price: 2.5, unit: 'kg' },
    ],
    localDeliveryPrice: 0.4,
    deliveryDays: '65-75 днів',
    description: 'Морська доставка Turboavia з тарифікацією за щільністю.',
    insuranceRate: 2,
    minWeight: 10,
    packagingCostPerM3: 30
  },
  {
    id: 'air-fast',
    name: 'СПЕЦ. Turboavia Авіа',
    iconName: 'Plane',
    densityTiers: [
      { min: 0, max: 60, price: 1336, unit: 'm3' },
      { min: 60, max: 80, price: 16.0, unit: 'kg' },
      { min: 80, max: 100, price: 15.0, unit: 'kg' },
      { min: 100, max: 120, price: 14.0, unit: 'kg' },
      { min: 120, max: 140, price: 13.6, unit: 'kg' },
      { min: 140, max: 160, price: 13.3, unit: 'kg' },
      { min: 160, max: null, price: 13.0, unit: 'kg' },
    ],
    deliveryDays: '18-20 днів',
    description: 'Спеціальна авіа доставка Turboavia.',
    insuranceRate: 2,
    minCost: 15,
    packagingCost: 0.5
  },
  {
    id: 'train',
    name: 'Залізниця',
    iconName: 'Train',
    pricePerKg: 4.5,
    volumetricFactor: 5000,
    deliveryDays: '35-45 днів',
    description: 'Надійний спосіб для середніх вантажів.',
    insuranceRate: 2,
    minWeight: 15,
    packagingCost: 0.2
  }
];

const getTariffIcon = (name: string) => {
  switch (name) {
    case 'Ship': return <Ship className="w-5 h-5" />;
    case 'Plane': return <Plane className="w-5 h-5" />;
    case 'Train': return <Train className="w-5 h-5" />;
    case 'Truck': return <Truck className="w-5 h-5" />;
    default: return <Package className="w-5 h-5" />;
  }
};

// --- Components ---

type CalculatorType = 'international' | 'novaposhta' | 'transfer';
type AppView = 'home' | 'calculator' | 'crm';
interface Supplier {
  id: string;
  name: string;
  url: string;
  category: string;
  comment: string;
  createdAt: string;
}

type CRMModule = 'dashboard' | 'purchases' | 'china_warehouse' | 'consolidation' | 'ua_warehouse' | 'issue_to_store' | 'finance' | 'analytics' | 'price_list' | 'settings' | 'suppliers';

interface CRMModuleConfig {
  id: CRMModule;
  title: string;
  icon: any;
  description: string;
}

interface NovaPoshtaData {
  weight: number;
  length: number;
  width: number;
  height: number;
  declaredValue: number;
  destination: 'city' | 'region' | 'ukraine';
}

interface MoneyTransferData {
  amount: number;
  method: 'card' | 'cash';
}

interface Purchase {
  id: string;
  platform: string;
  name: string;
  link: string;
  priceYuan: number;
  exchangeRate: number;
  quantity: number;
  trackNumber: string;
  photo: string;
  comment: string;
  size?: string;
  width?: number;
  height?: number;
  length?: number;
  dimUnit?: 'cm' | 'm';
  weight?: number;
  weightUnit?: 'g' | 'kg';
  volume?: number;
  density?: number;
  isFabric?: boolean;
  isPressed?: boolean;
  isInsured?: boolean;
  declaredValue?: number;
  shippingCost?: number;
  status: 'purchased' | 'shipped_by_seller' | 'arrived_china' | 'at_china_warehouse' | 'shipped_to_ua' | 'arrived_ua' | 'sold';
  arrivalDate?: string;
  batchId?: string;
  deliveryCostPerItem?: number; // This is "Доставка Китай"
  ukraineDeliveryCost?: number; // This is "Доставка Україна" (local logistics)
  novaPoshtaCost?: number;      // This is "Доставка Нова Пошта"
  sellingPrice?: number;
  soldDate?: string;
  markup?: boolean;
  markupValue?: number;
  createdAt: string;
}

type UserRole = 'admin' | 'manager';

interface Batch {
  id: string;
  name: string;
  shipmentDate: string;
  warehouse: string;
  deliveryType: 'sea' | 'air';
  status: 'shipped' | 'arrived_ua';
  totalWeight?: number;
  deliveryCost?: number;
  pricePerKg?: number;
  itemIds: string[];
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  purchased: 'Викуплено',
  shipped_by_seller: 'Відправлено продавцем',
  arrived_china: 'Прибуло в Китай',
  at_china_warehouse: 'На складі Китай',
  shipped_to_ua: 'В дорозі в Україну',
  arrived_ua: 'На складі Україна',
  sold: 'Видано на магазин'
};

const CropModal = ({ image, onCropComplete, onCancel }: { image: string, onCropComplete: (croppedImage: string) => void, onCancel: () => void }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropChange = (crop: { x: number, y: number }) => setCrop(crop);
  const onZoomChange = (zoom: number) => setZoom(zoom);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL('image/jpeg');
  };

  const handleCrop = async () => {
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels);
      onCropComplete(croppedImage);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-3xl overflow-hidden max-w-2xl w-full flex flex-col h-[80vh] md:h-[70vh]">
        <div className="p-4 md:p-6 border-b flex justify-between items-center">
          <h3 className="text-lg md:text-xl font-black text-black uppercase tracking-tight">Обрізати фото</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-red-500 transition-colors">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
        <div className="relative flex-1 bg-gray-900">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={onCropChange}
            onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
            onZoomChange={onZoomChange}
          />
        </div>
        <div className="p-4 md:p-6 bg-white border-t space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Зум</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-yellow-400"
            />
          </div>
          <div className="flex gap-3 md:gap-4">
            <button
              onClick={onCancel}
              className="flex-1 py-3 md:py-4 bg-gray-50 text-gray-400 rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs hover:bg-gray-100 transition-all"
            >
              Скасувати
            </button>
            <button
              onClick={handleCrop}
              className="flex-1 py-3 md:py-4 bg-yellow-400 text-black rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-100"
            >
              Застосувати
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
const DeleteConfirmModal = ({ show, title, message, onConfirm, onCancel }: { show: boolean, title: string, message: string, onConfirm: () => void, onCancel: () => void }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100"
      >
        <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center mb-6">
          <Trash2 className="w-8 h-8 text-yellow-500" />
        </div>
        <h3 className="text-2xl font-black text-black mb-2 uppercase tracking-tight">{title}</h3>
        <p className="text-gray-500 font-medium mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-4">
          <button 
            onClick={onCancel}
            className="flex-1 py-4 bg-gray-50 text-gray-400 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-100 transition-all"
          >
            Скасувати
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-4 bg-yellow-400 text-black rounded-xl font-black uppercase tracking-widest text-xs hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-100"
          >
            Видалити
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [crmModule, setCrmModule] = useState<CRMModule>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [searchQuery, setSearchQuery] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [chinaWarehouseSearch, setChinaWarehouseSearch] = useState('');
  const [uaWarehouseSearch, setUaWarehouseSearch] = useState('');
  const [salesSearch, setSalesSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [trackWarning, setTrackWarning] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<{id: string, text: string, time: string, type?: 'success' | 'info' | 'error'}[]>([]);
  
  const addNotification = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setNotifications(prev => [{ id: Math.random().toString(36).substr(2, 9), text, time: 'Щойно', type }, ...prev].slice(0, 5));
  };
  const [dashboardStats, setDashboardStats] = useState({
    inTransitToChina: 12,
    atChinaWarehouse: 45,
    inTransitToUA: 28,
    atUAWarehouse: 15
  });
  const [showAddPurchaseModal, setShowAddPurchaseModal] = useState(false);
  const [showImportTracksModal, setShowImportTracksModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{show: boolean, title: string, message: string, onConfirm: () => void} | null>(null);
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState<{show: boolean, batchId?: string}>({show: false});
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [costForm, setCostForm] = useState({
    totalWeight: 0,
    deliveryCost: 0,
    volume: 0,
    declaredValue: 0,
    isInsured: false,
    isFabric: false,
    isPressed: false,
    tariffId: 'turbo-sea'
  });
  const [purchases, setPurchases] = useState<Purchase[]>([
    {
      id: '1',
      platform: 'Taobao',
      name: 'Електросамокат Xiaomi',
      link: 'https://taobao.com/item/1',
      priceYuan: 2500,
      exchangeRate: 5.5,
      quantity: 1,
      trackNumber: 'TB998877661',
      photo: '',
      comment: 'Терміново',
      status: 'arrived_china',
      weight: 12.5,
      arrivalDate: '2026-03-18',
      createdAt: '2026-03-15T10:00:00Z'
    },
    {
      id: '2',
      platform: '1688',
      name: 'Набір інструментів',
      link: 'https://1688.com/item/2',
      priceYuan: 450,
      exchangeRate: 5.5,
      quantity: 2,
      trackNumber: 'TB998877662',
      photo: '',
      comment: '',
      status: 'shipped_by_seller',
      createdAt: '2026-03-17T14:30:00Z'
    }
  ]);
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem('crm_suppliers');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: '1688.com', url: 'https://1688.com', category: 'Опт', comment: 'Основний сайт для оптових закупівель', createdAt: new Date().toISOString() },
      { id: '2', name: 'Taobao.com', url: 'https://taobao.com', category: 'Роздріб', comment: 'Роздрібний маркетплейс', createdAt: new Date().toISOString() },
      { id: '3', name: 'Pinduoduo', url: 'https://pinduoduo.com', category: 'Дискаунтер', comment: 'Сайт з низькими цінами', createdAt: new Date().toISOString() }
    ];
  });
  const [showSupplierModal, setShowSupplierModal] = useState<{show: boolean, supplierId: string | null}>({ show: false, supplierId: null });
  const [showTariffModal, setShowTariffModal] = useState<{show: boolean, tariffId: string | null}>({ show: false, tariffId: null });
  const [tariffForm, setTariffForm] = useState<Partial<Tariff>>({
    name: '',
    iconName: 'Ship',
    deliveryDays: '',
    description: '',
    pricePerKg: 0,
    volumetricFactor: 0,
    localDeliveryPrice: 0,
    minWeight: 0,
    minVolume: 0,
    insuranceRate: 2,
    packagingCost: 0,
    customsFee: 0,
    handlingFee: 0,
    fuelSurcharge: 0
  });
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    url: '',
    category: 'Опт',
    comment: ''
  });

  useEffect(() => {
    localStorage.setItem('crm_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchForm, setBatchForm] = useState({
    name: '',
    shipmentDate: new Date().toISOString().split('T')[0],
    warehouse: 'Guangzhou',
    deliveryType: 'sea' as 'sea' | 'air'
  });
  const [cnyToUah, setCnyToUah] = useState(5.5);
  const [usdToUah, setUsdToUah] = useState(40);
  const [purchaseForm, setPurchaseForm] = useState({
    platform: 'Taobao',
    name: '',
    link: '',
    priceYuan: 0,
    exchangeRate: 5.5,
    quantity: 1,
    trackNumber: '',
    photo: '',
    comment: '',
    size: '',
    width: 0,
    height: 0,
    length: 0,
    dimUnit: 'cm' as 'cm' | 'm',
    weight: 0,
    weightUnit: 'kg' as 'g' | 'kg',
    volume: 0,
    density: 0,
    isFabric: false,
    isPressed: false,
    isInsured: false,
    declaredValue: 0,
    shippingCost: 0,
    status: 'purchased' as Purchase['status']
  });
  const [showSaleModal, setShowSaleModal] = useState<{show: boolean, purchaseId: string | null}>({ show: false, purchaseId: null });
  const [saleForm, setSaleForm] = useState({
    sellingPrice: 0,
    novaPoshtaCost: 0,
    ukraineDeliveryCost: 0,
    markup: false,
    markupValue: 0
  });
  const [priceListMargin, setPriceListMargin] = useState(20);
  const [showStorePreview, setShowStorePreview] = useState(false);
  const [priceListMarginPresets] = useState([0, 10, 20, 30, 40, 50, 100]);
  const [shippingPricePerKg, setShippingPricePerKg] = useState(12);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<string[]>([]);
  const [uaWarehouseDateFilter, setUaWarehouseDateFilter] = useState('');
  const [uaWarehouseBatchFilter, setUaWarehouseBatchFilter] = useState('');
  const [priceListDateFilter, setPriceListDateFilter] = useState('');
  const [priceListBatchFilter, setPriceListBatchFilter] = useState('');
  const [priceListView, setPriceListView] = useState<'grid' | 'table'>('grid');

  const exportToExcel = async (data: any[], fileName: string) => {
    addNotification('Генерація Excel...', 'info');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Price List');

    // Add Title Row
    const titleRow = worksheet.addRow(['CRM FORSAGE CHINA - ПРАЙС-ЛИСТ']);
    titleRow.font = { bold: true, size: 20, color: { argb: 'FF000000' } };
    worksheet.mergeCells('A1:O1');
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 40;

    // Add Date Row
    const dateRow = worksheet.addRow([`Дата генерації: ${new Date().toLocaleString()}`]);
    dateRow.font = { italic: true, size: 11, color: { argb: 'FF666666' } };
    worksheet.mergeCells('A2:O2');
    dateRow.alignment = { horizontal: 'center' };
    worksheet.addRow([]); // Empty row

    // Define columns
    worksheet.columns = [
      { header: 'Назва', key: 'name', width: 35 },
      { header: 'Опис / Коментар', key: 'comment', width: 40 },
      { header: 'Трек-номер', key: 'track', width: 25 },
      { header: 'Платформа', key: 'platform', width: 15 },
      { header: 'Кількість', key: 'qty', width: 10 },
      { header: 'Ціна (¥)', key: 'priceYuan', width: 12 },
      { header: 'Курс (¥/₴)', key: 'rate', width: 12 },
      { header: 'Сума (₴)', key: 'sumUah', width: 15 },
      { header: 'Вага (кг)', key: 'weight', width: 12 },
      { header: 'Розмір', key: 'dim', width: 25 },
      { header: 'Доставка (₴)', key: 'delivery', width: 15 },
      { header: 'Собівартість (₴)', key: 'cost', width: 15 },
      { header: 'Ціна продажу (₴)', key: 'sell', width: 18 },
      { header: 'Статус', key: 'status', width: 15 },
      { header: 'Партія', key: 'batch', width: 15 },
    ];

    // Add data
    const items = data.length > 0 && data[0].id ? data : purchases;
    items.forEach((p) => {
      const costPriceYuan = p.priceYuan * p.quantity;
      const costPriceUah = costPriceYuan * p.exchangeRate;
      const deliveryChinaUah = (p.deliveryCostPerItem || 0) * usdToUah; 
      const deliveryIntUah = (p.shippingCost || 0) * usdToUah; 
      const deliveryUAUah = (p.ukraineDeliveryCost || 0); 
      const deliveryNPUah = (p.novaPoshtaCost || 0); 
      const totalDeliveryUah = deliveryChinaUah + deliveryIntUah + deliveryUAUah + deliveryNPUah;
      const totalCostUah = costPriceUah + totalDeliveryUah;
      const sellingPriceUah = p.markup ? (p.sellingPrice || totalCostUah) : (totalCostUah * (1 + priceListMargin / 100));

      worksheet.addRow({
        name: p.name,
        comment: p.comment || '-',
        track: p.trackNumber,
        platform: p.platform,
        qty: p.quantity,
        priceYuan: p.priceYuan,
        rate: p.exchangeRate,
        sumUah: Math.round(costPriceUah),
        weight: p.weight || '-',
        dim: p.size || (p.width ? `${p.width}x${p.height}x${p.length}` : '-'),
        delivery: Math.round(totalDeliveryUah),
        cost: Math.round(totalCostUah),
        sell: Math.round(sellingPriceUah),
        status: statusLabels[p.status] || p.status,
        batch: p.batchId || '-'
      });
    });

    // Style header
    const headerRow = worksheet.getRow(4);
    headerRow.height = 30;
    headerRow.font = { bold: true, color: { argb: 'FF000000' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFACC15' } // Yellow theme
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 4) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
          if (rowNumber > 4) {
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
            if (cell.value && typeof cell.value === 'number') {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }
            if (rowNumber % 2 === 0) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF9F9F9' }
              };
            }
          }
        });
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileName}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    addNotification('Excel успішно згенеровано', 'success');
  };

  const exportToExcelWithPhotos = async (data: Purchase[], fileName: string) => {
    addNotification('Генерація Excel з фото...', 'info');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Purchases');

    // Define columns
    worksheet.columns = [
      { header: 'Фото', key: 'photo', width: 25 },
      { header: 'Назва', key: 'name', width: 35 },
      { header: 'Опис / Коментар', key: 'comment', width: 35 },
      { header: 'Трек-номер', key: 'track', width: 25 },
      { header: 'Платформа / Сайт', key: 'platform', width: 20 },
      { header: 'Кількість', key: 'qty', width: 10 },
      { header: 'Ціна (¥)', key: 'priceYuan', width: 15 },
      { header: 'Ціна (₴)', key: 'priceUah', width: 15 },
      { header: 'Сума (₴)', key: 'sumUah', width: 15 },
      { header: 'Вага (кг)', key: 'weight', width: 10 },
      { header: 'Розмір', key: 'dim', width: 20 },
      { header: 'Об\'єм (м³)', key: 'volume', width: 15 },
      { header: 'Щільність (кг/м³)', key: 'density', width: 15 },
      { header: 'Доставка (₴)', key: 'delivery', width: 15 },
      { header: 'Собівартість (₴)', key: 'cost', width: 15 },
      { header: 'Ціна продажу (₴)', key: 'sell', width: 15 },
    ];

    // Add data
    for (let i = 0; i < data.length; i++) {
      const p = data[i];
      const costPriceUah = (p.priceYuan * p.quantity) * p.exchangeRate;
      const deliveryTotalUah = ((p.deliveryCostPerItem || 0) * usdToUah) + ((p.shippingCost || 0) * usdToUah) + (p.ukraineDeliveryCost || 0) + (p.novaPoshtaCost || 0);
      const totalCostUah = costPriceUah + deliveryTotalUah;
      const sellingPriceUah = p.markup ? (p.sellingPrice || totalCostUah) : (totalCostUah * (1 + priceListMargin / 100));

      const row = worksheet.addRow({
        name: p.name,
        comment: p.comment || '-',
        track: p.trackNumber,
        platform: p.platform,
        qty: p.quantity,
        priceYuan: p.priceYuan,
        priceUah: (p.priceYuan * p.exchangeRate).toFixed(2),
        sumUah: costPriceUah.toFixed(0),
        weight: p.weight || '-',
        dim: p.size || (p.width ? `${p.width}x${p.height}x${p.length}` : '-'),
        volume: p.volume || '-',
        density: p.density || '-',
        delivery: deliveryTotalUah.toFixed(0),
        cost: totalCostUah.toFixed(0),
        sell: sellingPriceUah.toFixed(0),
      });

      row.height = 100; // Set row height for images
      row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      if (p.photo) {
        try {
          if (p.photo.includes('base64,')) {
            const base64Data = p.photo.split('base64,')[1];
            const imageId = workbook.addImage({
              base64: base64Data,
              extension: 'jpeg',
            });
            worksheet.addImage(imageId, {
              tl: { col: 0, row: i + 1 },
              ext: { width: 120, height: 120 },
              editAs: 'oneCell'
            });
          }
        } catch (e) {
          console.error('Error adding image to Excel:', e);
        }
      }
    }

    // Style header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF003d2b' } // TURBO_GREEN
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 30;

    // Add borders to all cells
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileName}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    addNotification('Excel з фото успішно згенеровано', 'success');
  };

  const toggleSelectAll = (ids: string[]) => {
    if (selectedPurchaseIds.length === ids.length) {
      setSelectedPurchaseIds([]);
    } else {
      setSelectedPurchaseIds(ids);
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedPurchaseIds.includes(id)) {
      setSelectedPurchaseIds(selectedPurchaseIds.filter(i => i !== id));
    } else {
      setSelectedPurchaseIds([...selectedPurchaseIds, id]);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addNotification(`Трек-номер ${text} скопійовано`, 'success');
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (!showAddPurchaseModal) return;
      
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (e) => {
              setCropImage(e.target?.result as string);
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [showAddPurchaseModal]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const matchesSearch = 
        p.trackNumber.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
        p.name.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
        p.platform.toLowerCase().includes(purchaseSearch.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [purchases, purchaseSearch, statusFilter]);

  const handleSale = () => {
    if (!showSaleModal.purchaseId) return;
    
    setPurchases(purchases.map(p => 
      p.id === showSaleModal.purchaseId 
        ? { 
            ...p, 
            status: 'sold', 
            sellingPrice: saleForm.sellingPrice,
            novaPoshtaCost: saleForm.novaPoshtaCost,
            ukraineDeliveryCost: saleForm.ukraineDeliveryCost,
            markup: saleForm.markup,
            markupValue: saleForm.markupValue,
            soldDate: new Date().toISOString()
          } 
        : p
    ));
    
    setShowSaleModal({ show: false, purchaseId: null });
    setSaleForm({ sellingPrice: 0, novaPoshtaCost: 0, ukraineDeliveryCost: 0, markup: false, markupValue: 0 });
    addNotification('Товар видано на магазин', 'success');
  };

  const handleDeleteSale = (id: string) => {
    if (confirm('Ви впевнені, що хочете видалити цей продаж? Товар повернеться на склад Україна.')) {
      setPurchases(purchases.map(p => p.id === id ? { 
        ...p, 
        status: 'arrived_ua', 
        sellingPrice: undefined, 
        soldDate: undefined,
        novaPoshtaCost: undefined,
        ukraineDeliveryCost: undefined
      } : p));
      addNotification('Продаж скасовано', 'info');
    }
  };

  const handleEditSale = (p: Purchase) => {
    setSaleForm({
      sellingPrice: p.sellingPrice || 0,
      novaPoshtaCost: p.novaPoshtaCost || 0,
      ukraineDeliveryCost: p.ukraineDeliveryCost || 0,
      markup: p.markup || false,
      markupValue: p.markupValue || 0
    });
    setShowSaleModal({ show: true, purchaseId: p.id });
  };
  const [activeTab, setActiveTab] = useState<CalculatorType>('international');
  const [inputMethod, setInputMethod] = useState<'dims' | 'density'>('dims');
  const [tariffs, setTariffs] = useState<Tariff[]>(() => {
    const saved = localStorage.getItem('crm_tariffs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_TARIFFS;
      }
    }
    return DEFAULT_TARIFFS;
  });

  useEffect(() => {
    localStorage.setItem('crm_tariffs', JSON.stringify(tariffs));
  }, [tariffs]);

  const [selectedTariffId, setSelectedTariffId] = useState<string>(tariffs[0].id);
  
  // International Parcel State
  const [parcel, setParcel] = useState<ParcelData>({
    weight: 0,
    length: 0,
    width: 0,
    height: 0,
    volume: 0,
    declaredValue: 0,
    isFabric: false,
    isPressed: false,
    isInsured: true
  });

  // Nova Poshta State
  const [npData, setNpData] = useState<NovaPoshtaData>({
    weight: 0,
    length: 0,
    width: 0,
    height: 0,
    declaredValue: 0,
    destination: 'city'
  });

  // Money Transfer State
  const [transferData, setTransferData] = useState<MoneyTransferData>({
    amount: 0,
    method: 'card'
  });

  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const isIframe = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }, []);

  const handleExportPDF = async () => {
    const element = document.getElementById('price-list-container');
    if (!element) {
      addNotification('Помилка: Контейнер для друку не знайдено', 'error');
      return;
    }

    setIsExportingPDF(true);
    addNotification('Генерація PDF...', 'info');

    try {
      // modern-screenshot handles images and modern CSS (like oklch) much better than html2canvas
      const imgData = await domToPng(element, {
        scale: 1.5,
        backgroundColor: '#ffffff',
        width: 1400,
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList.contains('no-print')) {
            return false;
          }
          return true;
        }
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`forsage-china-price-list-${new Date().toISOString().split('T')[0]}.pdf`);
      addNotification('PDF успішно згенеровано', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      addNotification('Помилка при генерації PDF. Спробуйте звичайний друк.', 'error');
      window.focus();
      window.print();
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleEditPurchase = (purchase: Purchase) => {
    setPurchaseForm({
      platform: purchase.platform,
      name: purchase.name,
      link: purchase.link,
      priceYuan: purchase.priceYuan,
      exchangeRate: purchase.exchangeRate,
      quantity: purchase.quantity,
      trackNumber: purchase.trackNumber,
      photo: purchase.photo,
      comment: purchase.comment,
      size: purchase.size || '',
      width: purchase.width || 0,
      height: purchase.height || 0,
      length: purchase.length || 0,
      dimUnit: purchase.dimUnit || 'cm',
      weight: purchase.weight || 0,
      weightUnit: purchase.weightUnit || 'kg',
      volume: purchase.volume || 0,
      density: purchase.density || 0,
      isFabric: purchase.isFabric || false,
      isPressed: purchase.isPressed || false,
      isInsured: purchase.isInsured || false,
      declaredValue: purchase.declaredValue || 0,
      shippingCost: purchase.shippingCost || 0,
      status: purchase.status
    });
    setEditingPurchaseId(purchase.id);
    setShowAddPurchaseModal(true);
  };

  const handleDeletePurchase = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Видалити запис?',
      message: 'Ви впевнені, що хочете видалити цей запис? Цю дію неможливо скасувати.',
      onConfirm: () => {
        setPurchases(purchases.filter(p => p.id !== id));
        addNotification('Запис видалено', 'error');
        setConfirmModal(null);
      }
    });
  };

  const handleEditBatch = (batch: Batch) => {
    setBatchForm({
      name: batch.name,
      shipmentDate: batch.shipmentDate,
      warehouse: batch.warehouse,
      deliveryType: batch.deliveryType
    });
    setEditingBatchId(batch.id);
    setShowCreateBatchModal(true);
  };

  const handleDeleteBatch = (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Видалити партію?',
      message: 'Ви впевнені, що хочете видалити цю партію? Всі товари в ній повернуться до статусу "На складі Китай".',
      onConfirm: () => {
        setPurchases(purchases.map(p => p.batchId === id ? { ...p, status: 'arrived_china', batchId: undefined } : p));
        setBatches(batches.filter(b => b.id !== id));
        addNotification('Партію видалено', 'error');
        setConfirmModal(null);
      }
    });
  };

  const handleSavePurchase = (addAnother = false) => {
    // Check for duplicate track number before saving (only if not editing same item)
    if (purchaseForm.trackNumber && purchases.some(p => p.trackNumber === purchaseForm.trackNumber && p.id !== editingPurchaseId)) {
      const existing = purchases.find(p => p.trackNumber === purchaseForm.trackNumber);
      setTrackWarning({ exists: true, purchaseId: existing?.id });
      return;
    }

    if (editingPurchaseId) {
      setPurchases(purchases.map(p => p.id === editingPurchaseId ? { ...p, ...purchaseForm } : p));
      addNotification(`Запис "${purchaseForm.name}" оновлено`);
      setEditingPurchaseId(null);
    } else {
      const newPurchase: Purchase = {
        ...purchaseForm,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString()
      };
      setPurchases([newPurchase, ...purchases]);
      addNotification(`Товар "${newPurchase.name}" додано до бази`);
    }
    
    if (addAnother && !editingPurchaseId) {
      setPurchaseForm({
        ...purchaseForm,
        name: '',
        link: '',
        priceYuan: 0,
        quantity: 1,
        trackNumber: '',
        photo: '',
        comment: '',
        size: '',
        width: 0,
        height: 0,
        length: 0,
        dimUnit: 'cm',
        weight: 0,
        weightUnit: 'kg',
        volume: 0,
        density: 0,
        isFabric: false,
        isPressed: false,
        isInsured: false,
        declaredValue: 0,
        shippingCost: 0,
        status: 'purchased'
      });
    } else {
      setShowAddPurchaseModal(false);
      setPurchaseForm({
        platform: 'Taobao',
        name: '',
        link: '',
        priceYuan: 0,
        exchangeRate: 5.5,
        quantity: 1,
        trackNumber: '',
        photo: '',
        comment: '',
        size: '',
        width: 0,
        height: 0,
        length: 0,
        dimUnit: 'cm',
        weight: 0,
        weightUnit: 'kg',
        shippingCost: 0,
        status: 'purchased'
      });
    }
  };

  const handleCreateBatch = () => {
    if (editingBatchId) {
      setBatches(batches.map(b => b.id === editingBatchId ? { ...b, ...batchForm } : b));
      addNotification(`Партію "${batchForm.name}" оновлено`);
      setEditingBatchId(null);
      setShowCreateBatchModal(false);
      setBatchForm({
        name: '',
        shipmentDate: new Date().toISOString().split('T')[0],
        warehouse: 'Guangzhou',
        deliveryType: 'sea'
      });
      return;
    }

    const itemsToBatch = purchases.filter(p => p.status === 'arrived_china');
    if (itemsToBatch.length === 0) {
      alert('Немає товарів зі статусом "На складі Китай"');
      return;
    }

    const newBatch: Batch = {
      id: Math.random().toString(36).substr(2, 9),
      name: batchForm.name || `BATCH-${new Date().toISOString().split('T')[0]}`,
      shipmentDate: batchForm.shipmentDate,
      warehouse: batchForm.warehouse,
      deliveryType: batchForm.deliveryType,
      status: 'shipped',
      itemIds: itemsToBatch.map(p => p.id),
      createdAt: new Date().toISOString()
    };

    setBatches([newBatch, ...batches]);
    
    // Update purchase statuses
    setPurchases(purchases.map(p => 
      p.status === 'arrived_china' 
        ? { ...p, status: 'shipped_to_ua', batchId: newBatch.id } 
        : p
    ));

    setShowCreateBatchModal(false);
    setBatchForm({
      name: '',
      shipmentDate: new Date().toISOString().split('T')[0],
      warehouse: 'Guangzhou',
      deliveryType: 'sea'
    });
    addNotification(`Партію "${newBatch.name}" успішно відправлено в Україну`);
  };

  const handleBatchArrived = (batchId: string) => {
    setBatches(batches.map(b => 
      b.id === batchId ? { ...b, status: 'arrived_ua' } : b
    ));
    
    setPurchases(purchases.map(p => 
      p.batchId === batchId ? { ...p, status: 'arrived_ua' } : p
    ));
    addNotification(`Партія прибула на склад в Україну`);
  };

  const handleSaveCosts = () => {
    if (!showCostModal.batchId) return;
    
    const selectedTariff = tariffs.find(t => t.id === costForm.tariffId) || tariffs[0];
    
    let shippingCost = 0;
    if (selectedTariff.pricePerKg) {
      const volumetricWeight = (costForm.volume * 1000000) / (selectedTariff.volumetricFactor || 5000);
      shippingCost = selectedTariff.pricePerKg * Math.max(costForm.totalWeight, volumetricWeight);
    } else if (selectedTariff.densityTiers) {
      const density = costForm.volume > 0 ? costForm.totalWeight / costForm.volume : 0;
      const tier = selectedTariff.densityTiers.find(t => density >= t.min && (t.max === null || density < t.max));
      if (tier) {
        shippingCost = tier.unit === 'm3' ? tier.price * costForm.volume : tier.price * costForm.totalWeight;
      }
    }

    const insurance = (costForm.isInsured && costForm.declaredValue) ? Math.max(1, costForm.declaredValue * 0.02) : 0;
    const fabricSurcharge = costForm.isFabric ? costForm.totalWeight * 0.2 : 0;
    const pressingCost = costForm.isPressed ? 5 : 0;
    const localDelivery = (selectedTariff.localDeliveryPrice || 0) * costForm.totalWeight;
    
    const totalDeliveryCost = costForm.deliveryCost || (shippingCost + insurance + localDelivery + fabricSurcharge + pressingCost);
    const pricePerKg = costForm.totalWeight > 0 ? totalDeliveryCost / costForm.totalWeight : 0;
    
    setBatches(batches.map(b => 
      b.id === showCostModal.batchId 
        ? { ...b, totalWeight: costForm.totalWeight, deliveryCost: totalDeliveryCost, pricePerKg } 
        : b
    ));

    // Update individual items in the batch
    setPurchases(purchases.map(p => {
      if (p.batchId === showCostModal.batchId && p.weight) {
        return { ...p, deliveryCostPerItem: p.weight * pricePerKg };
      }
      return p;
    }));

    setShowCostModal({show: false});
    setCostForm({ 
      totalWeight: 0, 
      deliveryCost: 0, 
      volume: 0, 
      declaredValue: 0, 
      isInsured: false, 
      isFabric: false, 
      isPressed: false, 
      tariffId: 'turbo-sea' 
    });
  };

  const handleTrackNumberChange = (value: string) => {
    setPurchaseForm({ ...purchaseForm, trackNumber: value });
    if (value && purchases.some(p => p.trackNumber.toLowerCase() === value.toLowerCase())) {
      const existing = purchases.find(p => p.trackNumber.toLowerCase() === value.toLowerCase());
      setTrackWarning({ exists: true, purchaseId: existing?.id });
    } else {
      setTrackWarning(null);
    }
  };

  const selectedTariff = useMemo(() => 
    tariffs.find(t => t.id === selectedTariffId) || tariffs[0]
  , [tariffs, selectedTariffId]);

  // --- International Calculations ---
  const volumeM3 = useMemo(() => {
    // If manual volume is provided, use it
    if (parcel.volume && parcel.volume > 0) return parcel.volume;
    // Otherwise calculate from dimensions
    if (!parcel.length || !parcel.width || !parcel.height) return 0;
    return (parcel.length * parcel.width * parcel.height) / 1000000;
  }, [parcel.volume, parcel.length, parcel.width, parcel.height]);

  const density = useMemo(() => {
    if (inputMethod === 'density') return parcel.density || 0;
    if (volumeM3 === 0) return 0;
    return parcel.weight / volumeM3;
  }, [parcel.weight, volumeM3, parcel.density, inputMethod]);

  const finalVolumeM3 = useMemo(() => {
    if (inputMethod === 'density' && density > 0) return parcel.weight / density;
    return volumeM3;
  }, [inputMethod, density, parcel.weight, volumeM3]);

  // Auto-update volume field when dimensions change
  React.useEffect(() => {
    if (parcel.length && parcel.width && parcel.height) {
      const calculatedVolume = (parcel.length * parcel.width * parcel.height) / 1000000;
      if (calculatedVolume !== parcel.volume) {
        setParcel(prev => ({ ...prev, volume: Number(calculatedVolume.toFixed(4)) }));
      }
    }
  }, [parcel.length, parcel.width, parcel.height]);

  const internationalDetails = useMemo(() => {
    let shippingCost = 0;
    let unit = '';
    let rate = 0;
    let chargeableValue = 0;

    if (selectedTariff.densityTiers) {
      const tier = selectedTariff.densityTiers.find(t => 
        density >= t.min && (t.max === null || density < t.max)
      );
      if (tier) {
        rate = tier.price;
        unit = tier.unit;
        chargeableValue = tier.unit === 'kg' 
          ? Math.max(parcel.weight, selectedTariff.minWeight || 0) 
          : Math.max(finalVolumeM3, selectedTariff.minVolume || 0);
        shippingCost = rate * chargeableValue;
      }
    } else if (selectedTariff.pricePerKg && selectedTariff.volumetricFactor) {
      const volumetricWeight = inputMethod === 'dims' 
        ? (parcel.length * parcel.width * parcel.height) / selectedTariff.volumetricFactor
        : 0;
      chargeableValue = Math.max(parcel.weight, volumetricWeight, selectedTariff.minWeight || 0);
      rate = selectedTariff.pricePerKg;
      unit = 'kg';
      shippingCost = rate * chargeableValue;
    }

    const insurance = (parcel.isInsured && parcel.declaredValue) 
      ? Math.max(1, parcel.declaredValue * (selectedTariff.insuranceRate || 2) / 100) 
      : 0;
    const fabricSurcharge = parcel.isFabric ? parcel.weight * 0.2 : 0;
    const pressingCost = parcel.isPressed ? 10 : 0;
    const localDelivery = (selectedTariff.localDeliveryPrice || 0) * parcel.weight;
    const packagingCost = ((selectedTariff.packagingCost || 0) * parcel.weight) + ((selectedTariff.packagingCostPerM3 || 0) * finalVolumeM3);
    const customsFee = selectedTariff.customsFee || 0;
    const handlingFee = selectedTariff.handlingFee || 0;
    const baseForFuel = shippingCost + customsFee + handlingFee;
    const fuelSurcharge = baseForFuel * (selectedTariff.fuelSurcharge || 0) / 100;

    let total = shippingCost + insurance + localDelivery + fabricSurcharge + pressingCost + packagingCost + customsFee + handlingFee + fuelSurcharge;
    
    if (selectedTariff.minCost && total < selectedTariff.minCost) {
      total = selectedTariff.minCost;
    }

    const shippingCostUah = shippingCost * usdToUah;
    const insuranceUah = insurance * usdToUah;
    const fabricSurchargeUah = fabricSurcharge * usdToUah;
    const pressingCostUah = pressingCost * usdToUah;
    const localDeliveryUah = localDelivery * usdToUah;
    const packagingCostUah = packagingCost * usdToUah;
    const customsFeeUah = customsFee * usdToUah;
    const handlingFeeUah = handlingFee * usdToUah;
    const fuelSurchargeUah = fuelSurcharge * usdToUah;
    const totalUah = total * usdToUah;

    return { 
      shippingCost, insurance, localDelivery, fabricSurcharge, pressingCost, 
      packagingCost, customsFee, handlingFee, fuelSurcharge, total, 
      shippingCostUah, insuranceUah, localDeliveryUah, fabricSurchargeUah, pressingCostUah, 
      packagingCostUah, customsFeeUah, handlingFeeUah, fuelSurchargeUah, totalUah,
      rate, unit, chargeableValue 
    };
  }, [parcel, selectedTariff, density, finalVolumeM3, inputMethod, usdToUah]);

  // --- Nova Poshta Calculations ---
  const npDetails = useMemo(() => {
    const volumetricWeight = (npData.length * npData.width * npData.height) / 4000;
    const chargeableWeight = Math.max(npData.weight, volumetricWeight);
    
    let basePrice = 0;
    if (chargeableWeight <= 2) basePrice = 70;
    else if (chargeableWeight <= 10) basePrice = 100;
    else if (chargeableWeight <= 30) basePrice = 140;
    else basePrice = 140 + (chargeableWeight - 30) * 5;

    // Destination multiplier
    if (npData.destination === 'region') basePrice += 20;
    if (npData.destination === 'ukraine') basePrice += 35;

    const insurance = Math.max(1, npData.declaredValue * 0.005);
    const total = basePrice + insurance;

    return { basePrice, insurance, total, chargeableWeight, volumetricWeight };
  }, [npData]);

  // --- Money Transfer Calculations ---
  const transferDetails = useMemo(() => {
    const feePercent = transferData.method === 'card' ? 0.01 : 0.02;
    const fixedFee = transferData.method === 'card' ? 5 : 20;
    const fee = (transferData.amount * feePercent) + fixedFee;
    const total = transferData.amount + fee;

    return { fee, total };
  }, [transferData]);

  const crmModules: CRMModuleConfig[] = [
    { id: 'dashboard', title: 'Головна панель', icon: LayoutDashboard, description: 'Загальний огляд та швидкі дії' },
    { id: 'purchases', title: 'Закупки', icon: ShoppingCart, description: 'Управління замовленнями та постачальниками' },
    { id: 'china_warehouse', title: 'Трекінг і склад Китай', icon: Warehouse, description: 'Прийом та обробка вантажів у Китаї' },
    { id: 'consolidation', title: 'Консолідація і доставка Китай', icon: Combine, description: 'Формування партій та логістика в Україну' },
    { id: 'ua_warehouse', title: 'Склад Україна', icon: Package, description: 'Наявність та облік товарів в Україні' },
    { id: 'finance', title: 'Фінанси', icon: Receipt, description: 'Облік витрат та прибутків' },
    { id: 'analytics', title: 'Аналітика', icon: BarChart3, description: 'Статистика та звіти' },
    { id: 'price_list', title: 'Прайс-лист', icon: FileText, description: 'Формування прайсу з фото та доставкою' },
    { id: 'suppliers', title: 'Сайти постачальників', icon: Globe, description: 'База перевірених сайтів та посилань' },
    { id: 'settings', title: 'Налаштування', icon: Settings, description: 'Курси валют та системні параметри' },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1a1a1a] font-sans selection:bg-yellow-100">
      
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-100 py-0.5 hidden sm:block">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center text-[10px] text-gray-500 font-medium">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => setView('calculator')}>
              <div className="w-4 h-4 rounded-full bg-yellow-50 flex items-center justify-center group-hover:bg-yellow-100 transition-colors">
                <Calculator className="w-2 h-2 text-black" />
              </div>
              <span className={cn("group-hover:text-black transition-colors", view === 'calculator' && "text-black font-bold")}>Калькулятор</span>
            </div>
            <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => setView('crm')}>
              <div className="w-4 h-4 rounded-full bg-yellow-50 flex items-center justify-center group-hover:bg-yellow-100 transition-colors">
                <LayoutDashboard className="w-2 h-2 text-black" />
              </div>
              <span className={cn("group-hover:text-black transition-colors", view === 'crm' && "text-black font-bold")}>CRM FORSAGE CHINA</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 border-r border-gray-100 pr-4">
              <MessageCircle className="w-3.5 h-3.5 hover:text-black cursor-pointer transition-colors" />
              <Globe className="w-3.5 h-3.5 hover:text-black cursor-pointer transition-colors" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black cursor-pointer text-black">UA</span>
              <span className="text-gray-300">|</span>
              <span className="font-bold cursor-pointer hover:text-black transition-colors">RU</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-black text-white shadow-md sticky top-0 z-50 no-print border-b border-yellow-400/20">
        <div className="max-w-7xl mx-auto px-4 h-7 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setView('home')}
          >
            <div className="w-6 h-6 bg-yellow-400 rounded-lg flex items-center justify-center rotate-3 group-hover:rotate-12 transition-transform shadow-lg shadow-yellow-400/20">
              <Zap className="w-3 h-3 text-black fill-current" />
            </div>
            <div className="flex flex-col -space-y-1">
              <h1 className="text-base font-black tracking-tighter leading-none flex items-center gap-1">
                FORSAGE <span className="text-yellow-400">CHINA</span>
              </h1>
              <p className="text-[6px] font-bold text-yellow-400/60 uppercase tracking-[0.2em] leading-none mt-0.5">CRM FORSAGE CHINA</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            <button 
              onClick={() => setView('calculator')}
              className={cn(
                "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                view === 'calculator' ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20" : "text-white/60 hover:text-yellow-400 hover:bg-white/5"
              )}
            >
              <Calculator className="w-2.5 h-2.5" />
              Калькулятор
            </button>
            <button 
              onClick={() => setView('crm')}
              className={cn(
                "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                view === 'crm' ? "bg-yellow-400 text-black shadow-lg shadow-yellow-400/20" : "text-white/60 hover:text-yellow-400 hover:bg-white/5"
              )}
            >
              <LayoutDashboard className="w-2.5 h-2.5" />
              CRM FORSAGE CHINA
            </button>
          </nav>
        </div>
      </header>

      {view === 'home' && (
        <div className="min-h-[calc(100vh-60px)] flex items-center justify-center bg-black relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-400/20 via-transparent to-transparent" />
          </div>
          <div className="max-w-4xl w-full px-6 relative z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-10"
            >
              <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter mb-2 uppercase">
                Forsage<span className="text-[#facc15]">China</span>
              </h1>
              <p className="text-yellow-400/60 text-[10px] font-black uppercase tracking-[0.4em]">Professional Logistics Management</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <motion.button
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setView('calculator')}
                className="group relative bg-white/5 backdrop-blur-md rounded-2xl p-6 text-left border border-white/10 hover:border-yellow-400/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center group-hover:rotate-6 transition-transform">
                    <Calculator className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-tight">Калькулятор</h2>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-0.5">Розрахунок доставки</p>
                  </div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setView('crm')}
                className="group relative bg-white/5 backdrop-blur-md rounded-2xl p-6 text-left border border-white/10 hover:border-yellow-400/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center group-hover:rotate-6 transition-transform">
                    <LayoutDashboard className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-tight">CRM FORSAGE CHINA</h2>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-0.5">Управління системою</p>
                  </div>
                </div>
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {view === 'calculator' ? (
        <>
          {/* Sub Navigation for Calculator */}
          <div className="bg-black border-t border-yellow-400/10 py-1.5">
            <div className="max-w-7xl mx-auto px-6 flex justify-center">
              <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10">
                <button 
                  onClick={() => setActiveTab('international')}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                    activeTab === 'international' ? "bg-yellow-400 text-black shadow-lg" : "text-white/60 hover:text-white"
                  )}
                >
                  <Globe className="w-2.5 h-2.5" />
                  Китай
                </button>
                <button 
                  onClick={() => setActiveTab('novaposhta')}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                    activeTab === 'novaposhta' ? "bg-yellow-400 text-black shadow-lg" : "text-white/60 hover:text-white"
                  )}
                >
                  <Truck className="w-2.5 h-2.5" />
                  Нова Пошта
                </button>
                <button 
                  onClick={() => setActiveTab('transfer')}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                    activeTab === 'transfer' ? "bg-yellow-400 text-black shadow-lg" : "text-white/60 hover:text-white"
                  )}
                >
                  <DollarSign className="w-2.5 h-2.5" />
                  Переказ
                </button>
              </div>
            </div>
          </div>

          {/* Hero Section */}
          <div className="bg-black py-16 text-center text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <img 
            src="https://picsum.photos/seed/logistics/1920/1080?blur=2" 
            alt="Background" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black" />
        </div>
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-6xl font-display font-black mb-4 tracking-tight leading-tight uppercase italic">
              Розрахунок <span className="text-yellow-400">вартості</span> доставки
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto font-medium">
              Професійний калькулятор для точного прорахунку логістики з Китаю.
            </p>
          </motion.div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 -mt-16">
        
        {/* Left Column: Inputs */}
        <div className="lg:col-span-7 space-y-10">
          
          {activeTab === 'international' && (
            <>
              {/* Manual Input Section */}
              <section className="bg-white rounded-2xl p-10 shadow-2xl border-b-8 border-yellow-400 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gray-50 -mr-20 -mt-20 rounded-full" />
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-white shadow-lg shadow-gray-900/20">
                      <Package className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="font-display font-black text-3xl uppercase tracking-tight text-black">Параметри вантажу</h2>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Вкажіть дані вашої посилки</p>
                    </div>
                  </div>

                  <div className="flex bg-gray-100 p-1 rounded-xl self-start sm:self-center">
                    <button 
                      onClick={() => setInputMethod('dims')}
                      className={cn(
                        "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        inputMethod === 'dims' ? "bg-black text-white shadow-md" : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      Розміри
                    </button>
                    <button 
                      onClick={() => setInputMethod('density')}
                      className={cn(
                        "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        inputMethod === 'density' ? "bg-black text-white shadow-md" : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      Щільність
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 relative z-10">
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Scale className="w-4 h-4 text-yellow-500" /> Фактична вага (кг)
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={parcel.weight || ''} 
                        onChange={(e) => setParcel(p => ({ ...p, weight: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.00"
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-6 py-5 focus:border-black focus:bg-white outline-none font-black text-2xl transition-all placeholder:text-gray-200"
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 font-black">KG</div>
                    </div>
                  </div>

                  {inputMethod === 'dims' ? (
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Layers className="w-4 h-4 text-yellow-500" /> Об'єм вантажу (м³)
                      </label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={parcel.volume || ''} 
                          onChange={(e) => setParcel(p => ({ ...p, volume: parseFloat(e.target.value) || 0 }))}
                          placeholder="0.000"
                          step="0.001"
                          className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-6 py-5 focus:border-black focus:bg-white outline-none font-black text-2xl transition-all placeholder:text-gray-200"
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 font-black">M³</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Maximize className="w-4 h-4 text-yellow-500" /> Щільність (кг/м³)
                      </label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={parcel.density || ''} 
                          onChange={(e) => setParcel(p => ({ ...p, density: parseFloat(e.target.value) || 0 }))}
                          placeholder="0"
                          className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-6 py-5 focus:border-black focus:bg-white outline-none font-black text-2xl transition-all placeholder:text-gray-200"
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 font-black">KG/M³</div>
                      </div>
                    </div>
                  )}
                  
                  {inputMethod === 'dims' && (
                    <div className="space-y-4 sm:col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Maximize className="w-4 h-4 text-yellow-500" /> Габарити (см)
                        </label>
                        <span className="text-[10px] text-gray-300 font-black uppercase tracking-widest">Об'єм розраховується автоматично</span>
                      </div>
                      <div className="grid grid-cols-3 gap-6">
                        <div className="relative">
                          <input 
                            type="number" 
                            value={parcel.length || ''} 
                            onChange={(e) => setParcel(p => ({ ...p, length: parseFloat(e.target.value) || 0 }))}
                            placeholder="Д"
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-5 focus:border-black focus:bg-white outline-none text-center font-black text-xl placeholder:text-gray-200"
                          />
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-gray-300 font-black uppercase">Довжина</span>
                        </div>
                        <div className="relative">
                          <input 
                            type="number" 
                            value={parcel.width || ''} 
                            onChange={(e) => setParcel(p => ({ ...p, width: parseFloat(e.target.value) || 0 }))}
                            placeholder="Ш"
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-5 focus:border-black focus:bg-white outline-none text-center font-black text-xl placeholder:text-gray-200"
                          />
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-gray-300 font-black uppercase">Ширина</span>
                        </div>
                        <div className="relative">
                          <input 
                            type="number" 
                            value={parcel.height || ''} 
                            onChange={(e) => setParcel(p => ({ ...p, height: parseFloat(e.target.value) || 0 }))}
                            placeholder="В"
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-5 focus:border-black focus:bg-white outline-none text-center font-black text-xl placeholder:text-gray-200"
                          />
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-gray-300 font-black uppercase">Висота</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 sm:col-span-2 pt-4">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-yellow-500" /> Оголошена вартість ($)
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={parcel.declaredValue || ''} 
                        onChange={(e) => setParcel(p => ({ ...p, declaredValue: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.00"
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-6 py-5 focus:border-black focus:bg-white outline-none font-black text-2xl transition-all placeholder:text-gray-200"
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-yellow-500 font-black">USD</div>
                    </div>
                  </div>

                  <div className="space-y-4 sm:col-span-2 pt-6 border-t border-gray-50">
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      Додаткові параметри
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <button 
                        onClick={() => setParcel(p => ({ ...p, isInsured: !p.isInsured }))}
                        className={cn(
                          "flex items-center justify-between p-5 rounded-xl border-2 transition-all group",
                          parcel.isInsured ? "border-black bg-black/5" : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <ShieldCheck className={cn("w-5 h-5 transition-colors", parcel.isInsured ? "text-yellow-500" : "text-gray-400 group-hover:text-yellow-500")} />
                          <span className={cn("text-[11px] font-black uppercase tracking-widest", parcel.isInsured ? "text-black" : "text-gray-400")}>Страхування (2%)</span>
                        </div>
                        <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", parcel.isInsured ? "border-black bg-black" : "border-gray-200")}>
                          {parcel.isInsured && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </button>
                      <button 
                        onClick={() => setParcel(p => ({ ...p, isFabric: !p.isFabric }))}
                        className={cn(
                          "flex items-center justify-between p-5 rounded-xl border-2 transition-all group",
                          parcel.isFabric ? "border-black bg-black/5" : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Scissors className={cn("w-5 h-5 transition-colors", parcel.isFabric ? "text-yellow-500" : "text-gray-400 group-hover:text-yellow-500")} />
                          <span className={cn("text-[11px] font-black uppercase tracking-widest", parcel.isFabric ? "text-black" : "text-gray-400")}>Тканина (+0.2$/кг)</span>
                        </div>
                        <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", parcel.isFabric ? "border-black bg-black" : "border-gray-200")}>
                          {parcel.isFabric && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </button>
                      <button 
                        onClick={() => setParcel(p => ({ ...p, isPressed: !p.isPressed }))}
                        className={cn(
                          "flex items-center justify-between p-5 rounded-xl border-2 transition-all group",
                          parcel.isPressed ? "border-black bg-black/5" : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Minimize2 className={cn("w-5 h-5 transition-colors", parcel.isPressed ? "text-yellow-500" : "text-gray-400 group-hover:text-yellow-500")} />
                          <span className={cn("text-[11px] font-black uppercase tracking-widest", parcel.isPressed ? "text-black" : "text-gray-400")}>Пресування (+$5)</span>
                        </div>
                        <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all", parcel.isPressed ? "border-black bg-black" : "border-gray-200")}>
                          {parcel.isPressed && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Tariffs Section */}
              <section className="bg-white rounded-2xl p-10 shadow-2xl">
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 bg-[#f8f9fa] rounded-xl flex items-center justify-center text-black border border-gray-100">
                    <Truck className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="font-display font-black text-3xl uppercase tracking-tight text-black">Спосіб доставки</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Оберіть оптимальний варіант</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {tariffs.map((tariff) => (
                    <button
                      key={tariff.id}
                      onClick={() => setSelectedTariffId(tariff.id)}
                      className={cn(
                        "relative p-8 rounded-2xl border-2 text-left transition-all duration-300 flex items-center justify-between group overflow-hidden",
                        selectedTariffId === tariff.id 
                          ? "border-[#003d2b] bg-black/5 ring-4 ring-black/5" 
                          : "border-gray-50 hover:border-gray-200 hover:bg-gray-50/50"
                      )}
                    >
                      <div className="flex items-center gap-8 relative z-10">
                        <div className={cn(
                          "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg",
                          selectedTariffId === tariff.id 
                            ? "bg-[#003d2b] text-white scale-110" 
                            : "bg-white text-gray-400 border border-gray-100 group-hover:text-[#003d2b]"
                        )}>
                          {getTariffIcon(tariff.iconName)}
                        </div>
                        <div>
                          <h3 className={cn(
                            "font-display font-black text-xl uppercase tracking-tight transition-colors",
                            selectedTariffId === tariff.id ? "text-[#003d2b]" : "text-gray-900"
                          )}>{tariff.name}</h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-black font-black uppercase tracking-widest">{tariff.deliveryDays}</span>
                            <span className="text-gray-300">|</span>
                            <span className="text-xs text-gray-400 font-bold">{tariff.description}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {activeTab === 'novaposhta' && (
            <section className="bg-white rounded-2xl p-10 shadow-2xl border-b-8 border-[#facc15]">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-white">
                  <Truck className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="font-display font-black text-3xl uppercase tracking-tight text-black">Нова Пошта</h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Доставка по Україні</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Вага (кг)</label>
                  <input 
                    type="number" 
                    value={npData.weight || ''} 
                    onChange={(e) => setNpData(p => ({ ...p, weight: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-6 py-4 font-black text-xl"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Напрямок</label>
                  <select 
                    value={npData.destination}
                    onChange={(e) => setNpData(p => ({ ...p, destination: e.target.value as any }))}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-6 py-4 font-black text-lg appearance-none"
                  >
                    <option value="city">По місту</option>
                    <option value="region">По області</option>
                    <option value="ukraine">По Україні</option>
                  </select>
                </div>
                <div className="sm:col-span-2 grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase">Д (см)</label>
                    <input type="number" value={npData.length || ''} onChange={(e) => setNpData(p => ({ ...p, length: parseFloat(e.target.value) || 0 }))} className="w-full bg-gray-50 border-2 border-gray-100 rounded-lg px-4 py-3 text-center font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase">Ш (см)</label>
                    <input type="number" value={npData.width || ''} onChange={(e) => setNpData(p => ({ ...p, width: parseFloat(e.target.value) || 0 }))} className="w-full bg-gray-50 border-2 border-gray-100 rounded-lg px-4 py-3 text-center font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase">В (см)</label>
                    <input type="number" value={npData.height || ''} onChange={(e) => setNpData(p => ({ ...p, height: parseFloat(e.target.value) || 0 }))} className="w-full bg-gray-50 border-2 border-gray-100 rounded-lg px-4 py-3 text-center font-bold" />
                  </div>
                </div>
                <div className="sm:col-span-2 space-y-4">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Оголошена вартість (грн)</label>
                  <input 
                    type="number" 
                    value={npData.declaredValue || ''} 
                    onChange={(e) => setNpData(p => ({ ...p, declaredValue: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-6 py-4 font-black text-xl"
                  />
                </div>
              </div>
            </section>
          )}

          {activeTab === 'transfer' && (
            <section className="bg-white rounded-2xl p-10 shadow-2xl border-b-8 border-[#facc15]">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-white">
                  <Globe className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="font-display font-black text-3xl uppercase tracking-tight text-black">Грошові перекази</h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">По Україні</p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Сума переказу (грн)</label>
                  <input 
                    type="number" 
                    value={transferData.amount || ''} 
                    onChange={(e) => setTransferData(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-6 py-5 font-black text-3xl text-black"
                    placeholder="0.00"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setTransferData(p => ({ ...p, method: 'card' }))}
                    className={cn(
                      "p-6 rounded-xl border-2 font-black uppercase tracking-widest text-xs transition-all",
                      transferData.method === 'card' ? "border-black bg-black text-white" : "border-gray-100 text-gray-400 hover:border-gray-200"
                    )}
                  >
                    На карту
                  </button>
                  <button 
                    onClick={() => setTransferData(p => ({ ...p, method: 'cash' }))}
                    className={cn(
                      "p-6 rounded-xl border-2 font-black uppercase tracking-widest text-xs transition-all",
                      transferData.method === 'cash' ? "border-black bg-black text-white" : "border-gray-100 text-gray-400 hover:border-gray-200"
                    )}
                  >
                    Готівка
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Density Guide */}
          <section className="bg-black rounded-2xl p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 -mb-32 -mr-32 rounded-full blur-3xl" />
            <div className="relative z-10">
              <h3 className="font-display font-black text-2xl uppercase mb-6 flex items-center gap-3">
                <Info className="w-6 h-6 text-[#facc15]" />
                Як розраховується щільність?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <div className="text-[#facc15] font-black text-3xl">01</div>
                  <p className="text-sm text-white/70 font-medium">Вимірюємо вагу вантажу в кілограмах (кг).</p>
                </div>
                <div className="space-y-2">
                  <div className="text-[#facc15] font-black text-3xl">02</div>
                  <p className="text-sm text-white/70 font-medium">Вимірюємо об'єм вантажу в кубічних метрах (м³).</p>
                </div>
                <div className="space-y-2">
                  <div className="text-[#facc15] font-black text-3xl">03</div>
                  <p className="text-sm text-white/70 font-medium">Ділимо вагу на об'єм. Отримуємо кг/м³.</p>
                </div>
              </div>
              <div className="mt-10 p-6 bg-white/5 rounded-xl border border-white/10 flex items-center gap-6">
                <div className="text-4xl font-black text-[#facc15] italic">!</div>
                <p className="text-sm font-medium leading-relaxed">
                  Чим вища щільність вашого вантажу, тим вигідніша ставка за кілограм. Для морської доставки це ключовий показник вартості.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-5">
          <div className="sticky top-32 space-y-10">
            
            {/* Summary Card */}
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-12 shadow-2xl relative overflow-hidden border-2 border-black"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-black -mr-20 -mt-20 rounded-full" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2 h-2 bg-[#facc15] rounded-full animate-pulse" />
                  <p className="text-gray-400 text-[11px] font-black uppercase tracking-[0.3em]">
                    {activeTab === 'international' ? 'Доставка з Китаю' : activeTab === 'novaposhta' ? 'Нова Пошта' : 'Переказ коштів'}
                  </p>
                </div>
                
                <div className="flex flex-col mb-12">
                  <span className="text-8xl font-display font-black tracking-tighter text-black leading-none">
                    {activeTab === 'international' 
                      ? `${internationalDetails.totalUah.toFixed(0)} грн` 
                      : activeTab === 'novaposhta' 
                        ? `${npDetails.total.toFixed(0)} грн`
                        : `${transferDetails.total.toFixed(0)} грн`
                    }
                  </span>
                  <span className="text-xl font-black text-black mt-2 uppercase tracking-widest">
                    {activeTab === 'international' 
                      ? `До сплати (UAH) / $${internationalDetails.total.toFixed(2)}` 
                      : 'До сплати (UAH)'}
                  </span>
                </div>

                <div className="space-y-6 pt-10 border-t border-gray-100">
                  {activeTab === 'international' && (
                    <>
                      <div className="flex justify-between items-center group">
                        <span className="text-gray-400 text-[11px] font-black uppercase tracking-widest group-hover:text-black transition-colors">Логістика</span>
                        <div className="text-right">
                          <div className="font-black text-2xl text-black">{internationalDetails.shippingCostUah.toFixed(0)} грн</div>
                          <div className="text-[10px] font-bold text-gray-400">${internationalDetails.shippingCost.toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center group">
                        <span className="text-gray-400 text-[11px] font-black uppercase tracking-widest group-hover:text-black transition-colors">Страхування</span>
                        <div className="text-right">
                          <div className="font-black text-2xl text-black">{internationalDetails.insuranceUah.toFixed(0)} грн</div>
                          <div className="text-[10px] font-bold text-gray-400">${internationalDetails.insurance.toFixed(2)}</div>
                        </div>
                      </div>
                      {(parcel.isFabric || parcel.isPressed || internationalDetails.packagingCost > 0 || internationalDetails.customsFee > 0 || internationalDetails.handlingFee > 0 || internationalDetails.fuelSurcharge > 0) && (
                        <div className="flex justify-between items-center group">
                          <span className="text-gray-400 text-[11px] font-black uppercase tracking-widest group-hover:text-black transition-colors">Дод. послуги та збори</span>
                          <div className="text-right">
                            <div className="font-black text-2xl text-black">{(internationalDetails.fabricSurchargeUah + internationalDetails.pressingCostUah + internationalDetails.packagingCostUah + internationalDetails.customsFeeUah + internationalDetails.handlingFeeUah + internationalDetails.fuelSurchargeUah).toFixed(0)} грн</div>
                            <div className="text-[10px] font-bold text-gray-400">${(internationalDetails.fabricSurcharge + internationalDetails.pressingCost + internationalDetails.packagingCost + internationalDetails.customsFee + internationalDetails.handlingFee + internationalDetails.fuelSurcharge).toFixed(2)}</div>
                          </div>
                        </div>
                      )}
                      {internationalDetails.localDelivery > 0 && (
                        <div className="flex justify-between items-center group">
                          <span className="text-gray-400 text-[11px] font-black uppercase tracking-widest group-hover:text-black transition-colors">Доставка по UA</span>
                          <div className="text-right">
                            <div className="font-black text-2xl text-black">{internationalDetails.localDeliveryUah.toFixed(0)} грн</div>
                            <div className="text-[10px] font-bold text-gray-400">${internationalDetails.localDelivery.toFixed(2)}</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {activeTab === 'novaposhta' && (
                    <>
                      <div className="flex justify-between items-center group">
                        <span className="text-gray-400 text-[11px] font-black uppercase tracking-widest group-hover:text-black transition-colors">Тариф</span>
                        <span className="font-black text-2xl text-black">{npDetails.basePrice.toFixed(0)} грн</span>
                      </div>
                      <div className="flex justify-between items-center group">
                        <span className="text-gray-400 text-[11px] font-black uppercase tracking-widest group-hover:text-black transition-colors">Страхування</span>
                        <span className="font-black text-2xl text-black">{npDetails.insurance.toFixed(0)} грн</span>
                      </div>
                    </>
                  )}
                  {activeTab === 'transfer' && (
                    <>
                      <div className="flex justify-between items-center group">
                        <span className="text-gray-400 text-[11px] font-black uppercase tracking-widest group-hover:text-black transition-colors">Сума</span>
                        <span className="font-black text-2xl text-black">{transferData.amount.toFixed(0)} грн</span>
                      </div>
                      <div className="flex justify-between items-center group">
                        <span className="text-gray-400 text-[11px] font-black uppercase tracking-widest group-hover:text-black transition-colors">Комісія</span>
                        <span className="font-black text-2xl text-black">{transferDetails.fee.toFixed(0)} грн</span>
                      </div>
                    </>
                  )}
                </div>

                <button 
                  onClick={() => setView('crm')}
                  className="w-full mt-8 bg-[#facc15] text-black font-black py-4 rounded-xl shadow-xl shadow-yellow-900/10 hover:bg-[#eab308] hover:translate-y-[-1px] active:translate-y-[0.5px] transition-all flex items-center justify-center gap-3 uppercase tracking-[0.15em] text-[11px]"
                >
                  Оформити заявку в CRM
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>

            {/* Details Card */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl border-l-8 border-black">
              <h3 className="font-display font-black text-gray-900 mb-6 uppercase tracking-tight flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-[#f8f9fa] rounded-lg flex items-center justify-center text-black">
                  <Info className="w-5 h-5" />
                </div>
                Параметри розрахунку
              </h3>
              <div className="space-y-8">
                {activeTab === 'international' && (
                  <>
                    <div className="flex justify-between items-end border-b border-gray-100 pb-6">
                      <div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Щільність</p>
                        <p className="text-4xl font-black text-black mt-1">{density.toFixed(0)} <span className="text-sm font-bold text-gray-400">кг/м³</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Об'єм</p>
                        <p className="text-2xl font-black text-yellow-500 mt-1">{finalVolumeM3.toFixed(3)} <span className="text-xs text-gray-400 font-bold">м³</span></p>
                      </div>
                    </div>

                    {selectedTariff.densityTiers && (
                      <div className="mt-6">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Тарифна сітка ({selectedTariff.name})</p>
                        <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="bg-gray-100 text-gray-400 uppercase font-black">
                                <th className="p-2 text-left">Щільність</th>
                                <th className="p-2 text-right">Ціна</th>
                              </tr>
                            </thead>
                            <tbody className="font-bold text-black">
                              {selectedTariff.densityTiers.map((tier, i) => (
                                <tr key={i} className={`border-t border-gray-100 ${density >= tier.min && (tier.max === null || density < tier.max) ? 'bg-yellow-50 text-yellow-700' : ''}`}>
                                  <td className="p-2">
                                    {tier.max ? `${tier.min}-${tier.max}` : `>${tier.min}`} кг/м³
                                  </td>
                                  <td className="p-2 text-right">
                                    ${tier.price}/{tier.unit === 'kg' ? 'кг' : 'м³'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      {selectedTariff.minWeight > 0 && (
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Мін. вага</p>
                          <p className="text-sm font-black text-black">{selectedTariff.minWeight} кг</p>
                        </div>
                      )}
                      {selectedTariff.minCost > 0 && (
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Мін. вартість</p>
                          <p className="text-sm font-black text-black">${selectedTariff.minCost}</p>
                        </div>
                      )}
                      {selectedTariff.insuranceRate > 0 && (
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Страховка</p>
                          <p className="text-sm font-black text-black">{selectedTariff.insuranceRate}%</p>
                        </div>
                      )}
                      {selectedTariff.localDeliveryPrice > 0 && (
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Доставка UA</p>
                          <p className="text-sm font-black text-black">${selectedTariff.localDeliveryPrice}/кг</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {activeTab === 'novaposhta' && (
                  <>
                    <div className="flex justify-between items-end border-b border-gray-100 pb-6">
                      <div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Розрахункова вага</p>
                        <p className="text-4xl font-black text-black mt-1">{npDetails.chargeableWeight.toFixed(1)} <span className="text-sm font-bold text-gray-400">кг</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Об'ємна вага</p>
                        <p className="text-2xl font-black text-yellow-500 mt-1">{npDetails.volumetricWeight.toFixed(1)} <span className="text-xs text-gray-400 font-bold">кг</span></p>
                      </div>
                    </div>
                  </>
                )}
                {activeTab === 'transfer' && (
                  <div className="bg-[#f8f9fa] p-6 rounded-xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] mb-4">Умови переказу</p>
                    <p className="text-sm text-gray-600 leading-relaxed font-medium">
                      Комісія за переказ {transferData.method === 'card' ? 'на карту' : 'готівкою'} складає 
                      <span className="text-yellow-600 font-black"> {transferData.method === 'card' ? '1% + 5 грн' : '2% + 20 грн'}</span>.
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
      </>
      ) : (
        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col lg:flex-row gap-10">
            {/* CRM Sidebar */}
            <aside className="w-full lg:w-64 space-y-4 no-print">
              {/* Role Switcher */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-black" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Роль:</span>
                </div>
                <select 
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as UserRole)}
                  className="text-xs font-black text-black bg-gray-50 px-3 py-1.5 rounded-lg border-none focus:ring-2 focus:ring-yellow-400 cursor-pointer outline-none"
                >
                  <option value="admin">Адміністратор</option>
                  <option value="manager">Менеджер</option>
                </select>
              </div>

              <div className="bg-white rounded-2xl p-3 shadow-xl border-b-4 border-black">
                <h2 className="text-base font-black text-black uppercase tracking-tight mb-3 flex items-center gap-2">
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  CRM FORSAGE CHINA
                </h2>
                <div className="space-y-0.5">
                  {crmModules
                    .filter(module => {
                      if (userRole === 'manager') {
                        return !['finance', 'analytics'].includes(module.id);
                      }
                      return true;
                    })
                    .map((module) => (
                      <button
                        key={module.id}
                        onClick={() => setCrmModule(module.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 p-2.5 rounded-xl font-bold text-[11px] transition-all text-left group",
                          crmModule === module.id 
                            ? "bg-black text-yellow-400 shadow-lg translate-x-1" 
                            : "text-gray-500 hover:bg-gray-50 hover:text-black"
                        )}
                      >
                      <module.icon className={cn(
                        "w-3.5 h-3.5",
                        crmModule === module.id ? "text-yellow-400" : "group-hover:text-yellow-400"
                      )} />
                      {module.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-black rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 -mr-12 -mt-12 rounded-full group-hover:scale-110 transition-transform" />
                <Search className="w-8 h-8 text-yellow-400 mb-3" />
                <h3 className="text-base font-black uppercase tracking-tight mb-1">Швидкий пошук</h3>
                <p className="text-white/60 text-[10px] font-medium mb-4 leading-relaxed">Введіть трек-номер для миттєвого пошуку товару в системі.</p>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Трек-номер..."
                    value={purchaseSearch}
                    onChange={(e) => {
                      setPurchaseSearch(e.target.value);
                      if (crmModule !== 'purchases') setCrmModule('purchases');
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-xs outline-none focus:bg-white/20 transition-all placeholder:text-white/30"
                  />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-yellow-400 rounded-lg flex items-center justify-center hover:bg-yellow-500 transition-colors">
                    <ArrowRight className="w-4 h-4 text-black" />
                  </button>
                </div>
              </div>
            </aside>

            {/* CRM Content Area */}
            <div className="flex-1">
              <motion.div
                key={crmModule}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-4 shadow-2xl border-t-8 border-yellow-400 min-h-[600px] relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gray-50 -mr-32 -mt-32 rounded-full opacity-50" />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 bg-[#f8f9fa] rounded-2xl flex items-center justify-center text-black shadow-inner">
                      {(() => {
                        const Icon = crmModules.find(m => m.id === crmModule)?.icon || LayoutDashboard;
                        return <Icon className="w-5 h-5" />;
                      })()}
                    </div>
                    <div>
                      <h1 className="text-xl font-black text-black uppercase tracking-tight">
                        {crmModules.find(m => m.id === crmModule)?.title}
                      </h1>
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-0.5">
                        {crmModules.find(m => m.id === crmModule)?.description}
                      </p>
                    </div>
                  </div>

                  {crmModule === 'dashboard' ? (
                    <div className="space-y-10">
                      {/* Dashboard Stats Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Package className="w-5 h-5 text-blue-500" />
                          </div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">В дорозі до Китаю</p>
                          <p className="text-2xl font-black text-black">{dashboardStats.inTransitToChina}</p>
                        </div>
                        
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Warehouse className="w-5 h-5 text-amber-500" />
                          </div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">На складі Китай</p>
                          <p className="text-2xl font-black text-black">{dashboardStats.atChinaWarehouse}</p>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Plane className="w-5 h-5 text-indigo-500" />
                          </div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">В дорозі до України</p>
                          <p className="text-2xl font-black text-black">{dashboardStats.inTransitToUA}</p>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Flag className="w-5 h-5 text-emerald-500" />
                          </div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">На складі Україна</p>
                          <p className="text-2xl font-black text-black">{dashboardStats.atUAWarehouse}</p>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex flex-wrap gap-3">
                        <button 
                          onClick={() => setShowAddPurchaseModal(true)}
                          className="flex-1 min-w-[180px] bg-yellow-400 text-black p-4 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-100"
                        >
                          <Plus className="w-4 h-4" />
                          Додати закупку
                        </button>
                        
                        <button 
                          onClick={() => setShowImportTracksModal(true)}
                          className="flex-1 min-w-[180px] bg-black text-white p-4 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-gray-900 transition-all shadow-lg shadow-gray-100"
                        >
                          <Package className="w-4 h-4" />
                          Імпорт треків
                        </button>

                        <button 
                          onClick={() => setShowCreateBatchModal(true)}
                          className="flex-1 min-w-[200px] bg-white border-2 border-black text-black p-6 rounded-3xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-gray-50 transition-all"
                        >
                          <Truck className="w-5 h-5" />
                          Створити партію
                        </button>
                      </div>

                      {/* Recent Activity Placeholder */}
                      <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
                        <h3 className="text-lg font-black text-black uppercase tracking-tight mb-6">Остання активність</h3>
                        <div className="space-y-4">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100">
                              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                                <Clock className="w-5 h-5 text-gray-300" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-bold text-black">Оновлено статус трек-номера TB123456789</p>
                                <p className="text-xs text-gray-400">2 години тому</p>
                              </div>
                              <div className="text-xs font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">
                                В дорозі
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : crmModule === 'purchases' ? (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[#f8f9fa] p-6 rounded-2xl border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Всього закупок</p>
                          <p className="text-3xl font-black text-black">{purchases.length}</p>
                        </div>
                        <div className="bg-[#f8f9fa] p-6 rounded-2xl border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Кількість товарів</p>
                          <p className="text-3xl font-black text-gray-400">
                            {purchases.reduce((acc, p) => acc + p.quantity, 0)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                          <div className="relative flex-1 lg:flex-none min-w-[200px]">
                            <input 
                              type="text" 
                              value={purchaseSearch}
                              onChange={(e) => setPurchaseSearch(e.target.value)}
                              placeholder="Пошук..." 
                              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-black transition-all"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          </div>
                          <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-black cursor-pointer"
                          >
                            <option value="all">Всі статуси</option>
                            <option value="pending">Очікується</option>
                            <option value="at_china_warehouse">На складі Китай</option>
                            <option value="shipped_to_ua">В дорозі</option>
                            <option value="arrived_ua">На складі Україна</option>
                            <option value="sold">Видано на магазин</option>
                          </select>
                          
                          <button 
                            onClick={() => {
                              const dataToExport = selectedPurchaseIds.length > 0 
                                ? purchases.filter(p => selectedPurchaseIds.includes(p.id))
                                : purchases;
                              exportToExcel(dataToExport, 'Purchases_Export');
                            }}
                            className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                          >
                            <Download className="w-4 h-4" />
                            Експорт Excel {selectedPurchaseIds.length > 0 ? `(${selectedPurchaseIds.length})` : ''}
                          </button>

                          <button 
                            onClick={() => {
                              const dataToExport = selectedPurchaseIds.length > 0 
                                ? purchases.filter(p => selectedPurchaseIds.includes(p.id))
                                : purchases;
                              exportToExcelWithPhotos(dataToExport, 'Purchases_With_Photos');
                            }}
                            className="bg-indigo-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-100"
                          >
                            <Download className="w-4 h-4" />
                            Excel з фото
                          </button>

                          <button 
                            onClick={() => {
                              setPurchaseForm({
                                platform: 'Taobao',
                                name: '',
                                link: '',
                                priceYuan: 0,
                                exchangeRate: cnyToUah,
                                quantity: 1,
                                trackNumber: '',
                                photo: '',
                                comment: '',
                                size: '',
                                width: 0,
                                height: 0,
                                length: 0,
                                dimUnit: 'cm',
                                weight: 0,
                                weightUnit: 'kg',
                                shippingCost: 0,
                                status: 'purchased'
                              });
                              setEditingPurchaseId(null);
                              setShowAddPurchaseModal(true);
                            }}
                            className="bg-[#facc15] text-black px-8 py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 hover:bg-[#eab308] transition-all shadow-lg shadow-yellow-100 whitespace-nowrap"
                          >
                            <Plus className="w-5 h-5" />
                            Нова закупка
                          </button>
                        </div>
                      </div>

                      {purchases.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="py-4 px-4 w-10">
                                  <button 
                                    onClick={() => {
                                      const filteredIds = purchases
                                        .filter(p => {
                                          const matchesSearch = p.name.toLowerCase().includes(purchaseSearch.toLowerCase()) || 
                                                               p.trackNumber.toLowerCase().includes(purchaseSearch.toLowerCase());
                                          const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
                                          return matchesSearch && matchesStatus;
                                        })
                                        .map(p => p.id);
                                      toggleSelectAll(filteredIds);
                                    }}
                                    className="text-gray-400 hover:text-black transition-colors"
                                  >
                                    {selectedPurchaseIds.length > 0 ? <CheckSquare className="w-5 h-5 text-black" /> : <Square className="w-5 h-5" />}
                                  </button>
                                </th>
                                <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Товар</th>
                                <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Платформа</th>
                                <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ціна (¥)</th>
                                <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">К-сть</th>
                                <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Разом (¥)</th>
                                <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Трек</th>
                                <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Дії</th>
                              </tr>
                            </thead>
                            <tbody>
                              {purchases
                                .filter(p => {
                                  const matchesSearch = p.name.toLowerCase().includes(purchaseSearch.toLowerCase()) || 
                                                       p.trackNumber.toLowerCase().includes(purchaseSearch.toLowerCase());
                                  const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
                                  return matchesSearch && matchesStatus;
                                })
                                .map((p) => (
                                  <tr key={p.id} className={clsx(
                                    "border-b border-gray-50 hover:bg-gray-50 transition-colors",
                                    selectedPurchaseIds.includes(p.id) && "bg-yellow-50/30"
                                  )}>
                                    <td className="py-4 px-4">
                                      <button 
                                        onClick={() => toggleSelectOne(p.id)}
                                        className="text-gray-400 hover:text-black transition-colors"
                                      >
                                        {selectedPurchaseIds.includes(p.id) ? <CheckSquare className="w-5 h-5 text-black" /> : <Square className="w-5 h-5" />}
                                      </button>
                                    </td>
                                    <td className="py-4 px-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                                          {p.photo ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-gray-300" />}
                                        </div>
                                        <div>
                                          <p className="text-sm font-bold text-black">{p.name}</p>
                                          <p className="text-[10px] text-gray-400 font-medium truncate max-w-[150px]">{p.link}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-4 px-4">
                                      <span className="text-xs font-black text-gray-500 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">
                                        {p.platform}
                                      </span>
                                    </td>
                                    <td className="py-4 px-4">
                                      <p className="text-sm font-bold text-black">{p.priceYuan} ¥</p>
                                      <p className="text-[10px] font-bold text-gray-400">{(p.priceYuan * p.exchangeRate).toFixed(0)} грн</p>
                                    </td>
                                    <td className="py-4 px-4 text-sm font-bold text-gray-600">{p.quantity}</td>
                                    <td className="py-4 px-4">
                                      <p className="text-sm font-black text-black">{(p.priceYuan * p.quantity).toFixed(2)} ¥</p>
                                      <p className="text-[10px] font-bold text-gray-400">{(p.priceYuan * p.quantity * p.exchangeRate).toFixed(0)} грн</p>
                                    </td>
                                    <td className="py-4 px-4">
                                      <button 
                                        onClick={() => copyToClipboard(p.trackNumber)}
                                        className="text-xs font-mono font-bold text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-1 group"
                                        title="Натисніть щоб скопіювати"
                                      >
                                        {p.trackNumber || '—'}
                                        <Layers className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </button>
                                    </td>
                                     <td className="py-4 px-4">
                                       <div className="flex items-center gap-2">
                                         <select 
                                           value={p.status}
                                           onChange={(e) => {
                                             const newStatus = e.target.value as any;
                                             setPurchases(purchases.map(item => 
                                               item.id === p.id ? { ...item, status: newStatus } : item
                                             ));
                                             addNotification(`Статус товару ${p.name} змінено на "${statusLabels[newStatus]}"`, 'success');
                                           }}
                                           className="text-[10px] font-black uppercase tracking-widest p-2 bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
                                         >
                                           {Object.entries(statusLabels).map(([val, label]) => (
                                             <option key={val} value={val}>{label}</option>
                                           ))}
                                         </select>
                                         <button 
                                           onClick={() => handleEditPurchase(p)}
                                           className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                                           title="Редагувати"
                                         >
                                           <Edit2 className="w-4 h-4" />
                                         </button>
                                         <button 
                                           onClick={() => handleDeletePurchase(p.id)}
                                           className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                           title="Видалити"
                                         >
                                           <Trash2 className="w-4 h-4" />
                                         </button>
                                       </div>
                                     </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-100 rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                            <ShoppingCart className="w-10 h-10 text-gray-200" />
                          </div>
                          <h3 className="text-xl font-black text-gray-300 uppercase tracking-tight mb-2">Закупок немає</h3>
                          <p className="text-gray-400 text-sm max-w-xs mx-auto">
                            Ви ще не додали жодної закупки. Натисніть кнопку "Нова закупка", щоб розпочати.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : crmModule === 'china_warehouse' ? (
                    <div className="space-y-8">
                      <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-black text-black uppercase tracking-tight">Товари на складі Китай</h2>
                        <div className="flex gap-4">
                          <div className="relative">
                            <input 
                              type="text" 
                              value={chinaWarehouseSearch}
                              onChange={(e) => setChinaWarehouseSearch(e.target.value)}
                              placeholder="Пошук за треком..." 
                              className="pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-black transition-all"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Трек номер</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Назва товару</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Платформа</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Кількість</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Статус</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Вага (кг)</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Дата прибуття</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Дії</th>
                            </tr>
                          </thead>
                          <tbody>
                            {purchases
                              .filter(p => (p.status === 'shipped_by_seller' || p.status === 'arrived_china' || p.status === 'at_china_warehouse') && (p.trackNumber.toLowerCase().includes(chinaWarehouseSearch.toLowerCase()) || p.name.toLowerCase().includes(chinaWarehouseSearch.toLowerCase())))
                              .map((p) => (
                                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                  <td className="py-4 px-4">
                                    <button 
                                      onClick={() => copyToClipboard(p.trackNumber)}
                                      className="text-xs font-mono font-black text-blue-600 bg-blue-50 px-2 py-1 rounded inline-flex items-center gap-2 hover:bg-blue-100 transition-all group/track"
                                      title="Копіювати трек-номер"
                                    >
                                      {p.trackNumber || '—'}
                                      <Layers className="w-3 h-3 opacity-0 group-hover/track:opacity-100 transition-opacity" />
                                    </button>
                                  </td>
                                  <td className="py-4 px-4">
                                    <p className="text-sm font-bold text-black">{p.name}</p>
                                  </td>
                                  <td className="py-4 px-4">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">
                                      {p.platform}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 text-sm font-bold text-gray-600">{p.quantity}</td>
                                  <td className="py-4 px-4">
                                    {(() => {
                                      const statusMap = {
                                        purchased: { label: '🛒 Куплено', color: 'bg-gray-100 text-gray-600' },
                                        shipped_by_seller: { label: '📦 Відправлено продавцем', color: 'bg-blue-50 text-blue-600' },
                                        arrived_china: { label: '🏬 Прибув на склад Китай', color: 'bg-amber-50 text-amber-600' },
                                        shipped_to_ua: { label: '✈️ Відправлено в Україну', color: 'bg-indigo-50 text-indigo-600' }
                                      };
                                      const s = statusMap[p.status] || statusMap.purchased;
                                      return (
                                        <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg", s.color)}>
                                          {s.label}
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td className="py-4 px-4 text-sm font-bold text-black">
                                    {p.weight ? `${p.weight} кг` : '—'}
                                  </td>
                                  <td className="py-4 px-4 text-xs font-bold text-gray-400">
                                    {p.arrivalDate || '—'}
                                  </td>
                                  <td className="py-4 px-4 text-right">
                                    <div className="flex justify-end gap-2">
                                      <button 
                                        onClick={() => handleEditPurchase(p)}
                                        className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                                        title="Редагувати"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={() => handleDeletePurchase(p.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                        title="Видалити"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : crmModule === 'consolidation' ? (
                    <div className="space-y-8">
                      <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-black text-black uppercase tracking-tight">Консолідація Китай</h2>
                        <button 
                          onClick={() => setShowCreateBatchModal(true)}
                          className="bg-[#facc15] text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 hover:bg-[#eab308] transition-all shadow-lg shadow-yellow-100"
                        >
                          <Truck className="w-5 h-5" />
                          Створити партію доставки
                        </button>
                      </div>

                      {batches.length > 0 ? (
                        <div className="grid grid-cols-1 gap-6">
                          {batches.map((batch) => (
                            <div key={batch.id} className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm hover:shadow-md transition-all">
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-14 h-14 rounded-2xl flex items-center justify-center",
                                    batch.status === 'arrived_ua' ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                                  )}>
                                    <Package className="w-7 h-7" />
                                  </div>
                                  <div>
                                    <h3 className="text-xl font-black text-black uppercase tracking-tight">{batch.name}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                      <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> {batch.shipmentDate}
                                      </span>
                                      <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> {batch.warehouse}
                                      </span>
                                      <span className="text-[10px] font-black uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded text-gray-500">
                                        {batch.deliveryType === 'air' ? '✈️ Авіа' : '🚢 Море'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4">
                                  {batch.status === 'shipped' && (
                                    <>
                                      <button 
                                        onClick={() => setShowCostModal({ show: true, batchId: batch.id })}
                                        className="bg-amber-50 text-amber-600 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-100 transition-all flex items-center gap-2"
                                      >
                                        <DollarSign className="w-4 h-4" />
                                        Внести вартість
                                      </button>
                                      <button 
                                        onClick={() => handleBatchArrived(batch.id)}
                                        className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-100 transition-all flex items-center gap-2"
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Партія прибула
                                      </button>
                                    </>
                                  )}
                                  <div className={cn(
                                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest",
                                    batch.status === 'arrived_ua' ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                                  )}>
                                    {batch.status === 'arrived_ua' ? '📥 Прибула в Україну' : '✈️ В дорозі'}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => handleEditBatch(batch)}
                                      className="p-2 text-gray-400 hover:text-black transition-colors"
                                      title="Редагувати партію"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteBatch(batch.id)}
                                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                      title="Видалити партію"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <div className="bg-gray-50 p-4 rounded-2xl">
                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Вага партії</p>
                                  <p className="text-lg font-black text-black">{batch.totalWeight ? `${batch.totalWeight} кг` : '—'}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-2xl">
                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Вартість доставки (грн)</p>
                                  <p className="text-lg font-black text-black">{batch.deliveryCost ? `${(batch.deliveryCost * usdToUah).toFixed(0)} грн` : '—'}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-2xl">
                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ціна за кг (грн)</p>
                                  <p className="text-lg font-black text-amber-600">{batch.pricePerKg ? `${(batch.pricePerKg * usdToUah).toFixed(0)} грн` : '—'}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-2xl">
                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Товарів</p>
                                  <p className="text-lg font-black text-gray-400">{batch.itemIds.length}</p>
                                </div>
                              </div>

                              <div className="border-t border-gray-50 pt-6">
                                <details className="group">
                                  <summary className="flex items-center justify-between cursor-pointer list-none">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-open:text-black transition-colors">Список товарів у партії</span>
                                    <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
                                  </summary>
                                  <div className="mt-4 space-y-3">
                                    {purchases.filter(p => batch.itemIds.includes(p.id)).map(p => (
                                      <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-[10px] font-mono font-bold text-blue-500 shadow-sm">
                                            {p.trackNumber.slice(-4)}
                                          </div>
                                          <div>
                                            <p className="text-xs font-bold text-black">{p.name}</p>
                                            <p className="text-[10px] text-gray-400">{p.weight || 0} кг</p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-xs font-black text-black">
                                            {p.deliveryCostPerItem ? `${(p.deliveryCostPerItem * usdToUah).toFixed(0)} грн` : '—'}
                                          </p>
                                          <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">доставка</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-100 rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                            <Truck className="w-10 h-10 text-gray-200" />
                          </div>
                          <h3 className="text-xl font-black text-gray-300 uppercase tracking-tight mb-2">Партій не створено</h3>
                          <p className="text-gray-400 text-sm max-w-xs mx-auto">
                            Ви ще не створили жодної партії доставки. Натисніть кнопку "Створити партію доставки", щоб розпочати консолідацію.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : crmModule === 'ua_warehouse' ? (
                    <div className="space-y-8">
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                        <h2 className="text-2xl font-black text-black uppercase tracking-tight">Товари на складі Україна</h2>
                        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                          <div className="relative flex-1 lg:flex-none min-w-[200px]">
                            <input 
                              type="text" 
                              value={uaWarehouseSearch}
                              onChange={(e) => setUaWarehouseSearch(e.target.value)}
                              placeholder="Пошук за треком..." 
                              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-black transition-all"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          </div>
                          
                          <input 
                            type="date" 
                            value={uaWarehouseDateFilter}
                            onChange={(e) => setUaWarehouseDateFilter(e.target.value)}
                            className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-black cursor-pointer"
                          />

                          <select 
                            value={uaWarehouseBatchFilter}
                            onChange={(e) => setUaWarehouseBatchFilter(e.target.value)}
                            className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-black cursor-pointer"
                          >
                            <option value="">Всі партії</option>
                            {Array.from(new Set(purchases.filter(p => p.batchId).map(p => p.batchId))).map(batchId => (
                              <option key={batchId} value={batchId}>{batchId}</option>
                            ))}
                          </select>

                          <button 
                            onClick={() => {
                              const filtered = purchases.filter(p => {
                                const matchesStatus = p.status === 'arrived_ua';
                                const matchesSearch = p.trackNumber.toLowerCase().includes(uaWarehouseSearch.toLowerCase()) || 
                                                     p.name.toLowerCase().includes(uaWarehouseSearch.toLowerCase());
                                const matchesDate = !uaWarehouseDateFilter || (p.arrivalDate && p.arrivalDate.includes(uaWarehouseDateFilter));
                                const matchesBatch = !uaWarehouseBatchFilter || p.batchId === uaWarehouseBatchFilter;
                                return matchesStatus && matchesSearch && matchesDate && matchesBatch;
                              });
                              
                              const dataToExport = selectedPurchaseIds.length > 0 
                                ? filtered.filter(p => selectedPurchaseIds.includes(p.id))
                                : filtered;
                              exportToExcel(dataToExport, 'UA_Warehouse_Export');
                            }}
                            className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                          >
                            <Download className="w-4 h-4" />
                            Експорт Excel {selectedPurchaseIds.length > 0 ? `(${selectedPurchaseIds.length})` : ''}
                          </button>

                          <button 
                            onClick={() => {
                              const filtered = purchases.filter(p => {
                                const matchesStatus = p.status === 'arrived_ua';
                                const matchesSearch = p.trackNumber.toLowerCase().includes(uaWarehouseSearch.toLowerCase()) || 
                                                     p.name.toLowerCase().includes(uaWarehouseSearch.toLowerCase());
                                const matchesDate = !uaWarehouseDateFilter || (p.arrivalDate && p.arrivalDate.includes(uaWarehouseDateFilter));
                                const matchesBatch = !uaWarehouseBatchFilter || p.batchId === uaWarehouseBatchFilter;
                                return matchesStatus && matchesSearch && matchesDate && matchesBatch;
                              });
                              
                              const dataToExport = selectedPurchaseIds.length > 0 
                                ? filtered.filter(p => selectedPurchaseIds.includes(p.id))
                                : filtered;
                              exportToExcelWithPhotos(dataToExport, 'UA_Warehouse_With_Photos');
                            }}
                            className="bg-indigo-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-100"
                          >
                            <Download className="w-4 h-4" />
                            Excel з фото
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="py-4 px-4 w-10">
                                <button 
                                  onClick={() => {
                                    const filteredIds = purchases
                                      .filter(p => {
                                        const matchesStatus = p.status === 'arrived_ua';
                                        const matchesSearch = p.trackNumber.toLowerCase().includes(uaWarehouseSearch.toLowerCase()) || 
                                                             p.name.toLowerCase().includes(uaWarehouseSearch.toLowerCase());
                                        const matchesDate = !uaWarehouseDateFilter || (p.arrivalDate && p.arrivalDate.includes(uaWarehouseDateFilter));
                                        const matchesBatch = !uaWarehouseBatchFilter || p.batchId === uaWarehouseBatchFilter;
                                        return matchesStatus && matchesSearch && matchesDate && matchesBatch;
                                      })
                                      .map(p => p.id);
                                    toggleSelectAll(filteredIds);
                                  }}
                                  className="text-gray-400 hover:text-black transition-colors"
                                >
                                  {selectedPurchaseIds.length > 0 ? <CheckSquare className="w-5 h-5 text-black" /> : <Square className="w-5 h-5" />}
                                </button>
                              </th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Назва</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Кількість</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Собівартість (грн)</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Доставка (грн)</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Повна собівартість (грн)</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Статус</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Дії</th>
                            </tr>
                          </thead>
                          <tbody>
                            {purchases
                              .filter(p => {
                                const matchesStatus = p.status === 'arrived_ua';
                                const matchesSearch = p.trackNumber.toLowerCase().includes(uaWarehouseSearch.toLowerCase()) || 
                                                     p.name.toLowerCase().includes(uaWarehouseSearch.toLowerCase());
                                const matchesDate = !uaWarehouseDateFilter || (p.arrivalDate && p.arrivalDate.includes(uaWarehouseDateFilter));
                                const matchesBatch = !uaWarehouseBatchFilter || p.batchId === uaWarehouseBatchFilter;
                                return matchesStatus && matchesSearch && matchesDate && matchesBatch;
                              })
                              .map((p) => (
                                <tr key={p.id} className={clsx(
                                  "border-b border-gray-50 hover:bg-gray-50 transition-colors",
                                  selectedPurchaseIds.includes(p.id) && "bg-yellow-50/30"
                                )}>
                                  <td className="py-4 px-4">
                                    <button 
                                      onClick={() => toggleSelectOne(p.id)}
                                      className="text-gray-400 hover:text-black transition-colors"
                                    >
                                      {selectedPurchaseIds.includes(p.id) ? <CheckSquare className="w-5 h-5 text-black" /> : <Square className="w-5 h-5" />}
                                    </button>
                                  </td>
                                  <td className="py-4 px-4">
                                    <p className="text-sm font-bold text-black">{p.name}</p>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{p.trackNumber}</p>
                                  </td>
                                  <td className="py-4 px-4 text-sm font-bold text-gray-600 text-center">{p.quantity}</td>
                                  <td className="py-4 px-4 text-sm font-bold text-gray-600">
                                    {(p.priceYuan * p.exchangeRate * p.quantity).toFixed(0)} грн
                                  </td>
                                  <td className="py-4 px-4 text-sm font-bold text-amber-600">
                                    {((p.deliveryCostPerItem || 0) * usdToUah + (p.shippingCost || 0) * usdToUah).toFixed(0)} грн
                                  </td>
                                  <td className="py-4 px-4">
                                    <p className="text-sm font-black text-black">
                                      {(p.priceYuan * p.exchangeRate * p.quantity + (p.deliveryCostPerItem || 0) * usdToUah + (p.shippingCost || 0) * usdToUah).toFixed(0)} грн
                                    </p>
                                  </td>
                                  <td className="py-4 px-4">
                                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-100 text-emerald-500">
                                      На складі Україна
                                    </span>
                                  </td>
                                  <td className="py-4 px-4">
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={() => handleEditPurchase(p)}
                                        className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                                        title="Редагувати"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={() => handleDeletePurchase(p.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                        title="Видалити"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {purchases.filter(p => p.status === 'arrived_ua').length === 0 && (
                          <div className="py-20 text-center">
                            <p className="text-gray-400 font-bold">На складі в Україні поки немає товарів</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : crmModule === 'issue_to_store' ? (
                    <div className="space-y-8">
                      <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-black text-black uppercase tracking-tight">Видача на магазин</h2>
                        <div className="flex gap-4">
                          <div className="relative">
                            <input 
                              type="text" 
                              value={salesSearch}
                              onChange={(e) => setSalesSearch(e.target.value)}
                              placeholder="Пошук за назвою..." 
                              className="pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-black transition-all"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Дата продажу</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Товар</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Кількість</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Собівартість (грн)</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Статус</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Дії</th>
                            </tr>
                          </thead>
                          <tbody>
                            {purchases
                              .filter(p => p.status === 'sold' && (p.name.toLowerCase().includes(salesSearch.toLowerCase()) || p.trackNumber.toLowerCase().includes(salesSearch.toLowerCase())))
                              .map((p) => {
                                const costPrice = (p.priceYuan * p.quantity) / p.exchangeRate;
                                const chinaDelivery = p.deliveryCostPerItem || 0;
                                const uaDelivery = p.ukraineDeliveryCost || 0;
                                const npDelivery = p.novaPoshtaCost || 0;
                                const totalCost = costPrice + chinaDelivery + uaDelivery + npDelivery;
                                // const profit = (p.sellingPrice || 0) - totalCost;

                                return (
                                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                    <td className="py-4 px-4 text-sm font-bold text-gray-600">
                                      {p.soldDate ? new Date(p.soldDate).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="py-4 px-4">
                                      <p className="text-sm font-bold text-black">{p.name}</p>
                                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{p.trackNumber}</p>
                                    </td>
                                    <td className="py-4 px-4 text-sm font-bold text-gray-600 text-center">{p.quantity}</td>
                                    <td className="py-4 px-4 text-sm font-black text-black">
                                      {(p.priceYuan * p.exchangeRate * p.quantity + (p.deliveryCostPerItem || 0) * usdToUah + (p.shippingCost || 0) * usdToUah + (p.ukraineDeliveryCost || 0) + (p.novaPoshtaCost || 0)).toFixed(0)} грн
                                    </td>
                                    <td className="py-4 px-4">
                                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-50 text-emerald-600">
                                        Видано
                                      </span>
                                    </td>
                                    <td className="py-4 px-4 text-right">
                                      <div className="flex justify-end gap-2">
                                        <button 
                                          onClick={() => handleEditSale(p)}
                                          className="p-2 text-gray-400 hover:text-black transition-colors"
                                          title="Редагувати продаж"
                                        >
                                          <FileText className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteSale(p.id)}
                                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                          title="Видалити продаж"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                        {purchases.filter(p => p.status === 'sold').length === 0 && (
                          <div className="py-20 text-center">
                            <p className="text-gray-400 font-bold">Продажів поки немає</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : crmModule === 'finance' ? (
                    <div className="space-y-8">
                      <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-black text-black uppercase tracking-tight">Фінансовий облік</h2>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Дата</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Товар</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Собівартість (грн)</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Доставка (грн)</th>
                              <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Разом (грн)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {purchases.map((p) => {
                              const costPriceUah = p.priceYuan * p.exchangeRate * p.quantity;
                              const chinaDeliveryUah = (p.deliveryCostPerItem || 0) * usdToUah * p.quantity;
                              return (
                                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                  <td className="py-4 px-4 text-sm font-bold text-gray-600">
                                    {new Date(p.createdAt).toLocaleDateString()}
                                  </td>
                                  <td className="py-4 px-4">
                                    <p className="text-sm font-bold text-black">{p.name}</p>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{p.trackNumber}</p>
                                  </td>
                                  <td className="py-4 px-4 text-sm font-bold text-gray-600">
                                    {costPriceUah.toFixed(0)} грн
                                  </td>
                                  <td className="py-4 px-4 text-sm font-bold text-amber-600">
                                    {chinaDeliveryUah.toFixed(0)} грн
                                  </td>
                                  <td className="py-4 px-4 text-sm font-black text-black">
                                    {(costPriceUah + chinaDeliveryUah).toFixed(0)} грн
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : crmModule === 'analytics' ? (
                    <div className="space-y-8">
                      <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-black text-black uppercase tracking-tight">Аналітика та звіти</h2>
                        {userRole === 'admin' && (
                          <button 
                            onClick={() => {
                              const data = JSON.stringify({ purchases, batches }, null, 2);
                              const blob = new Blob([data], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `crm_backup_${new Date().toISOString().split('T')[0]}.json`;
                              a.click();
                              addNotification('Резервну копію створено', 'success');
                            }}
                            className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-900 transition-all shadow-lg"
                          >
                            <Download className="w-4 h-4" />
                            Завантажити бекап
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Витрати на доставку (Китай, грн)</p>
                          <p className="text-3xl font-black text-black">
                            {(purchases.reduce((acc, p) => acc + (p.deliveryCostPerItem || 0), 0) * usdToUah).toFixed(0)} грн
                          </p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Загальний прибуток (грн)</p>
                          <p className="text-3xl font-black text-emerald-500">
                            {purchases
                              .filter(p => p.status === 'sold')
                              .reduce((acc, p) => {
                                const costPriceUah = p.priceYuan * p.exchangeRate * p.quantity;
                                const chinaDeliveryUah = (p.deliveryCostPerItem || 0) * usdToUah * p.quantity;
                                const uaDeliveryUah = (p.ukraineDeliveryCost || 0);
                                const npDeliveryUah = (p.novaPoshtaCost || 0);
                                const totalCostUah = costPriceUah + chinaDeliveryUah + uaDeliveryUah + npDeliveryUah;
                                const sellingPriceUah = p.sellingPrice || 0;
                                return acc + (sellingPriceUah - totalCostUah);
                              }, 0).toFixed(0)} грн
                          </p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Кількість продажів</p>
                          <p className="text-3xl font-black text-black">
                            {purchases.filter(p => p.status === 'sold').length}
                          </p>
                        </div>
                      </div>

                      {/* Simple Chart Placeholder */}
                      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-80 flex items-center justify-center">
                        <div className="text-center">
                          <BarChart3 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Графік прибутковості (в розробці)</p>
                        </div>
                      </div>
                    </div>
                  ) : crmModule === 'price_list' ? (
                    <div id="price-list-container" className="space-y-8 p-8 bg-white border-2 border-gray-100 rounded-[40px]">
                      {/* PDF Header - Only visible in print/PDF */}
                      <div className="hidden print:block mb-10 border-b-4 border-black pb-8">
                        <div className="flex justify-between items-end">
                          <div>
                            <h1 className="text-5xl font-black text-black uppercase tracking-tighter mb-2">ПРАЙС-ЛИСТ</h1>
                            <p className="text-xl font-bold text-black uppercase tracking-widest">FORSAGE CHINA DELIVERY</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">Дата формування</p>
                            <p className="text-2xl font-black text-black">{new Date().toLocaleDateString('uk-UA')}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                        <div>
                          <h2 className="text-2xl font-black text-black uppercase tracking-tight">Формування прайс-листа</h2>
                          <p className="text-gray-500 text-sm font-bold">Товари на складі в Україні з розрахунком повної вартості</p>
                        </div>
                        <div className="flex flex-col gap-4 no-print">
                          <div className="flex flex-wrap items-center gap-4">
                            <input 
                              type="date" 
                              value={priceListDateFilter}
                              onChange={(e) => setPriceListDateFilter(e.target.value)}
                              className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-black cursor-pointer"
                            />

                            <select 
                              value={priceListBatchFilter}
                              onChange={(e) => setPriceListBatchFilter(e.target.value)}
                              className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-black cursor-pointer"
                            >
                              <option value="">Всі партії</option>
                              {Array.from(new Set(purchases.filter(p => p.batchId).map(p => p.batchId))).map(batchId => (
                                <option key={batchId} value={batchId}>{batchId}</option>
                              ))}
                            </select>

                            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Націнка (%)</label>
                              <input 
                                type="number" 
                                value={priceListMargin}
                                onChange={(e) => setPriceListMargin(parseInt(e.target.value) || 0)}
                                className="w-20 p-2 bg-gray-50 rounded-xl border border-gray-100 font-black text-black text-center focus:outline-none"
                              />
                            </div>
                            <div className="flex gap-2">
                              {priceListMarginPresets.map(preset => (
                                <button
                                  key={preset}
                                  onClick={() => setPriceListMargin(preset)}
                                  className={cn(
                                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    priceListMargin === preset 
                                      ? "bg-black text-white shadow-lg shadow-gray-100" 
                                      : "bg-white border border-gray-100 text-gray-400 hover:bg-gray-50"
                                  )}
                                >
                                  {preset}%
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Курс CNY/UAH</label>
                              <input 
                                type="number" 
                                value={cnyToUah}
                                onChange={(e) => setCnyToUah(parseFloat(e.target.value) || 0)}
                                className="w-20 p-2 bg-gray-50 rounded-xl border border-gray-100 font-black text-black text-center focus:outline-none"
                              />
                            </div>
                            <button 
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border",
                                showStorePreview ? "bg-black text-white border-black" : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                              )}
                            >
                              <LayoutGrid className="w-3 h-3" />
                              {showStorePreview ? 'Адмін вид' : 'Вид магазину'}
                            </button>
                            <div className="flex bg-gray-100 p-1 rounded-xl no-print">
                              <button 
                                onClick={() => setPriceListView('grid')}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                  priceListView === 'grid' ? "bg-black text-white shadow-md" : "text-gray-400 hover:text-gray-600"
                                )}
                              >
                                <LayoutGrid className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => setPriceListView('table')}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                  priceListView === 'table' ? "bg-black text-white shadow-md" : "text-gray-400 hover:text-gray-600"
                                )}
                              >
                                <List className="w-3 h-3" />
                              </button>
                            </div>
                            <button 
                              onClick={() => {
                                const filtered = purchases.filter(p => {
                                  const matchesStatus = p.status === 'arrived_ua' || p.status === 'sold';
                                  const matchesDate = !priceListDateFilter || (p.arrivalDate && p.arrivalDate.includes(priceListDateFilter)) || (p.createdAt && p.createdAt.includes(priceListDateFilter));
                                  const matchesBatch = !priceListBatchFilter || p.batchId === priceListBatchFilter;
                                  return matchesStatus && matchesDate && matchesBatch;
                                });
                                exportToExcel(filtered, 'Price_List_Export');
                              }}
                              className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                            >
                              <Download className="w-3 h-3" />
                              Експорт Excel
                            </button>
                            <button 
                              onClick={() => {
                                const filtered = purchases.filter(p => {
                                  const matchesStatus = p.status === 'arrived_ua' || p.status === 'sold';
                                  const matchesDate = !priceListDateFilter || (p.arrivalDate && p.arrivalDate.includes(priceListDateFilter)) || (p.createdAt && p.createdAt.includes(priceListDateFilter));
                                  const matchesBatch = !priceListBatchFilter || p.batchId === priceListBatchFilter;
                                  return matchesStatus && matchesDate && matchesBatch;
                                });
                                exportToExcelWithPhotos(filtered, 'Price_List_With_Photos');
                              }}
                              className="bg-indigo-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                            >
                              <Download className="w-3 h-3" />
                              Excel з фото
                            </button>
                            <button 
                              onClick={handleExportPDF}
                              disabled={isExportingPDF}
                              className={cn(
                                "bg-yellow-400 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-100 flex items-center gap-2",
                                isExportingPDF && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {isExportingPDF ? (
                                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Download className="w-3 h-3" />
                              )}
                              {isExportingPDF ? 'Генерація...' : 'Зберегти як PDF'}
                            </button>
                            <button 
                              onClick={() => window.print()}
                              className="bg-gray-800 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-gray-100 flex items-center gap-2 no-print"
                            >
                              <Printer className="w-3 h-3" />
                              Друк
                            </button>
                          </div>
                          {isIframe && (
                            <p className="text-[10px] text-amber-600 font-bold text-right no-print">
                              Порада: Якщо друк не працює, відкрийте додаток у новій вкладці
                            </p>
                          )}
                        </div>
                      </div>

                      {priceListView === 'grid' ? (
                        <div className={cn(
                          "grid gap-6 p-4 bg-white",
                          showStorePreview ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                        )}>
                          {purchases
                            .filter(p => {
                              const matchesStatus = p.status === 'arrived_ua' || p.status === 'sold';
                              const matchesDate = !priceListDateFilter || (p.arrivalDate && p.arrivalDate.includes(priceListDateFilter)) || (p.createdAt && p.createdAt.includes(priceListDateFilter));
                              const matchesBatch = !priceListBatchFilter || p.batchId === priceListBatchFilter;
                              return matchesStatus && matchesDate && matchesBatch;
                            })
                            .map(p => {
                              const costPriceYuan = p.priceYuan * p.quantity;
                              const costPriceUah = costPriceYuan * p.exchangeRate;
                              const deliveryChinaUah = (p.deliveryCostPerItem || 0) * usdToUah; 
                              const deliveryIntUah = (p.shippingCost || 0) * usdToUah; 
                              const deliveryUAUah = (p.ukraineDeliveryCost || 0); 
                              const deliveryNPUah = (p.novaPoshtaCost || 0); 
                              
                              const totalCostUah = costPriceUah + deliveryChinaUah + deliveryIntUah + deliveryUAUah + deliveryNPUah;
                              const sellingPriceUah = p.markup ? (p.sellingPrice || totalCostUah) : (totalCostUah * (1 + priceListMargin / 100));
                              const sellingPriceYuan = sellingPriceUah / p.exchangeRate;

                              const dimString = p.width ? `${p.width}x${p.height}x${p.length} ${p.dimUnit}` : p.size || '-';
                              const weightString = p.weight ? `${p.weight} ${p.weightUnit}` : '-';

                              return (
                                <motion.div 
                                  key={p.id}
                                  layout
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-100 flex flex-col group hover:border-black transition-all break-inside-avoid print:border-2 print:border-gray-200 print:shadow-none"
                                >
                                  <div className="h-64 relative overflow-hidden bg-gray-50 border-b border-gray-50 print:border-gray-200">
                                    {p.photo ? (
                                      <img src={p.photo} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Package className="w-12 h-12 text-gray-200" />
                                      </div>
                                    )}
                                      <div className="absolute top-4 left-4 no-print">
                                        <span className="bg-white/90 backdrop-blur-sm text-black px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                                          {p.platform}
                                        </span>
                                      </div>
                                    {p.markup && (
                                      <div className="absolute top-4 right-4">
                                        <span className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg">
                                          Націнка
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-6 flex-1 flex flex-col">
                                      <div className="flex justify-between items-start gap-4 mb-4">
                                        <h4 className="text-lg font-black text-black line-clamp-2 leading-tight flex-1">{p.name}</h4>
                                        <div className="text-right">
                                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Трек</p>
                                          <p className="text-xs font-black text-black">{p.trackNumber}</p>
                                        </div>
                                      </div>
                                    
                                    {p.comment && (
                                      <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100 print:bg-white print:border-gray-200">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Опис / Коментар</p>
                                        <p className="text-xs text-gray-600 font-medium leading-relaxed">{p.comment}</p>
                                      </div>
                                    )}

                                    <div className="space-y-3 mb-6 flex-1">
                                        <div className="flex justify-between items-center text-xs no-print">
                                          <span className="text-gray-400 font-bold uppercase tracking-wider">Собівартість (товар)</span>
                                          <span className="font-black text-black">{costPriceYuan.toFixed(2)} ¥ ({costPriceUah.toFixed(0)} грн)</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs no-print">
                                          <span className="text-gray-400 font-bold uppercase tracking-wider">Доставка (всього)</span>
                                          <div className="text-right">
                                            <div className="font-black text-black">{(deliveryChinaUah + deliveryIntUah + deliveryUAUah + deliveryNPUah).toFixed(0)} грн</div>
                                          </div>
                                        </div>
                                      <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-gray-400 font-bold uppercase tracking-wider">Вага / Розмір</span>
                                        <span className="font-black text-gray-600">{weightString} / {dimString}</span>
                                      </div>
                                      <div className="h-px bg-gray-100 my-2 no-print" />
                                        <div className="flex justify-between items-center no-print">
                                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Повна собівартість</span>
                                          <div className="text-right">
                                            <div className="text-xl font-black text-black">{totalCostUah.toFixed(0)} грн</div>
                                            <div className="text-[10px] font-bold text-gray-400">{(totalCostUah / p.exchangeRate).toFixed(2)} ¥</div>
                                          </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-6 border-t border-gray-100">
                                      <div className="flex justify-between items-end">
                                          <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Роздрібна ціна</p>
                                            <div className="flex items-baseline gap-2">
                                              <span className="text-3xl font-black text-black">{sellingPriceUah.toFixed(0)}</span>
                                              <span className="text-sm font-black text-black">грн</span>
                                            </div>
                                            <p className="text-[10px] font-bold text-gray-400 mt-1 no-print">{sellingPriceYuan.toFixed(2)} ¥</p>
                                          </div>
                                        <div className="flex flex-col items-end gap-2 no-print">
                                          <span className={cn(
                                            "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                            p.markup ? "bg-emerald-50 text-emerald-700" : "bg-green-50 text-green-700"
                                          )}>
                                            {p.markup ? 'Фіксована ціна' : `+${priceListMargin}% маржа`}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-200 m-4 print:m-0 print:shadow-none print:border-2 print:border-gray-300">
                          <table className="w-full text-left border-collapse border-spacing-0">
                            <thead className="bg-black text-white print:bg-gray-100 print:text-black">
                              <tr>
                                <th className="py-3 px-4 text-[9px] font-black uppercase tracking-widest border border-white/10 print:border-gray-300">Фото</th>
                                <th className="py-3 px-4 text-[9px] font-black uppercase tracking-widest border border-white/10 print:border-gray-300">Назва / Опис</th>
                                <th className="py-3 px-4 text-[9px] font-black uppercase tracking-widest border border-white/10 print:border-gray-300">Трек / Платформа</th>
                                <th className="py-3 px-4 text-[9px] font-black uppercase tracking-widest border border-white/10 print:border-gray-300">Вага</th>
                                <th className="py-3 px-4 text-[9px] font-black uppercase tracking-widest border border-white/10 print:border-gray-300">Розмір</th>
                                <th className="py-3 px-4 text-[9px] font-black uppercase tracking-widest border border-white/10 print:border-gray-300">Доставка</th>
                                <th className="py-3 px-4 text-[9px] font-black uppercase tracking-widest border border-white/10 print:border-gray-300">Собівартість</th>
                                <th className="py-3 px-4 text-[9px] font-black uppercase tracking-widest border border-white/10 print:border-gray-300 text-right">Ціна (грн)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {purchases
                                .filter(p => {
                                  const matchesStatus = p.status === 'arrived_ua' || p.status === 'sold';
                                  const matchesDate = !priceListDateFilter || (p.arrivalDate && p.arrivalDate.includes(priceListDateFilter)) || (p.createdAt && p.createdAt.includes(priceListDateFilter));
                                  const matchesBatch = !priceListBatchFilter || p.batchId === priceListBatchFilter;
                                  return matchesStatus && matchesDate && matchesBatch;
                                })
                                .map(p => {
                                  const costPriceYuan = p.priceYuan * p.quantity;
                                  const costPriceUah = costPriceYuan * p.exchangeRate;
                                  const deliveryChinaUah = (p.deliveryCostPerItem || 0) * usdToUah; 
                                  const deliveryIntUah = (p.shippingCost || 0) * usdToUah; 
                                  const deliveryUAUah = (p.ukraineDeliveryCost || 0); 
                                  const deliveryNPUah = (p.novaPoshtaCost || 0); 
                                  
                                  const totalCostUah = costPriceUah + deliveryChinaUah + deliveryIntUah + deliveryUAUah + deliveryNPUah;
                                  const sellingPriceUah = p.markup ? (p.sellingPrice || totalCostUah) : (totalCostUah * (1 + priceListMargin / 100));

                                  const dimString = p.width ? `${p.width}x${p.height}x${p.length} ${p.dimUnit}` : p.size || '-';
                                  const weightString = p.weight ? `${p.weight} ${p.weightUnit}` : '-';

                                  return (
                                    <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors group print:border-gray-300">
                                      <td className="py-3 px-4 align-top border border-gray-100 print:border-gray-300">
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                                          {p.photo ? (
                                            <img src={p.photo} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                              <Package className="w-4 h-4 text-gray-200" />
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 align-top border border-gray-100 print:border-gray-300">
                                        <p className="text-[11px] font-black text-black mb-0.5">{p.name}</p>
                                        {p.comment && (
                                          <p className="text-[9px] text-gray-500 font-medium leading-tight max-w-[150px]">{p.comment}</p>
                                        )}
                                      </td>
                                      <td className="py-3 px-4 align-top border border-gray-100 print:border-gray-300">
                                        <p className="text-[9px] text-gray-600 font-bold">{p.trackNumber}</p>
                                        <p className="text-[8px] text-gray-400 uppercase tracking-widest">{p.platform}</p>
                                      </td>
                                      <td className="py-3 px-4 align-top border border-gray-100 print:border-gray-300">
                                        <p className="text-[10px] font-black text-black">{weightString}</p>
                                      </td>
                                      <td className="py-3 px-4 align-top border border-gray-100 print:border-gray-300">
                                        <p className="text-[10px] font-black text-black">{dimString}</p>
                                      </td>
                                      <td className="py-3 px-4 align-top border border-gray-100 print:border-gray-300">
                                        <p className="text-[10px] font-black text-black">{(deliveryChinaUah + deliveryIntUah + deliveryUAUah + deliveryNPUah).toFixed(0)} грн</p>
                                      </td>
                                      <td className="py-3 px-4 align-top border border-gray-100 print:border-gray-300">
                                        <p className="text-[10px] font-black text-black">{totalCostUah.toFixed(0)} грн</p>
                                        <p className="text-[8px] text-gray-400 font-bold">{(totalCostUah / p.exchangeRate).toFixed(2)} ¥</p>
                                      </td>
                                      <td className="py-3 px-4 align-top border border-gray-100 print:border-gray-300 text-right">
                                        <p className="text-sm font-black text-black">{sellingPriceUah.toFixed(0)} грн</p>
                                        <p className="text-[9px] text-gray-400 font-bold">{(sellingPriceUah / p.exchangeRate).toFixed(2)} ¥</p>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      
                      {purchases.filter(p => p.status === 'arrived_ua' || p.status === 'sold').length === 0 && (
                        <div className="bg-white rounded-3xl p-20 text-center border-2 border-dashed border-gray-100">
                          <Package className="w-16 h-16 text-gray-200 mx-auto mb-6" />
                          <h3 className="text-xl font-black text-gray-400 uppercase tracking-tight">Немає товарів на складі в Україні</h3>
                          <p className="text-gray-400 text-sm font-bold mt-2">Додайте товари або змініть їх статус, щоб сформувати прайс</p>
                        </div>
                      )}
                    </div>
                  ) : crmModule === 'suppliers' ? (
                    <div className="space-y-8">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 className="text-2xl font-black text-black uppercase tracking-tight flex items-center gap-3">
                          <Globe className="w-8 h-8 text-black" />
                          Сайти постачальників
                        </h2>
                        <button 
                          onClick={() => {
                            setSupplierForm({ name: '', url: '', category: 'Опт', comment: '' });
                            setShowSupplierModal({ show: true, supplierId: null });
                          }}
                          className="w-full sm:w-auto px-6 py-3 bg-black text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-gray-900 transition-all shadow-lg shadow-gray-200"
                        >
                          <Plus className="w-4 h-4" />
                          Додати сайт
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {suppliers.map((s) => (
                          <motion.div 
                            key={s.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl hover:shadow-2xl transition-all group relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                              <button 
                                onClick={() => {
                                  setSupplierForm({ name: s.name, url: s.url, category: s.category, comment: s.comment });
                                  setShowSupplierModal({ show: true, supplierId: s.id });
                                }}
                                className="p-2 bg-gray-50 text-gray-400 hover:text-black rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  setConfirmModal({
                                    show: true,
                                    title: 'Видалити сайт?',
                                    message: `Ви впевнені, що хочете видалити ${s.name}?`,
                                    onConfirm: () => setSuppliers(prev => prev.filter(item => item.id !== s.id))
                                  });
                                }}
                                className="p-2 bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="flex items-center gap-4 mb-4">
                              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center shrink-0">
                                <Globe className="w-6 h-6 text-gray-400" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-black text-black uppercase tracking-tight truncate">{s.name}</h3>
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full">
                                  {s.category}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-gray-500 font-medium mb-6 line-clamp-2 h-8">
                              {s.comment || 'Немає опису'}
                            </p>

                            <a 
                              href={s.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="w-full py-3 bg-gray-50 text-black rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-yellow-400 transition-all"
                            >
                              Перейти на сайт
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </motion.div>
                        ))}
                      </div>

                      {suppliers.length === 0 && (
                        <div className="bg-white rounded-3xl p-20 text-center border-2 border-dashed border-gray-100">
                          <Globe className="w-16 h-16 text-gray-200 mx-auto mb-6" />
                          <h3 className="text-xl font-black text-gray-400 uppercase tracking-tight">Список сайтів порожній</h3>
                          <p className="text-gray-400 text-sm font-bold mt-2">Додайте посилання на перевірених постачальників</p>
                        </div>
                      )}
                    </div>
                  ) : crmModule === 'settings' ? (
                    <div className="space-y-8">
                      <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-black text-black uppercase tracking-tight">Налаштування системи</h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                              <DollarSign className="w-6 h-6 text-black" />
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-black uppercase tracking-tight">Курси валют</h3>
                              <p className="text-gray-400 text-xs font-bold">Фіксовані курси для розрахунків</p>
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Курс Юань до Гривні (CNY/UAH)</label>
                              <div className="flex items-center gap-4">
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={cnyToUah}
                                  onChange={(e) => setCnyToUah(parseFloat(e.target.value) || 0)}
                                  className="flex-1 p-4 bg-gray-50 rounded-xl border border-gray-100 font-black text-2xl text-black focus:outline-none focus:ring-2 focus:ring-black"
                                />
                                <div className="text-gray-400 font-black text-xl">UAH</div>
                              </div>
                              <p className="text-[10px] text-gray-400 font-bold italic">Цей курс використовується для розрахунку собівартості та формування прайс-листа.</p>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Курс Долара до Гривні (USD/UAH)</label>
                              <div className="flex items-center gap-4">
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={usdToUah}
                                  onChange={(e) => setUsdToUah(parseFloat(e.target.value) || 0)}
                                  className="flex-1 p-4 bg-gray-50 rounded-xl border border-gray-100 font-black text-2xl text-black focus:outline-none focus:ring-2 focus:ring-black"
                                />
                                <div className="text-gray-400 font-black text-xl">UAH</div>
                              </div>
                              <p className="text-[10px] text-gray-400 font-bold italic">Використовується для розрахунку вартості доставки в гривні.</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                                <Truck className="w-6 h-6 text-black" />
                              </div>
                              <div>
                                <h3 className="text-lg font-black text-black uppercase tracking-tight">Тарифи доставки</h3>
                                <p className="text-gray-400 text-xs font-bold">Налаштування калькулятора</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                setTariffForm({
                                  name: '',
                                  iconName: 'Ship',
                                  deliveryDays: '',
                                  description: '',
                                  pricePerKg: 0,
                                  volumetricFactor: 0,
                                  localDeliveryPrice: 0,
                                  minWeight: 0,
                                  minVolume: 0,
                                  minCost: 0,
                                  insuranceRate: 2,
                                  packagingCost: 0,
                                  packagingCostPerM3: 0,
                                  customsFee: 0,
                                  handlingFee: 0,
                                  fuelSurcharge: 0,
                                  densityTiers: []
                                });
                                setShowTariffModal({ show: true, tariffId: null });
                              }}
                              className="p-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-all"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-4">
                            {tariffs.map(t => (
                              <div key={t.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                  {getTariffIcon(t.iconName)}
                                  <div>
                                    <p className="text-sm font-black text-black uppercase tracking-tight">{t.name}</p>
                                    <p className="text-[10px] text-gray-400 font-bold">{t.deliveryDays}</p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => {
                                      setTariffForm(t);
                                      setShowTariffModal({ show: true, tariffId: t.id });
                                    }}
                                    className="p-2 text-gray-400 hover:text-black transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      if (tariffs.length > 1) {
                                        setConfirmModal({
                                          show: true,
                                          title: 'Видалити тариф?',
                                          message: `Ви впевнені, що хочете видалити ${t.name}?`,
                                          onConfirm: () => setTariffs(prev => prev.filter(item => item.id !== t.id))
                                        });
                                      } else {
                                        addNotification('Неможливо видалити останній тариф', 'error');
                                      }
                                    }}
                                    className="p-2 text-red-400 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            </div>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="bg-black py-16 text-center text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        </div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center rotate-3">
              <Calculator className="w-6 h-6 text-black" />
            </div>
            <span className="text-3xl font-black italic tracking-tighter text-white">FORSAGE<span className="text-yellow-400"> CHINA</span></span>
          </div>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">System Version 2.4.0</p>
        </div>
      </footer>

      {/* CRM Modals */}
      {cropImage && (
        <CropModal 
          image={cropImage} 
          onCropComplete={(cropped) => {
            setPurchaseForm({ ...purchaseForm, photo: cropped });
            setCropImage(null);
          }}
          onCancel={() => setCropImage(null)}
        />
      )}
      {showAddPurchaseModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 sm:px-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowAddPurchaseModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 md:p-10 max-w-6xl w-full relative z-10 shadow-2xl border-b-8 border-black max-h-[90vh] overflow-y-auto"
          >
            <button onClick={() => {
              setShowAddPurchaseModal(false);
              setEditingPurchaseId(null);
              setPurchaseForm({
                platform: 'Taobao',
                name: '',
                link: '',
                priceYuan: 0,
                exchangeRate: 5.5,
                quantity: 1,
                trackNumber: '',
                photo: '',
                comment: ''
              });
            }} className="absolute top-4 right-4 md:top-6 md:right-6 text-gray-400 hover:text-black transition-colors">
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <h3 className="text-xl md:text-3xl font-black text-[#003d2b] uppercase tracking-tight mb-6 md:mb-8 flex items-center gap-2 md:gap-3">
              <PlusCircle className="w-6 h-6 md:w-8 md:h-8 text-black" />
              Додати нову закупку
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Платформа / Постачальник</label>
                <select 
                  value={purchaseForm.platform}
                  onChange={(e) => setPurchaseForm({...purchaseForm, platform: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="Taobao">Taobao</option>
                  <option value="Pinduoduo">Pinduoduo</option>
                  <option value="1688">1688</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                  <option value="Інше">Інше</option>
                </select>
              </div>
              
              <div className="space-y-2 lg:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Назва товару</label>
                <input 
                  type="text" 
                  value={purchaseForm.name}
                  onChange={(e) => setPurchaseForm({...purchaseForm, name: e.target.value})}
                  placeholder="Назва товару" 
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                />
              </div>

              <div className="space-y-2 lg:col-span-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Посилання на товар</label>
                <input 
                  type="text" 
                  value={purchaseForm.link}
                  onChange={(e) => setPurchaseForm({...purchaseForm, link: e.target.value})}
                  placeholder="https://..." 
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ціна за одиницю (¥)</label>
                <input 
                  type="number" 
                  value={purchaseForm.priceYuan || ''}
                  onChange={(e) => setPurchaseForm({...purchaseForm, priceYuan: parseFloat(e.target.value) || 0})}
                  placeholder="0.00" 
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Курс юаня (CNY/UAH)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={purchaseForm.exchangeRate || ''}
                  onChange={(e) => setPurchaseForm({...purchaseForm, exchangeRate: parseFloat(e.target.value) || 0})}
                  placeholder={cnyToUah.toString()} 
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ціна в грн (Авто)</label>
                <div className="w-full p-4 bg-gray-100 rounded-xl border border-gray-100 font-black text-black">
                  {(purchaseForm.priceYuan * purchaseForm.exchangeRate).toFixed(2)} грн
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Кількість</label>
                <input 
                  type="number" 
                  value={purchaseForm.quantity || ''}
                  onChange={(e) => setPurchaseForm({...purchaseForm, quantity: parseInt(e.target.value) || 0})}
                  placeholder="1" 
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Загальна ціна</label>
                <div className="w-full p-4 bg-gray-100 rounded-xl border border-gray-100 font-black flex justify-between items-center">
                  <span className="text-black">{(purchaseForm.priceYuan * purchaseForm.quantity).toFixed(2)} ¥</span>
                  <span className="text-black">{((purchaseForm.priceYuan * purchaseForm.quantity) * purchaseForm.exchangeRate).toFixed(2)} грн</span>
                </div>
              </div>

              {/* Advanced Calculation Section */}
              <div className="lg:col-span-3 border-t border-gray-100 pt-6 mt-2">
                <h4 className="text-xs font-black text-[#003d2b] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-black" />
                  Параметри доставки
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2 lg:col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Розміри (Ш x В x Д) в см</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={purchaseForm.width || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const newForm = { ...purchaseForm, width: val };
                          
                          // Recalculate shipping cost
                          const w = newForm.weight || 0;
                          const actualWeight = newForm.weightUnit === 'kg' ? w : w / 1000;
                          
                          const factor = newForm.dimUnit === 'm' ? 100 : 1;
                          const volWeight = ((newForm.width * factor) * (newForm.height * factor) * (newForm.length * factor)) / 5000;
                          
                          // If dimensions are present, use them. Otherwise use volume/density if present.
                          let finalWeight = Math.max(actualWeight, volWeight);
                          
                          if (newForm.width === 0 && newForm.height === 0 && newForm.length === 0 && newForm.volume && newForm.volume > 0) {
                            const volWeightFromVol = newForm.volume * 200; // Standard volumetric weight factor for m3
                            finalWeight = Math.max(actualWeight, volWeightFromVol);
                          }

                          newForm.shippingCost = finalWeight * shippingPricePerKg;
                          if (newForm.isFabric) newForm.shippingCost += 5; // Example fabric surcharge
                          if (newForm.isInsured) newForm.shippingCost += (newForm.declaredValue || 0) * 0.02;

                          setPurchaseForm(newForm);
                        }}
                        placeholder="Ш (см)" 
                        className="flex-1 p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                      />
                      <input 
                        type="number" 
                        value={purchaseForm.height || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const newForm = { ...purchaseForm, height: val };
                          
                          const w = newForm.weight || 0;
                          const actualWeight = newForm.weightUnit === 'kg' ? w : w / 1000;
                          
                          const factor = newForm.dimUnit === 'm' ? 100 : 1;
                          const volWeight = ((newForm.width * factor) * (newForm.height * factor) * (newForm.length * factor)) / 5000;
                          
                          let finalWeight = Math.max(actualWeight, volWeight);
                          if (newForm.width === 0 && newForm.height === 0 && newForm.length === 0 && newForm.volume && newForm.volume > 0) {
                            finalWeight = Math.max(actualWeight, newForm.volume * 200);
                          }

                          newForm.shippingCost = finalWeight * shippingPricePerKg;
                          if (newForm.isFabric) newForm.shippingCost += 5;
                          if (newForm.isInsured) newForm.shippingCost += (newForm.declaredValue || 0) * 0.02;

                          setPurchaseForm(newForm);
                        }}
                        placeholder="В (см)" 
                        className="flex-1 p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                      />
                      <input 
                        type="number" 
                        value={purchaseForm.length || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const newForm = { ...purchaseForm, length: val };
                          
                          const w = newForm.weight || 0;
                          const actualWeight = newForm.weightUnit === 'kg' ? w : w / 1000;
                          
                          const factor = newForm.dimUnit === 'm' ? 100 : 1;
                          const volWeight = ((newForm.width * factor) * (newForm.height * factor) * (newForm.length * factor)) / 5000;
                          
                          let finalWeight = Math.max(actualWeight, volWeight);
                          if (newForm.width === 0 && newForm.height === 0 && newForm.length === 0 && newForm.volume && newForm.volume > 0) {
                            finalWeight = Math.max(actualWeight, newForm.volume * 200);
                          }

                          newForm.shippingCost = finalWeight * shippingPricePerKg;
                          if (newForm.isFabric) newForm.shippingCost += 5;
                          if (newForm.isInsured) newForm.shippingCost += (newForm.declaredValue || 0) * 0.02;

                          setPurchaseForm(newForm);
                        }}
                        placeholder="Д (см)" 
                        className="flex-1 p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                      />
                      <select 
                        value={purchaseForm.dimUnit}
                        onChange={(e) => {
                          const unit = e.target.value as 'cm' | 'm';
                          const newForm = { ...purchaseForm, dimUnit: unit };
                          
                          const w = newForm.weight || 0;
                          const actualWeight = newForm.weightUnit === 'kg' ? w : w / 1000;
                          
                          const factor = unit === 'm' ? 100 : 1;
                          const volWeight = ((newForm.width * factor) * (newForm.height * factor) * (newForm.length * factor)) / 5000;
                          
                          let finalWeight = Math.max(actualWeight, volWeight);
                          if (newForm.width === 0 && newForm.height === 0 && newForm.length === 0 && newForm.volume && newForm.volume > 0) {
                            finalWeight = Math.max(actualWeight, newForm.volume * 200);
                          }

                          newForm.shippingCost = finalWeight * shippingPricePerKg;
                          if (newForm.isFabric) newForm.shippingCost += 5;
                          if (newForm.isInsured) newForm.shippingCost += (newForm.declaredValue || 0) * 0.02;

                          setPurchaseForm(newForm);
                        }}
                        className="p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black"
                      >
                        <option value="cm">см</option>
                        <option value="m">м</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Вага</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        step="0.01"
                        value={purchaseForm.weight || ''}
                        onChange={(e) => {
                          const w = parseFloat(e.target.value) || 0;
                          const newForm = { ...purchaseForm, weight: w };
                          
                          const actualWeight = newForm.weightUnit === 'kg' ? w : w / 1000;
                          
                          const factor = newForm.dimUnit === 'm' ? 100 : 1;
                          const volWeight = ((newForm.width * factor) * (newForm.height * factor) * (newForm.length * factor)) / 5000;
                          
                          let finalWeight = Math.max(actualWeight, volWeight);
                          if (newForm.width === 0 && newForm.height === 0 && newForm.length === 0 && newForm.volume && newForm.volume > 0) {
                            finalWeight = Math.max(actualWeight, newForm.volume * 200);
                          }

                          newForm.shippingCost = finalWeight * shippingPricePerKg;
                          if (newForm.isFabric) newForm.shippingCost += 5;
                          if (newForm.isInsured) newForm.shippingCost += (newForm.declaredValue || 0) * 0.02;

                          setPurchaseForm(newForm);
                        }}
                        placeholder="0.00" 
                        className="flex-1 p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                      />
                      <select 
                        value={purchaseForm.weightUnit}
                        onChange={(e) => {
                          const unit = e.target.value as 'g' | 'kg';
                          const newForm = { ...purchaseForm, weightUnit: unit };
                          
                          const w = newForm.weight;
                          const actualWeight = unit === 'kg' ? w : w / 1000;
                          
                          const factor = newForm.dimUnit === 'm' ? 100 : 1;
                          const volWeight = ((newForm.width * factor) * (newForm.height * factor) * (newForm.length * factor)) / 5000;
                          
                          let finalWeight = Math.max(actualWeight, volWeight);
                          if (newForm.width === 0 && newForm.height === 0 && newForm.length === 0 && newForm.volume && newForm.volume > 0) {
                            finalWeight = Math.max(actualWeight, newForm.volume * 200);
                          }

                          newForm.shippingCost = finalWeight * shippingPricePerKg;
                          if (newForm.isFabric) newForm.shippingCost += 5;
                          if (newForm.isInsured) newForm.shippingCost += (newForm.declaredValue || 0) * 0.02;

                          setPurchaseForm(newForm);
                        }}
                        className="p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black"
                      >
                        <option value="g">г</option>
                        <option value="kg">кг</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Об'єм (м³)</label>
                    <input 
                      type="number" 
                      step="0.001"
                      value={purchaseForm.volume || ''}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        const newForm = { ...purchaseForm, volume: v };
                        
                        // If dimensions are missing, calculate density if weight is present
                        const actualWeight = newForm.weightUnit === 'kg' ? newForm.weight : (newForm.weight || 0) / 1000;
                        if (v > 0 && actualWeight > 0) {
                          newForm.density = actualWeight / v;
                        }

                        // Recalculate shipping cost based on volume if dimensions are missing
                        if (newForm.width === 0 && newForm.height === 0 && newForm.length === 0) {
                          const volWeight = v * 200;
                          const finalWeight = Math.max(actualWeight, volWeight);
                          newForm.shippingCost = finalWeight * shippingPricePerKg;
                          if (newForm.isFabric) newForm.shippingCost += 5;
                          if (newForm.isInsured) newForm.shippingCost += (newForm.declaredValue || 0) * 0.02;
                        }

                        setPurchaseForm(newForm);
                      }}
                      placeholder="0.000" 
                      className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Щільність (кг/м³)</label>
                    <input 
                      type="number" 
                      value={purchaseForm.density || ''}
                      onChange={(e) => {
                        const d = parseFloat(e.target.value) || 0;
                        const newForm = { ...purchaseForm, density: d };
                        
                        // If volume is missing but weight and density are present, calculate volume
                        const actualWeight = newForm.weightUnit === 'kg' ? newForm.weight : (newForm.weight || 0) / 1000;
                        if (d > 0 && actualWeight > 0 && (!newForm.volume || newForm.volume === 0)) {
                          newForm.volume = actualWeight / d;
                        }

                        // Recalculate shipping cost based on density if dimensions are missing
                        if (newForm.width === 0 && newForm.height === 0 && newForm.length === 0 && newForm.volume && newForm.volume > 0) {
                          const volWeight = newForm.volume * 200;
                          const finalWeight = Math.max(actualWeight, volWeight);
                          newForm.shippingCost = finalWeight * shippingPricePerKg;
                          if (newForm.isFabric) newForm.shippingCost += 5;
                          if (newForm.isInsured) newForm.shippingCost += (newForm.declaredValue || 0) * 0.02;
                        }

                        setPurchaseForm(newForm);
                      }}
                      placeholder="0" 
                      className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Вартість доставки (грн)</label>
                    <input 
                      type="number" 
                      step="1"
                      value={purchaseForm.shippingCost ? Math.round(purchaseForm.shippingCost * usdToUah) : ''}
                      onChange={(e) => setPurchaseForm({...purchaseForm, shippingCost: (parseFloat(e.target.value) || 0) / usdToUah})}
                      placeholder="0" 
                      className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                    />
                  </div>
                </div>
              </div>

              {/* Additional Services Section */}
              <div className="lg:col-span-3 border-t border-gray-100 pt-6 mt-2">
                <h4 className="text-xs font-black text-black uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-black" />
                  Додаткові послуги
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-all">
                    <input 
                      type="checkbox" 
                      checked={purchaseForm.isFabric}
                      onChange={(e) => {
                        const val = e.target.checked;
                        const newForm = { ...purchaseForm, isFabric: val };
                        if (val) newForm.shippingCost = (newForm.shippingCost || 0) + 5;
                        else newForm.shippingCost = (newForm.shippingCost || 0) - 5;
                        setPurchaseForm(newForm);
                      }}
                      className="w-5 h-5 accent-black"
                    />
                    <span className="text-xs font-bold text-black">Тканина (+5$/кг)</span>
                  </label>

                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-all">
                    <input 
                      type="checkbox" 
                      checked={purchaseForm.isPressed}
                      onChange={(e) => setPurchaseForm({...purchaseForm, isPressed: e.target.checked})}
                      className="w-5 h-5 accent-black"
                    />
                    <span className="text-xs font-bold text-black">Пресування</span>
                  </label>

                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-all">
                    <input 
                      type="checkbox" 
                      checked={purchaseForm.isInsured}
                      onChange={(e) => {
                        const val = e.target.checked;
                        const newForm = { ...purchaseForm, isInsured: val };
                        if (val) newForm.shippingCost = (newForm.shippingCost || 0) + (newForm.declaredValue || 0) * 0.02;
                        else newForm.shippingCost = (newForm.shippingCost || 0) - (newForm.declaredValue || 0) * 0.02;
                        setPurchaseForm(newForm);
                      }}
                      className="w-5 h-5 accent-black"
                    />
                    <span className="text-xs font-bold text-black">Страхування (2%)</span>
                  </label>

                  {purchaseForm.isInsured && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Оголошена вартість ($)</label>
                      <input 
                        type="number" 
                        value={purchaseForm.declaredValue || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const oldVal = purchaseForm.declaredValue || 0;
                          const newForm = { ...purchaseForm, declaredValue: val };
                          // Adjust shipping cost based on difference in insurance
                          newForm.shippingCost = (newForm.shippingCost || 0) - (oldVal * 0.02) + (val * 0.02);
                          setPurchaseForm(newForm);
                        }}
                        placeholder="0.00" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Статус</label>
                <select 
                  value={purchaseForm.status}
                  onChange={(e) => setPurchaseForm({...purchaseForm, status: e.target.value as any})}
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black"
                >
                  {Object.entries(statusLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Трек-номер</label>
                <input 
                  type="text" 
                  value={purchaseForm.trackNumber}
                  onChange={(e) => handleTrackNumberChange(e.target.value)}
                  placeholder="TB123456789" 
                  className={cn(
                    "w-full p-4 bg-gray-50 rounded-xl border font-bold focus:outline-none focus:ring-2 transition-all",
                    trackWarning?.exists ? "border-amber-400 ring-amber-400" : "border-gray-100 focus:ring-black"
                  )}
                />
                {trackWarning?.exists && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 border border-amber-200 p-4 rounded-xl mt-2"
                  >
                    <p className="text-xs text-amber-800 font-bold flex items-center gap-2 mb-3">
                      <span>⚠️</span> Такий трек номер вже існує в системі
                    </p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const existing = purchases.find(p => p.id === trackWarning?.purchaseId);
                          if (existing) {
                            setPurchaseSearch(existing.trackNumber);
                          }
                          setCrmModule('purchases');
                          setShowAddPurchaseModal(false);
                          setTrackWarning(null);
                        }}
                        className="bg-amber-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all"
                      >
                        відкрити товар
                      </button>
                      <button 
                        onClick={() => {
                          setPurchaseForm({ ...purchaseForm, trackNumber: '' });
                          setTrackWarning(null);
                        }}
                        className="bg-white border border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all"
                      >
                        скасувати
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="space-y-2 lg:col-span-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Фото товару</label>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                    {purchaseForm.photo ? (
                      <img src={purchaseForm.photo} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex gap-2">
                      <label className="flex-1 bg-white border border-gray-200 text-black py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition-all cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Завантажити фото
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setPurchaseForm({ ...purchaseForm, photo: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {purchaseForm.photo && (
                        <button 
                          onClick={() => setPurchaseForm({ ...purchaseForm, photo: '' })}
                          className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={purchaseForm.photo}
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, photo: e.target.value })}
                        placeholder="Або вставте посилання на фото..." 
                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-black" 
                      />
                      <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium italic">Порада: Ви можете просто вставити фото з буфера обміну (Ctrl+V)</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 lg:col-span-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Коментар</label>
                <textarea 
                  value={purchaseForm.comment}
                  onChange={(e) => setPurchaseForm({...purchaseForm, comment: e.target.value})}
                  rows={3}
                  placeholder="Додаткова інформація..." 
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-10">
              <button 
                onClick={() => handleSavePurchase(false)}
                className="flex-1 py-5 bg-black text-white rounded-xl font-black text-lg hover:bg-gray-900 transition-all shadow-lg shadow-gray-100 flex items-center justify-center gap-3"
              >
                💾 Зберегти
              </button>
              <button 
                onClick={() => handleSavePurchase(true)}
                className="flex-1 py-5 bg-black text-white rounded-xl font-black text-lg hover:bg-gray-900 transition-all shadow-lg shadow-gray-100 flex items-center justify-center gap-3"
              >
                💾 Зберегти і додати ще
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showImportTracksModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 sm:px-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowImportTracksModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 md:p-10 max-w-xl w-full relative z-10 shadow-2xl border-b-8 border-black max-h-[90vh] overflow-y-auto"
          >
            <button onClick={() => setShowImportTracksModal(false)} className="absolute top-4 right-4 md:top-6 md:right-6 text-gray-400 hover:text-black transition-colors">
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <h3 className="text-xl md:text-3xl font-black text-black uppercase tracking-tight mb-6 md:mb-8 flex items-center gap-2 md:gap-3">
              <Upload className="w-6 h-6 md:w-8 md:h-8 text-black" />
              Імпорт трек-номерів
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Список треків (кожен з нового рядка)</label>
                <textarea 
                  rows={8}
                  placeholder="TB123456789&#10;TB987654321"
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-4">
                <Info className="w-6 h-6 text-blue-500 shrink-0" />
                <p className="text-xs text-blue-700 font-medium leading-relaxed">
                  Система автоматично розпізнає трек-номери та додасть їх до бази даних зі статусом "Очікується на складі".
                </p>
              </div>
            </div>
            <button className="w-full mt-10 py-5 bg-black text-white rounded-xl font-black text-xl hover:bg-gray-900 transition-all shadow-lg shadow-gray-100">
              Імпортувати треки
            </button>
          </motion.div>
        </div>
      )}

      {showCreateBatchModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 sm:px-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowCreateBatchModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 md:p-10 max-w-2xl w-full relative z-10 shadow-2xl border-b-8 border-black max-h-[90vh] overflow-y-auto"
          >
            <button onClick={() => {
              setShowCreateBatchModal(false);
              setEditingBatchId(null);
              setBatchForm({
                name: '',
                shipmentDate: new Date().toISOString().split('T')[0],
                warehouse: 'Guangzhou',
                deliveryType: 'sea'
              });
            }} className="absolute top-4 right-4 md:top-6 md:right-6 text-gray-400 hover:text-black transition-colors">
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <h3 className="text-xl md:text-3xl font-black text-black uppercase tracking-tight mb-6 md:mb-8 flex items-center gap-2 md:gap-3">
              <Truck className="w-6 h-6 md:w-8 md:h-8 text-black" />
              {editingBatchId ? 'Редагувати партію' : 'Створити партію доставки'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Назва партії</label>
                <input 
                  type="text" 
                  value={batchForm.name}
                  onChange={(e) => setBatchForm({...batchForm, name: e.target.value})}
                  placeholder="Назва партії" 
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Дата відправки</label>
                <input 
                  type="date" 
                  value={batchForm.shipmentDate}
                  onChange={(e) => setBatchForm({...batchForm, shipmentDate: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Склад</label>
                <select 
                  value={batchForm.warehouse}
                  onChange={(e) => setBatchForm({...batchForm, warehouse: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="Guangzhou">Guangzhou</option>
                  <option value="Shenzhen">Shenzhen</option>
                  <option value="Yiwu">Yiwu</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Тип доставки</label>
                <select 
                  value={batchForm.deliveryType}
                  onChange={(e) => setBatchForm({...batchForm, deliveryType: e.target.value as 'sea' | 'air'})}
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="air">✈️ Авіа</option>
                  <option value="sea">🚢 Море</option>
                </select>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mb-8">
              <h4 className="text-xs font-black text-black uppercase tracking-widest mb-4 flex items-center justify-between">
                <span>Товари на складі Китай</span>
                <span className="bg-black text-white px-2 py-0.5 rounded text-[10px]">
                  {purchases.filter(p => p.status === 'arrived_china').length}
                </span>
              </h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {purchases.filter(p => p.status === 'arrived_china').map(p => (
                  <div key={p.id} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold text-blue-500">
                      {p.trackNumber.slice(-4)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-black">{p.name}</p>
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{p.trackNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-black">{p.weight || 0} кг</p>
                      <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">вага</p>
                    </div>
                  </div>
                ))}
                {purchases.filter(p => p.status === 'arrived_china').length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Немає товарів зі статусом "На складі Китай"</p>
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={handleCreateBatch}
              disabled={!editingBatchId && purchases.filter(p => p.status === 'arrived_china').length === 0}
              className="w-full py-5 bg-black text-white rounded-xl font-black text-xl hover:bg-gray-900 transition-all shadow-lg shadow-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingBatchId ? 'Зберегти зміни' : 'Додати до партії'}
            </button>
          </motion.div>
        </div>
      )}

      {showCostModal.show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 sm:px-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowCostModal({ show: false, batchId: null })} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 md:p-10 max-w-md w-full relative z-10 shadow-2xl border-b-8 border-amber-400 max-h-[90vh] overflow-y-auto"
          >
            <button onClick={() => setShowCostModal({ show: false, batchId: null })} className="absolute top-4 right-4 md:top-6 md:right-6 text-gray-400 hover:text-black transition-colors">
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <h3 className="text-xl md:text-3xl font-black text-black uppercase tracking-tight mb-6 md:mb-8 flex items-center gap-2 md:gap-3">
              <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-amber-400" />
              Вартість доставки
            </h3>
            
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Тариф</label>
                <select 
                  value={costForm.tariffId}
                  onChange={(e) => setCostForm({...costForm, tariffId: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {tariffs.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Вага партії (кг)</label>
                  <input 
                    type="number" 
                    value={costForm.totalWeight || ''}
                    onChange={(e) => setCostForm({...costForm, totalWeight: parseFloat(e.target.value) || 0})}
                    placeholder="0.00" 
                    className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-amber-400" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Об'єм партії (м³)</label>
                  <input 
                    type="number" 
                    value={costForm.volume || ''}
                    onChange={(e) => setCostForm({...costForm, volume: parseFloat(e.target.value) || 0})}
                    placeholder="0.000" 
                    step="0.001"
                    className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-amber-400" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Оголошена вартість ($)</label>
                <input 
                  type="number" 
                  value={costForm.declaredValue || ''}
                  onChange={(e) => setCostForm({...costForm, declaredValue: parseFloat(e.target.value) || 0})}
                  placeholder="0.00" 
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-amber-400" 
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => setCostForm(p => ({ ...p, isInsured: !p.isInsured }))}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                    costForm.isInsured ? "border-amber-400 bg-amber-50" : "border-gray-50 hover:border-gray-100"
                  )}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">Страхування (2%)</span>
                  <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", costForm.isInsured ? "border-amber-400 bg-amber-400" : "border-gray-200")}>
                    {costForm.isInsured && <div className="w-1 h-1 bg-white rounded-full" />}
                  </div>
                </button>
                <button 
                  onClick={() => setCostForm(p => ({ ...p, isFabric: !p.isFabric }))}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                    costForm.isFabric ? "border-amber-400 bg-amber-50" : "border-gray-50 hover:border-gray-100"
                  )}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">Тканина (+0.2$/кг)</span>
                  <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", costForm.isFabric ? "border-amber-400 bg-amber-400" : "border-gray-200")}>
                    {costForm.isFabric && <div className="w-1 h-1 bg-white rounded-full" />}
                  </div>
                </button>
                <button 
                  onClick={() => setCostForm(p => ({ ...p, isPressed: !p.isPressed }))}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                    costForm.isPressed ? "border-amber-400 bg-amber-50" : "border-gray-50 hover:border-gray-100"
                  )}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">Пресування (+5$)</span>
                  <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", costForm.isPressed ? "border-amber-400 bg-amber-400" : "border-gray-200")}>
                    {costForm.isPressed && <div className="w-1 h-1 bg-white rounded-full" />}
                  </div>
                </button>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Або введіть вартість вручну ($)</label>
                <input 
                  type="number" 
                  value={costForm.deliveryCost || ''}
                  onChange={(e) => setCostForm({...costForm, deliveryCost: parseFloat(e.target.value) || 0})}
                  placeholder="0.00" 
                  className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-amber-400" 
                />
              </div>

              <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Розрахункова вартість</span>
                  <span className="text-2xl font-black text-amber-600">
                    {(() => {
                      const selectedTariff = tariffs.find(t => t.id === costForm.tariffId) || tariffs[0];
                      let shippingCost = 0;
                      if (selectedTariff.pricePerKg) {
                        const volumetricWeight = (costForm.volume * 1000000) / (selectedTariff.volumetricFactor || 5000);
                        shippingCost = selectedTariff.pricePerKg * Math.max(costForm.totalWeight, volumetricWeight);
                      } else if (selectedTariff.densityTiers) {
                        const density = costForm.volume > 0 ? costForm.totalWeight / costForm.volume : 0;
                        const tier = selectedTariff.densityTiers.find(t => density >= t.min && (t.max === null || density < t.max));
                        if (tier) {
                          shippingCost = tier.unit === 'm3' ? tier.price * costForm.volume : tier.price * costForm.totalWeight;
                        }
                      }
                      const insurance = (costForm.isInsured && costForm.declaredValue) ? Math.max(1, costForm.declaredValue * 0.02) : 0;
                      const fabricSurcharge = costForm.isFabric ? costForm.totalWeight * 0.2 : 0;
                      const pressingCost = costForm.isPressed ? 5 : 0;
                      const localDelivery = (selectedTariff.localDeliveryPrice || 0) * costForm.totalWeight;
                      const total = shippingCost + insurance + localDelivery + fabricSurcharge + pressingCost;
                      return `$${total.toFixed(2)}`;
                    })()}
                  </span>
                </div>
                <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                  Вартість буде розподілена між товарами пропорційно їх вазі.
                </p>
              </div>
            </div>

            <button 
              onClick={handleSaveCosts}
              className="w-full mt-10 py-5 bg-amber-400 text-white rounded-xl font-black text-xl hover:bg-amber-500 transition-all shadow-lg shadow-amber-100"
            >
              Зберегти вартість
            </button>
          </motion.div>
        </div>
      )}
      {showSaleModal.show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setShowSaleModal({ show: false, purchaseId: null })} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[40px] p-10 max-w-2xl w-full relative z-10 shadow-2xl border-b-8 border-emerald-400 overflow-hidden"
          >
            <button onClick={() => setShowSaleModal({ show: false, purchaseId: null })} className="absolute top-8 right-8 text-gray-400 hover:text-black transition-colors z-20">
              <X className="w-8 h-8" />
            </button>

            <div className="flex flex-col md:flex-row gap-10">
              <div className="w-full md:w-1/2 space-y-6">
                <div className="aspect-square bg-gray-50 rounded-[32px] overflow-hidden border border-gray-100 shadow-inner group relative">
                  {(() => {
                    const purchase = purchases.find(p => p.id === showSaleModal.purchaseId);
                    return purchase?.photo ? (
                      <img src={purchase.photo} alt={purchase.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-200">
                        <Package className="w-20 h-20 mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Фото відсутнє</span>
                      </div>
                    );
                  })()}
                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-white/50">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Товар</p>
                    <p className="text-sm font-black text-black line-clamp-1">
                      {purchases.find(p => p.id === showSaleModal.purchaseId)?.name}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Вага</p>
                    <p className="text-lg font-black text-black">
                      {purchases.find(p => p.id === showSaleModal.purchaseId)?.weight || 0} кг
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Кількість</p>
                    <p className="text-lg font-black text-black">
                      {purchases.find(p => p.id === showSaleModal.purchaseId)?.quantity || 0} шт
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-1/2 space-y-6">
                <h3 className="text-3xl font-black text-black uppercase tracking-tight flex items-center gap-3">
                  <Store className="w-8 h-8 text-emerald-400" />
                  Продаж
                </h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ціна продажу ($)</label>
                    <input 
                      type="number" 
                      value={saleForm.sellingPrice || ''}
                      onChange={(e) => setSaleForm({...saleForm, sellingPrice: parseFloat(e.target.value) || 0})}
                      placeholder="0.00" 
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-black text-xl text-black focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all" 
                    />
                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Доставка Україна (грн)</label>
                                    <input 
                                      type="number" 
                                      value={saleForm.ukraineDeliveryCost || ''}
                                      onChange={(e) => setSaleForm({...saleForm, ukraineDeliveryCost: parseFloat(e.target.value) || 0})}
                                      placeholder="0.00" 
                                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all" 
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Доставка НП (грн)</label>
                                    <input 
                                      type="number" 
                                      value={saleForm.novaPoshtaCost || ''}
                                      onChange={(e) => setSaleForm({...saleForm, novaPoshtaCost: parseFloat(e.target.value) || 0})}
                                      placeholder="0.00" 
                                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all" 
                                    />
                                  </div>

                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-all" onClick={() => setSaleForm({...saleForm, markup: !saleForm.markup})}>
                    <div className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                      saleForm.markup ? "bg-emerald-400 border-emerald-400" : "bg-white border-gray-200"
                    )}>
                      {saleForm.markup && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <div>
                      <p className="text-xs font-black text-black uppercase tracking-widest">Націнка</p>
                      <p className="text-[10px] text-gray-400 font-medium">Не враховувати в основний розрахунок</p>
                    </div>
                  </div>

                  {(() => {
                    const purchase = purchases.find(p => p.id === showSaleModal.purchaseId);
                    if (!purchase) return null;
                    const costPrice = (purchase.priceYuan * purchase.quantity / purchase.exchangeRate) + (purchase.deliveryCostPerItem || 0);
                    const profit = saleForm.sellingPrice - costPrice - saleForm.ukraineDeliveryCost - saleForm.novaPoshtaCost;
                    
                    return (
                      <div className={cn(
                        "p-6 rounded-3xl border-2 transition-all",
                        profit >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
                      )}>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Очікуваний прибуток</p>
                            <p className={cn("text-2xl font-black", profit >= 0 ? "text-emerald-600" : "text-red-600")}>
                              ${profit.toFixed(2)}
                            </p>
                          </div>
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center",
                            profit >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                          )}>
                            <BarChart3 className="w-6 h-6" />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <button 
                  onClick={handleSale}
                  className="w-full py-5 bg-black text-white rounded-[24px] font-black text-xl hover:bg-gray-900 transition-all shadow-xl shadow-gray-100 flex items-center justify-center gap-3"
                >
                  <CheckCircle2 className="w-6 h-6" />
                  Підтвердити
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      {showSupplierModal.show && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 sm:px-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowSupplierModal({ show: false, supplierId: null })} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 md:p-10 max-w-lg w-full relative z-10 shadow-2xl border-b-8 border-black max-h-[90vh] overflow-y-auto"
          >
            <button onClick={() => setShowSupplierModal({ show: false, supplierId: null })} className="absolute top-4 right-4 md:top-6 md:right-6 text-gray-400 hover:text-black transition-colors">
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <h3 className="text-xl md:text-3xl font-black text-black uppercase tracking-tight mb-6 md:mb-8 flex items-center gap-2 md:gap-3">
              <Globe className="w-6 h-6 md:w-8 md:h-8 text-black" />
              {showSupplierModal.supplierId ? 'Редагувати сайт' : 'Додати сайт постачальника'}
            </h3>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Назва сайту</label>
                <input 
                  type="text" 
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({...supplierForm, name: e.target.value})}
                  placeholder="Наприклад: 1688.com" 
                  className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black transition-all" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Посилання (URL)</label>
                <input 
                  type="text" 
                  value={supplierForm.url}
                  onChange={(e) => setSupplierForm({...supplierForm, url: e.target.value})}
                  placeholder="https://..." 
                  className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black transition-all" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Категорія</label>
                <select 
                  value={supplierForm.category}
                  onChange={(e) => setSupplierForm({...supplierForm, category: e.target.value})}
                  className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black transition-all cursor-pointer"
                >
                  <option value="Опт">Опт</option>
                  <option value="Роздріб">Роздріб</option>
                  <option value="Дискаунтер">Дискаунтер</option>
                  <option value="Бренд">Бренд</option>
                  <option value="Інше">Інше</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Коментар / Опис</label>
                <textarea 
                  value={supplierForm.comment}
                  onChange={(e) => setSupplierForm({...supplierForm, comment: e.target.value})}
                  placeholder="Додайте опис або примітку..." 
                  rows={3}
                  className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black transition-all resize-none" 
                />
              </div>

              <button 
                onClick={() => {
                  if (!supplierForm.name || !supplierForm.url) {
                    addNotification('Будь ласка, заповніть назву та посилання', 'error');
                    return;
                  }

                  if (showSupplierModal.supplierId) {
                    setSuppliers(prev => prev.map(s => s.id === showSupplierModal.supplierId ? { ...s, ...supplierForm } : s));
                    addNotification('Сайт оновлено', 'success');
                  } else {
                    const newSupplier: Supplier = {
                      id: Math.random().toString(36).substr(2, 9),
                      ...supplierForm,
                      createdAt: new Date().toISOString()
                    };
                    setSuppliers(prev => [newSupplier, ...prev]);
                    addNotification('Сайт додано до бази', 'success');
                  }
                  setShowSupplierModal({ show: false, supplierId: null });
                }}
                className="w-full py-5 bg-black text-white rounded-[24px] font-black text-xl hover:bg-gray-900 transition-all shadow-xl shadow-gray-100 flex items-center justify-center gap-3"
              >
                <CheckCircle2 className="w-6 h-6" />
                {showSupplierModal.supplierId ? 'Зберегти зміни' : 'Додати сайт'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showTariffModal.show && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowTariffModal({ show: false, tariffId: null })} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 max-w-2xl w-full relative z-10 shadow-2xl border-b-8 border-blue-400 flex flex-col max-h-[90vh]"
          >
            <button onClick={() => setShowTariffModal({ show: false, tariffId: null })} className="absolute top-6 right-6 text-gray-400 hover:text-black transition-colors">
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-black text-black uppercase tracking-tight mb-6">
              {showTariffModal.tariffId ? 'Редагувати тариф' : 'Додати тариф'}
            </h3>
            
            <div className="overflow-y-auto pr-2 space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Назва тарифу</label>
                    <input 
                      type="text" 
                      value={tariffForm.name}
                      onChange={(e) => setTariffForm({...tariffForm, name: e.target.value})}
                      placeholder="Наприклад: Авіа Експрес" 
                      className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Іконка</label>
                      <select 
                        value={tariffForm.iconName}
                        onChange={(e) => setTariffForm({...tariffForm, iconName: e.target.value as any})}
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="Plane">Літак</option>
                        <option value="Ship">Корабель</option>
                        <option value="Truck">Вантажівка</option>
                        <option value="Train">Потяг</option>
                        <option value="Zap">Експрес</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Термін доставки</label>
                      <input 
                        type="text" 
                        value={tariffForm.deliveryDays}
                        onChange={(e) => setTariffForm({...tariffForm, deliveryDays: e.target.value})}
                        placeholder="7-10 днів" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Опис</label>
                    <textarea 
                      value={tariffForm.description}
                      onChange={(e) => setTariffForm({...tariffForm, description: e.target.value})}
                      placeholder="Короткий опис тарифу" 
                      rows={3}
                      className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ціна за кг ($)</label>
                      <input 
                        type="number" 
                        value={tariffForm.pricePerKg || ''}
                        onChange={(e) => setTariffForm({...tariffForm, pricePerKg: parseFloat(e.target.value) || 0})}
                        placeholder="0.00" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Коеф. об'єму</label>
                      <input 
                        type="number" 
                        value={tariffForm.volumetricFactor || ''}
                        onChange={(e) => setTariffForm({...tariffForm, volumetricFactor: parseFloat(e.target.value) || 0})}
                        placeholder="5000" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Мін. вага (кг)</label>
                      <input 
                        type="number" 
                        value={tariffForm.minWeight || ''}
                        onChange={(e) => setTariffForm({...tariffForm, minWeight: parseFloat(e.target.value) || 0})}
                        placeholder="0" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Мін. об'єм (м³)</label>
                      <input 
                        type="number" 
                        value={tariffForm.minVolume || ''}
                        onChange={(e) => setTariffForm({...tariffForm, minVolume: parseFloat(e.target.value) || 0})}
                        placeholder="0" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Мін. вартість ($)</label>
                      <input 
                        type="number" 
                        value={tariffForm.minCost || ''}
                        onChange={(e) => setTariffForm({...tariffForm, minCost: parseFloat(e.target.value) || 0})}
                        placeholder="0" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Страховка (%)</label>
                      <input 
                        type="number" 
                        value={tariffForm.insuranceRate || ''}
                        onChange={(e) => setTariffForm({...tariffForm, insuranceRate: parseFloat(e.target.value) || 0})}
                        placeholder="2" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Пак. ($/кг)</label>
                      <input 
                        type="number" 
                        value={tariffForm.packagingCost || ''}
                        onChange={(e) => setTariffForm({...tariffForm, packagingCost: parseFloat(e.target.value) || 0})}
                        placeholder="0.00" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Пак. ($/м³)</label>
                      <input 
                        type="number" 
                        value={tariffForm.packagingCostPerM3 || ''}
                        onChange={(e) => setTariffForm({...tariffForm, packagingCostPerM3: parseFloat(e.target.value) || 0})}
                        placeholder="0.00" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Митниця ($)</label>
                      <input 
                        type="number" 
                        value={tariffForm.customsFee || ''}
                        onChange={(e) => setTariffForm({...tariffForm, customsFee: parseFloat(e.target.value) || 0})}
                        placeholder="0.00" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Обробка ($)</label>
                      <input 
                        type="number" 
                        value={tariffForm.handlingFee || ''}
                        onChange={(e) => setTariffForm({...tariffForm, handlingFee: parseFloat(e.target.value) || 0})}
                        placeholder="0.00" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Паливна надб. (%)</label>
                      <input 
                        type="number" 
                        value={tariffForm.fuelSurcharge || ''}
                        onChange={(e) => setTariffForm({...tariffForm, fuelSurcharge: parseFloat(e.target.value) || 0})}
                        placeholder="0" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Доставка по UA ($/кг)</label>
                      <input 
                        type="number" 
                        value={tariffForm.localDeliveryPrice || ''}
                        onChange={(e) => setTariffForm({...tariffForm, localDeliveryPrice: parseFloat(e.target.value) || 0})}
                        placeholder="0.00" 
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Density Tiers Section */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Тарифікація за щільністю</label>
                  <button 
                    onClick={() => {
                      const newTiers = [...(tariffForm.densityTiers || []), { min: 0, max: 0, price: 0, unit: 'kg' as const }];
                      setTariffForm({...tariffForm, densityTiers: newTiers});
                    }}
                    className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-600"
                  >
                    + Додати поріг
                  </button>
                </div>
                
                <div className="space-y-3">
                  {tariffForm.densityTiers?.map((tier, index) => (
                    <div key={index} className="grid grid-cols-5 gap-2 items-end bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-gray-400 uppercase">Мін</label>
                        <input 
                          type="number" 
                          value={tier.min}
                          onChange={(e) => {
                            const newTiers = [...(tariffForm.densityTiers || [])];
                            newTiers[index].min = parseFloat(e.target.value) || 0;
                            setTariffForm({...tariffForm, densityTiers: newTiers});
                          }}
                          className="w-full p-2 bg-white rounded-lg border border-gray-100 text-xs font-bold focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-gray-400 uppercase">Макс</label>
                        <input 
                          type="number" 
                          value={tier.max || ''}
                          onChange={(e) => {
                            const newTiers = [...(tariffForm.densityTiers || [])];
                            newTiers[index].max = e.target.value ? parseFloat(e.target.value) : null;
                            setTariffForm({...tariffForm, densityTiers: newTiers});
                          }}
                          className="w-full p-2 bg-white rounded-lg border border-gray-100 text-xs font-bold focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-gray-400 uppercase">Ціна</label>
                        <input 
                          type="number" 
                          value={tier.price}
                          onChange={(e) => {
                            const newTiers = [...(tariffForm.densityTiers || [])];
                            newTiers[index].price = parseFloat(e.target.value) || 0;
                            setTariffForm({...tariffForm, densityTiers: newTiers});
                          }}
                          className="w-full p-2 bg-white rounded-lg border border-gray-100 text-xs font-bold focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-gray-400 uppercase">Од.</label>
                        <select 
                          value={tier.unit}
                          onChange={(e) => {
                            const newTiers = [...(tariffForm.densityTiers || [])];
                            newTiers[index].unit = e.target.value as 'kg' | 'm3';
                            setTariffForm({...tariffForm, densityTiers: newTiers});
                          }}
                          className="w-full p-2 bg-white rounded-lg border border-gray-100 text-xs font-bold focus:outline-none"
                        >
                          <option value="kg">кг</option>
                          <option value="m3">м³</option>
                        </select>
                      </div>
                      <button 
                        onClick={() => {
                          const newTiers = tariffForm.densityTiers?.filter((_, i) => i !== index);
                          setTariffForm({...tariffForm, densityTiers: newTiers});
                        }}
                        className="p-2 text-red-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!tariffForm.densityTiers || tariffForm.densityTiers.length === 0) && (
                    <p className="text-center text-[10px] text-gray-400 py-2 italic">Пороги щільності не задані</p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t">
              <button 
                onClick={() => {
                  if (!tariffForm.name) {
                    addNotification('Введіть назву тарифу', 'error');
                    return;
                  }
                  if (showTariffModal.tariffId) {
                    setTariffs(prev => prev.map(t => t.id === showTariffModal.tariffId ? { ...t, ...tariffForm } as Tariff : t));
                    addNotification('Тариф оновлено', 'success');
                  } else {
                    const newTariff: Tariff = {
                      ...tariffForm as Tariff,
                      id: Math.random().toString(36).substr(2, 9)
                    };
                    setTariffs(prev => [...prev, newTariff]);
                    addNotification('Тариф додано', 'success');
                  }
                  setShowTariffModal({ show: false, tariffId: null });
                }}
                className="w-full py-5 bg-black text-white rounded-xl font-black text-lg hover:bg-gray-900 transition-all shadow-lg shadow-gray-100"
              >
                {showTariffModal.tariffId ? 'Зберегти зміни' : 'Додати тариф'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {confirmModal && (
        <DeleteConfirmModal 
          show={confirmModal.show}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={() => {
            confirmModal.onConfirm();
            setConfirmModal(null);
          }}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
