import type { BoardTheme, PieceTheme, PlayerColor } from './chess';

export interface AppSettings {
  boardTheme: BoardTheme;
  pieceTheme: PieceTheme;
  showCoordinates: boolean;
  showLegalMoves: boolean;
  showLastMove: boolean;
  animatePieces: boolean;
  reducedMotion: boolean;
  soundEnabled: boolean;
  engineDepth: number;
  engineTimeLimit: number; // ms
  defaultPlayerColor: PlayerColor;
  appearance: 'dark';
}

export const DEFAULT_SETTINGS: AppSettings = {
  boardTheme: 'classic',
  pieceTheme: 'standard',
  showCoordinates: true,
  showLegalMoves: true,
  showLastMove: true,
  animatePieces: true,
  reducedMotion: false,
  soundEnabled: false,
  engineDepth: 4,
  engineTimeLimit: 1200,
  defaultPlayerColor: 'white',
  appearance: 'dark',
};
