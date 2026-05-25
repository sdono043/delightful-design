export type ItemCategory = "furniture" | "wall_finish" | "fixture" | "textile" | "accessory" | "other";

export type ProjectStatus = "draft" | "sent" | "submitted" | "complete";

export interface Designer {
  id: string;
  user_id: string;
  firm_name: string;
  created_at: string;
}

export interface Client {
  id: string;
  designer_id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Project {
  id: string;
  designer_id: string;
  client_id: string;
  name: string;
  status: ProjectStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface Room {
  id: string;
  project_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface Item {
  id: string;
  room_id: string;
  category: ItemCategory;
  name: string;
  vendor: string | null;
  price: number | null;
  image_url: string | null;
  product_url: string;
  designer_note: string | null;
  created_at: string;
  room?: Room;
}

export interface Selection {
  id: string;
  project_id: string;
  item_id: string;
  selected: boolean;
  client_note: string | null;
  created_at: string;
  item?: Item;
}

export interface MagicToken {
  id: string;
  project_id: string;
  token: string;
  expires_at: string;
  opened_at: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface ScrapedProduct {
  name: string;
  vendor: string | null;
  price: number | null;
  image_url: string | null;
  description: string | null;
}

export interface ProjectWithRoomsAndItems extends Project {
  rooms: (Room & { items: Item[] })[];
}
