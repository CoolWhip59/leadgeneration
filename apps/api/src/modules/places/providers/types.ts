export type PlaceResult = {
  externalId: string;
  source: string;
  name: string;
  address: string;
  phone?: string;
  websiteUrl?: string;
  googleMapsUrl: string;
  rating?: number | null;
  lat: number;
  lng: number;
};

export interface PlacesProvider {
  search(
    city: { id: string; name: string; bbox: [number, number, number, number] },
    category: { name: string; slug: string },
  ): Promise<PlaceResult[]>;
}
