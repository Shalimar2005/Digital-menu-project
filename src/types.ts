export interface Dish {
  id: string;
  name: string;
  price: number;
  ingredients: string;
  category: string;
  subcategory?: string;
  pairing_tag: string;
  imageUrl?: string;
  isSushi?: boolean;
}

export const BAR_SUBCATEGORIES = [
  'Coffee',
  'Tea',
   'Milkshake',
  'Mocktail',
  'Beer',
  'Vodka',
  'Gin',
  'Rum',
  'Wines',
  'Breezers',
  'Tequila',
  'Other'
] as const;

export const FOOD_SUBCATEGORIES = [
  'Main Course',
  'Appetizers',
  'Desserts',
  'Sushi',
  'Seafood',
  'Naan/ Roti'
] as const;

export interface OrderItem {
  dishId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  tableId: string;
  items: OrderItem[];
  status: 'pending' | 'cooking' | 'served';
  timestamp: any;
  totalAmount: number;
}

export type Category = 'Drinks' | 'Snacks' | 'Classic Food Menu';

export const CATEGORIES: Category[] = [
  'Drinks',
  'Snacks',
  'Classic Food Menu'
];
