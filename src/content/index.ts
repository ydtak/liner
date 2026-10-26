import type { Opening } from './schema';
import italian from './openings/italian-game.json';
import london from './openings/london-system.json';
import caroKann from './openings/caro-kann.json';
import sicilian from './openings/sicilian-defence.json';
import qgd from './openings/queens-gambit-declined.json';

export const openings = [italian, london, caroKann, sicilian, qgd] as Opening[];
