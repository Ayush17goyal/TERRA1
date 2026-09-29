export interface CollectionConfig {
  name: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclid' | 'Dot';
}

export interface PointStruct {
  id: string | number;
  vector: number[];
  payload: Record<string, any>;
}

export interface SearchParams {
  limit?: number;
  filter?: any;
  scoreThreshold?: number;
}
