/*
Author: Kaspar Etter (https://kasparetter.com/)
Work: Explained from First Principles (https://ef1p.com/)
License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
*/

import { Line, LineProps } from '../../../code/svg/elements/line';
import { printSVG } from '../../../code/svg/elements/svg';

import { A, A1, B, B2, C, links, nodes, relays } from './network-topology-mesh';

links.splice(7, 1);
links.splice(4, 1);
links.splice(2, 1);
links.splice(0, 1);

const props: Pick<LineProps, 'color'> = { color: 'orange' };

const route = [
    Line.connectEllipses(B2, C, props),
    Line.connectEllipses(C, B, props),
    Line.connectEllipses(B, A, props),
    Line.connectEllipses(A, A1, props),
];

const packets = route.map((line, index) => line.text('■', index === 1 ? 'left' : 'right', 18, { horizontalAlignment: 'middle', verticalAlignment: 'middle' }));

printSVG(...links, ...route, ...packets, ...nodes, ...relays);
