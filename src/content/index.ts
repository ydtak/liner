import type { Opening } from './schema';
import italian from './openings/italian-game.json';
import london from './openings/london-system.json';
import queensGambit from './openings/queens-gambit.json';
import caroKann from './openings/caro-kann.json';
import sicilian from './openings/sicilian-defence.json';
import scandinavian from './openings/scandinavian.json';
import qgd from './openings/queens-gambit-declined.json';
import slav from './openings/slav.json';

export const openings = [italian, london, queensGambit, caroKann, sicilian, scandinavian, qgd, slav] as Opening[];
