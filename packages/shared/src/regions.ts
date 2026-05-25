// ====================================================================
// O'zbekiston viloyatlari va shaharlari
// ====================================================================

export interface RegionData {
  code: string;
  nameUz: string;
  nameRu: string;
  cities: { nameUz: string; nameRu: string }[];
}

export const REGIONS: RegionData[] = [
  {
    code: 'TASHKENT_CITY',
    nameUz: 'Toshkent shahri',
    nameRu: 'Город Ташкент',
    cities: [
      { nameUz: 'Bektemir', nameRu: 'Бектемир' },
      { nameUz: 'Chilonzor', nameRu: 'Чиланзар' },
      { nameUz: 'Mirobod', nameRu: 'Мирабад' },
      { nameUz: 'Mirzo Ulug\'bek', nameRu: 'Мирзо Улугбек' },
      { nameUz: 'Olmazor', nameRu: 'Алмазар' },
      { nameUz: 'Sergeli', nameRu: 'Сергели' },
      { nameUz: 'Shayxontohur', nameRu: 'Шайхантахур' },
      { nameUz: 'Uchtepa', nameRu: 'Учтепа' },
      { nameUz: 'Yakkasaroy', nameRu: 'Яккасарай' },
      { nameUz: 'Yashnobod', nameRu: 'Яшнабад' },
      { nameUz: 'Yunusobod', nameRu: 'Юнусабад' },
      { nameUz: 'Yangihayot', nameRu: 'Янгихаёт' },
    ],
  },
  {
    code: 'TASHKENT_REGION',
    nameUz: 'Toshkent viloyati',
    nameRu: 'Ташкентская область',
    cities: [
      { nameUz: 'Angren', nameRu: 'Ангрен' },
      { nameUz: 'Bekobod', nameRu: 'Бекабад' },
      { nameUz: 'Chirchiq', nameRu: 'Чирчик' },
      { nameUz: 'Olmaliq', nameRu: 'Алмалык' },
      { nameUz: 'Yangiyo\'l', nameRu: 'Янгиюль' },
      { nameUz: 'Nurafshon', nameRu: 'Нурафшон' },
    ],
  },
  { code: 'ANDIJAN', nameUz: 'Andijon', nameRu: 'Андижан', cities: [{ nameUz: 'Andijon', nameRu: 'Андижан' }, { nameUz: 'Asaka', nameRu: 'Асака' }, { nameUz: 'Xonobod', nameRu: 'Ханабад' }] },
  { code: 'BUKHARA', nameUz: 'Buxoro', nameRu: 'Бухара', cities: [{ nameUz: 'Buxoro', nameRu: 'Бухара' }, { nameUz: 'Kogon', nameRu: 'Каган' }] },
  { code: 'FERGANA', nameUz: 'Farg\'ona', nameRu: 'Фергана', cities: [{ nameUz: 'Farg\'ona', nameRu: 'Фергана' }, { nameUz: 'Marg\'ilon', nameRu: 'Маргилан' }, { nameUz: 'Qo\'qon', nameRu: 'Коканд' }] },
  { code: 'JIZZAKH', nameUz: 'Jizzax', nameRu: 'Джизак', cities: [{ nameUz: 'Jizzax', nameRu: 'Джизак' }] },
  { code: 'KARAKALPAKSTAN', nameUz: 'Qoraqalpog\'iston', nameRu: 'Каракалпакстан', cities: [{ nameUz: 'Nukus', nameRu: 'Нукус' }, { nameUz: 'Beruniy', nameRu: 'Беруни' }] },
  { code: 'KASHKADARYA', nameUz: 'Qashqadaryo', nameRu: 'Кашкадарья', cities: [{ nameUz: 'Qarshi', nameRu: 'Карши' }, { nameUz: 'Shahrisabz', nameRu: 'Шахрисабз' }] },
  { code: 'KHOREZM', nameUz: 'Xorazm', nameRu: 'Хорезм', cities: [{ nameUz: 'Urganch', nameRu: 'Ургенч' }, { nameUz: 'Xiva', nameRu: 'Хива' }] },
  { code: 'NAMANGAN', nameUz: 'Namangan', nameRu: 'Наманган', cities: [{ nameUz: 'Namangan', nameRu: 'Наманган' }, { nameUz: 'Chust', nameRu: 'Чуст' }] },
  { code: 'NAVOIY', nameUz: 'Navoiy', nameRu: 'Навои', cities: [{ nameUz: 'Navoiy', nameRu: 'Навои' }, { nameUz: 'Zarafshon', nameRu: 'Зарафшан' }] },
  { code: 'SAMARKAND', nameUz: 'Samarqand', nameRu: 'Самарканд', cities: [{ nameUz: 'Samarqand', nameRu: 'Самарканд' }, { nameUz: 'Kattaqo\'rg\'on', nameRu: 'Каттакурган' }] },
  { code: 'SIRDARYA', nameUz: 'Sirdaryo', nameRu: 'Сырдарья', cities: [{ nameUz: 'Guliston', nameRu: 'Гулистан' }] },
  { code: 'SURKHANDARYA', nameUz: 'Surxondaryo', nameRu: 'Сурхандарья', cities: [{ nameUz: 'Termiz', nameRu: 'Термез' }] },
];

export function regionLabel(code: string, lang: 'UZ' | 'RU'): string {
  const r = REGIONS.find((x) => x.code === code);
  if (!r) return code;
  return lang === 'UZ' ? r.nameUz : r.nameRu;
}
