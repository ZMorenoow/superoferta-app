const MOCK_PRODUCTS = [
  {
    id: '1', name: 'Manzana Roja', unit: 'kg', price: 1490, original_price: 1990,
    stock: 10, category: 'frutas',
    image_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400',
    description: 'Manzana roja de primera calidad, dulce y crujiente. Ideal para consumo directo o preparaciones.',
    characteristics: [
      { label: 'Tipo de Producto', value: 'Manzana Roja' },
      { label: 'Origen', value: 'Chile' },
      { label: 'Estado', value: 'Fresco' },
      { label: 'Contenido', value: '1 kg' },
      { label: 'Almacenamiento', value: 'Refrigerar para mayor duración' },
    ],
    tags: ['Vegano', 'Sin Gluten', 'Natural'],
  },
  {
    id: '2', name: 'Pechuga de Pollo', unit: 'kg', price: 4990, original_price: 6490,
    stock: 5, category: 'carnes',
    image_url: 'https://media.istockphoto.com/id/1400102034/es/foto/pechuga-de-pollo-aislada-filete-de-pollo-crudo-sobre-fondo-blanco-aves-de-corral-crudas-carne.jpg?s=612x612&w=0&k=20&c=GGfkxPe4W0qLPRuygj9WPm7wP5IlB_g-26K0IPHpp3g=',
    description: 'Pechuga de pollo fresca sin hueso ni piel. Alta en proteínas, ideal para dietas saludables.',
    characteristics: [
      { label: 'Tipo de Producto', value: 'Pollo' },
      { label: 'Corte', value: 'Pechuga sin hueso' },
      { label: 'Estado', value: 'Fresco' },
      { label: 'Contenido', value: '1 kg aprox.' },
      { label: 'Almacenamiento', value: 'Mantener refrigerado entre 0°C y 4°C' },
    ],
    tags: ['Sin Gluten', 'Alto en Proteínas'],
  },
  {
    id: '3', name: 'Leche Entera', unit: '1L', price: 990, original_price: null,
    stock: 20, category: 'lacteos',
    image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400',
    description: 'Leche entera pasteurizada con todo su aporte nutricional. Fuente natural de calcio y vitaminas.',
    characteristics: [
      { label: 'Tipo de Producto', value: 'Leche Entera' },
      { label: 'Formato', value: 'Tetra Pak' },
      { label: 'Contenido', value: '1 litro' },
      { label: 'Almacenamiento', value: 'Una vez abierto, refrigerar y consumir en 3 días' },
    ],
    tags: ['Fuente de Calcio', 'Vitamina D'],
  },
  {
    id: '4', name: 'Pan Marraqueta', unit: 'unidad', price: 150, original_price: null,
    stock: 30, category: 'panaderia',
    image_url: 'https://media.istockphoto.com/id/955755538/es/foto/pan-marraqueta.jpg?s=612x612&w=0&k=20&c=HDwdYCP-8TVYj7QeXCDJr340ZGEH4lLKNnlDumYfHLM=',
    description: 'Pan marraqueta tradicional chileno, crujiente por fuera y suave por dentro. Horneado fresco.',
    characteristics: [
      { label: 'Tipo de Producto', value: 'Pan' },
      { label: 'Variedad', value: 'Marraqueta' },
      { label: 'Estado', value: 'Fresco' },
      { label: 'Almacenamiento', value: 'Consumir el mismo día o congelar' },
    ],
    tags: ['Vegano', 'Horneado Fresco'],
  },
  {
    id: '5', name: 'Brócoli', unit: 'unidad', price: 990, original_price: 1290,
    stock: 8, category: 'verduras',
    image_url: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=400',
    description: 'Brócoli fresco de tamaño mediano. Rico en fibra, vitaminas C y K. Ideal al vapor o salteado.',
    characteristics: [
      { label: 'Tipo de Producto', value: 'Brócoli' },
      { label: 'Origen', value: 'Chile' },
      { label: 'Estado', value: 'Fresco' },
      { label: 'Formato', value: 'Entero' },
      { label: 'Almacenamiento', value: 'Refrigerar en bolsa perforada' },
    ],
    tags: ['Vegano', 'Sin Gluten', 'Alto en Fibra'],
  },
  {
    id: '6', name: 'Coca-Cola', unit: '1.5L', price: 1290, original_price: 1590,
    stock: 15, category: 'bebidas',
    image_url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400',
    description: 'La bebida gaseosa más icónica del mundo. Sabor único e inconfundible para compartir.',
    characteristics: [
      { label: 'Tipo de Producto', value: 'Bebida Gaseosa' },
      { label: 'Sabor', value: 'Cola' },
      { label: 'Contenido', value: '1.5 litros' },
      { label: 'Envase', value: 'Botella PET retornable' },
      { label: 'Almacenamiento', value: 'Una vez abierto, refrigerar y consumir en 24h' },
    ],
    tags: ['Sin Alcohol'],
  },
  {
    id: '7', name: 'Plátano', unit: 'kg', price: 890, original_price: null,
    stock: 12, category: 'frutas',
    image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400',
    description: 'Plátanos frescos con punto ideal de maduración. Fuente natural de energía y potasio.',
    characteristics: [
      { label: 'Tipo de Producto', value: 'Plátano' },
      { label: 'Origen', value: 'Ecuador' },
      { label: 'Estado', value: 'Fresco' },
      { label: 'Contenido', value: '1 kg aprox.' },
      { label: 'Almacenamiento', value: 'Conservar a temperatura ambiente' },
    ],
    tags: ['Vegano', 'Sin Gluten', 'Fuente de Potasio'],
  },
  {
    id: '8', name: 'Detergente Omo', unit: '2,7 kg', price: 5990, original_price: 7990,
    stock: 6, category: 'limpieza',
    image_url: 'https://media.falabella.com/tottusCL/20548530_1/w=1200,h=1200,fit=pad',
    description: 'Detergente en polvo con tecnología de limpieza profunda. Elimina manchas difíciles desde el primer lavado.',
    characteristics: [
      { label: 'Tipo de Producto', value: 'Detergente en Polvo' },
      { label: 'Marca', value: 'Omo' },
      { label: 'Contenido', value: '2.7 kg' },
      { label: 'Uso', value: 'Lavadora y lavado a mano' },
      { label: 'Almacenamiento', value: 'Mantener en lugar seco y fresco' },
    ],
    tags: ['Limpieza Profunda', 'Anti-manchas'],
  },
  {
    id: '9', name: 'Queso Gouda', unit: '250g', price: 2490, original_price: null,
    stock: 4, category: 'lacteos',
    image_url: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400',
    description: 'Queso Gouda de sabor suave y cremoso. Perfecto para sándwiches, tablas de quesos o gratinar.',
    characteristics: [
      { label: 'Tipo de Producto', value: 'Queso Gouda' },
      { label: 'Origen', value: 'Holanda' },
      { label: 'Contenido', value: '250 g' },
      { label: 'Formato', value: 'Laminado' },
      { label: 'Almacenamiento', value: 'Refrigerar entre 2°C y 6°C' },
    ],
    tags: ['Fuente de Calcio', 'Sin Gluten'],
  },
  {
    id: '10', name: 'Tomate', unit: 'kg', price: 1190, original_price: null,
    stock: 0, category: 'verduras',
    image_url: 'https://media.istockphoto.com/id/831570242/es/foto/tres-tomates-rojos-jugosas-aislados-sobre-fondo-blanco.jpg?s=612x612&w=0&k=20&c=F2Ej4m9R3wDhX_1yV0QL1SKSkRMTOaNyuEBUgjT9aQY=',
    description: 'Tomates frescos y jugosos. Ideales para ensaladas, salsas y todo tipo de preparaciones.',
    characteristics: [
      { label: 'Tipo de Producto', value: 'Tomate' },
      { label: 'Origen', value: 'Chile' },
      { label: 'Estado', value: 'Fresco' },
      { label: 'Contenido', value: '1 kg aprox.' },
      { label: 'Almacenamiento', value: 'Conservar a temperatura ambiente hasta madurar' },
    ],
    tags: ['Vegano', 'Sin Gluten', 'Natural'],
  },
];

export const MOCK_BANNERS = [
  { id: '1', title: 'Ofertas de la semana', subtitle: 'Hasta 40% dcto.', bg: '#C21807', emoji: '🔥' },
  { id: '2', title: 'Frutas frescas', subtitle: 'Directo del campo', bg: '#1B6B3A', emoji: '🍎' },
  { id: '3', title: 'Carnes premium', subtitle: 'Selección especial', bg: '#8B4513', emoji: '🥩' },
];

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

export const api = {
  get: async (path, { params } = {}) => {
    await delay(500);
    if (path === '/products') {
      let results = [...MOCK_PRODUCTS];
      if (params?.category) results = results.filter((p) => p.category === params.category);
      if (params?.q) {
        const q = params.q.toLowerCase();
        results = results.filter((p) => p.name.toLowerCase().includes(q));
      }
      return { data: results };
    }
    return { data: [] };
  },
  post: async (path, body) => {
    await delay(300);
    if (path === '/auth/login') {
      if (body.email && body.password) return { data: { token: 'mock-token-123' } };
      throw new Error('Credenciales incorrectas');
    }
    return { data: {} };
  },
};