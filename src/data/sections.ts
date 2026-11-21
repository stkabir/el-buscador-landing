export const REPO = 'https://github.com/stkabir/el-buscador';
export const DOWNLOAD = `${REPO}/releases/latest/download/el-buscador-amd64-installer.exe`;

export type Tag = { label: string; tone?: 'safe' | 'review' | 'keep' };

export type Section = {
  id: string;
  rail: string;
  eyebrow: string;
  title: string;
  body: string;
  tags?: Tag[];
  counter?: { value: number; unit: string; label: string };
  cta?: boolean;
};

// Orden = orden del vuelo. Cada entrada tiene una zona 3D con el mismo índice en world.ts.
export const sections: Section[] = [
  {
    id: 'inicio',
    rail: 'Inicio',
    eyebrow: 'Analizador de disco para Windows',
    title: 'Mira qué ocupa tu disco.',
    body: 'El Buscador escanea, te muestra lo que más pesa y te explica qué puedes borrar con seguridad.',
    cta: true,
  },
  {
    id: 'escanea',
    rail: 'Escanea',
    eyebrow: '01 · Escanea',
    title: 'Un clic y recorre todo el disco.',
    body: 'Funciona con cualquier disco fijo. Nunca abre archivos que solo están en la nube, así que no dispara descargas.',
    tags: [{ label: 'Discos fijos' }, { label: 'Sin descargas de la nube' }],
  },
  {
    id: 'mapa',
    rail: 'Mapa',
    eyebrow: '02 · Entiende',
    title: 'Lo pesado, a la vista.',
    body: 'Lista lo que más ocupa y lo dibuja en un mapa. Entra a cualquier carpeta para ver qué hay dentro.',
    tags: [{ label: 'Lista' }, { label: 'Mapa' }, { label: 'Carpetas' }],
  },
  {
    id: 'semaforo',
    rail: 'Semáforo',
    eyebrow: '03 · Decide',
    title: 'Seguro, Revisar o No tocar.',
    body: 'Cada recomendación explica el motivo. Lo que git rastrea nunca se marca como seguro.',
    tags: [
      { label: '✓ Seguro', tone: 'safe' },
      { label: '! Revisar', tone: 'review' },
      { label: '✕ No tocar', tone: 'keep' },
    ],
  },
  {
    id: 'dev',
    rail: 'Basura dev',
    eyebrow: 'Para devs',
    title: 'La basura de desarrollo, encontrada.',
    body: 'node_modules, .next, dist y cachés de herramientas. Sabe cuáles se regeneran y cuáles conviene revisar.',
    tags: [{ label: 'node_modules' }, { label: '.next' }, { label: 'dist' }, { label: 'cachés' }],
  },
  {
    id: 'duplicados',
    rail: 'Duplicados',
    eyebrow: 'Duplicados',
    title: 'El mismo archivo, dos veces.',
    body: 'Compara por tamaño y luego por contenido con BLAKE3. Tú eliges qué copia conservar, también por carpetas.',
    tags: [{ label: 'BLAKE3' }, { label: 'Conservar por carpeta' }],
  },
  {
    id: 'limpieza',
    rail: 'Limpieza',
    eyebrow: 'Limpieza',
    title: 'Tú confirmas. Nada se borra solo.',
    body: 'Manda a la papelera o ejecuta el comando oficial de la herramienta, que te muestra antes. En carpetas sincronizadas libera espacio sin borrar nada de la nube.',
    counter: { value: 23.4, unit: 'GB', label: 'a la papelera' },
  },
  {
    id: 'descarga',
    rail: 'Descarga',
    eyebrow: 'Open source · GPL-3.0',
    title: 'Recupera tu espacio.',
    body: 'Gratis y abierto. Su única conexión es preguntar a GitHub si hay versión nueva, y cada actualización se verifica con una firma.',
    cta: true,
  },
];
